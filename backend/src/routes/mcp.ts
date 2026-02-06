import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server'
import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import type { SupabaseClient } from '../lib/supabase'

let UI_RESOURCE_URI = 'matchmaker-ui://discovery'

type Env = {
	Variables: {
		userId: string
	}
}

// Error logging utility
export type ErrorLogEntry = {
	timestamp: string
	type: string
	path: string
	status: number
	message: string
}

export let logError = (entry: ErrorLogEntry) => {
	console.error(
		entry.timestamp,
		JSON.stringify({
			type: entry.type,
			path: entry.path,
			status: entry.status,
			message: entry.message,
		})
	)
}

export let createMcpRoutes = (supabaseClient: SupabaseClient) => {
	let app = new Hono<Env>()

	// CORS middleware for AI chat app origins
	app.use(
		'*',
		cors({
			origin: ['https://claude.ai', 'https://chatgpt.com', 'https://chat.openai.com'],
			allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
			allowHeaders: ['Authorization', 'Content-Type', 'Accept', 'Mcp-Session-Id'],
			exposeHeaders: ['Mcp-Session-Id'],
			credentials: true,
		})
	)

	// Required scope for MCP access
	let REQUIRED_SCOPE = 'mcp:access'

	// Check if user has the required scope
	// Uses type assertion since app_metadata.scopes is a custom field
	let hasRequiredScope = (user: { app_metadata?: Record<string, unknown> }): boolean => {
		// If scopes are not explicitly set, allow access by default
		// This enables all authenticated users to access MCP unless explicitly restricted
		let scopes = user.app_metadata?.scopes as string[] | undefined
		if (scopes === undefined) {
			return true
		}
		// If scopes are explicitly set, check for required scope
		return scopes.includes(REQUIRED_SCOPE)
	}

	// Helper to get base URL respecting proxy headers (e.g., Railway, Cloudflare)
	let getBaseUrl = (c: Context<Env>): string => {
		let url = new URL(c.req.url)
		let proto = c.req.header('X-Forwarded-Proto') || url.protocol.replace(':', '')
		let host = c.req.header('X-Forwarded-Host') || url.host
		return `${proto}://${host}`
	}

	// Authentication middleware
	let authMiddleware = async (c: Context<Env>, next: Next) => {
		let authHeader = c.req.header('Authorization')
		let path = new URL(c.req.url).pathname

		if (!authHeader) {
			logError({
				timestamp: new Date().toISOString(),
				type: 'AuthenticationError',
				path,
				status: 401,
				message: 'Missing Authorization header',
			})
			let baseUrl = getBaseUrl(c)
			throw new HTTPException(401, {
				message: 'Unauthorized',
				res: new Response('Unauthorized', {
					status: 401,
					headers: {
						'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
					},
				}),
			})
		}

		let token = authHeader.replace('Bearer ', '')

		if (token === authHeader) {
			logError({
				timestamp: new Date().toISOString(),
				type: 'AuthenticationError',
				path,
				status: 401,
				message: 'Invalid Authorization header format',
			})
			let baseUrl = getBaseUrl(c)
			throw new HTTPException(401, {
				message: 'Unauthorized',
				res: new Response('Unauthorized', {
					status: 401,
					headers: {
						'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
					},
				}),
			})
		}

		let { data, error } = await supabaseClient.auth.getUser(token)

		if (error || !data.user) {
			logError({
				timestamp: new Date().toISOString(),
				type: 'AuthenticationError',
				path,
				status: 401,
				message: error?.message || 'Invalid token',
			})
			let baseUrl = getBaseUrl(c)
			throw new HTTPException(401, {
				message: 'Unauthorized',
				res: new Response('Unauthorized', {
					status: 401,
					headers: {
						'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
					},
				}),
			})
		}

		// Check for required scope
		if (!hasRequiredScope(data.user)) {
			logError({
				timestamp: new Date().toISOString(),
				type: 'AuthorizationError',
				path,
				status: 403,
				message: 'User lacks required scope: mcp:access',
			})
			throw new HTTPException(403, { message: 'Forbidden: insufficient scope' })
		}

		c.set('userId', data.user.id)
		await next()
	}

	// Full interview methodology - inlined as server instructions so all clients (including those that don't fetch prompts) receive it automatically
	let MATCHMAKER_INTERVIEW_PROMPT = `# Matchmaker Interview Methodology

You are conducting intake interviews for The Introduction matchmaking platform. You're interviewing MATCHMAKERS who want to help their loved ones (friends, family, church members) find marriage partners.

**Critical Context:** You're talking to the advocate, not the single person. Your questions are about understanding the single through the matchmaker's eyes.

## Recognizing When to Start

Begin the interview flow when you hear trigger phrases like:
- "I want to match [Name]"
- "Help me find someone for [Name]"
- "I have a friend/sister/brother who needs a match"
- "Can you help my [relation] find a partner?"
- "Add [Name] to the system"
- Any mention of wanting to help someone find love/marriage

**If a name is mentioned:**
1. Check if they exist using \`list_singles\`
2. If they exist → \`get_person\` to see what info we have → RESUME where we left off (ask about missing fields)
3. If they don't exist → \`add_single\` with just the name IMMEDIATELY → then start the interview

**If no name is mentioned:**
1. Ask: "What's the name of the person you're trying to match?"
2. Once you have the name → \`add_single\` IMMEDIATELY (don't wait for more info)
3. Then continue the interview, saving as you go

## CRITICAL: Save Progress Incrementally

**People may not finish the interview in one session.** Save after each answer so they can resume later:

1. Get name → \`add_single\` immediately (creates record with just name)
2. Get age → \`update_person\` with age
3. Get location → \`update_person\` with location
4. Get gender → \`update_person\` with gender
5. Learn anything else → \`update_person\` and APPEND to notes

**When resuming an interview:**
1. \`get_person\` to see current profile
2. Check what's filled vs null:
   - \`age\`: null means ask about age
   - \`location\`: null means ask about location
   - \`gender\`: null means ask about gender
   - \`notes\`: check what sections exist vs missing
3. Pick up where you left off - don't re-ask what you know

**Building the notes field:**
Append sections as you learn them. Example progression:
- After "why single": \`MATCHMAKER: [relation]\\nWHY SINGLE: [diagnosis]\`
- After history: append \`\\nRELATIONSHIP HISTORY: [details]\`
- After physical: append \`\\nPHYSICAL: [height, build, style]\`
- After preferences: append \`\\nPREFERENCES: [what they want]\`
- After deal breakers: append \`\\nDEAL BREAKERS: [hard nos]\`

## Interview Flow - CONVERSATIONAL, NOT CLINICAL

**CRITICAL: Ask ONE or TWO questions at a time. Wait for answers. React to what they say. Build rapport.**

### Opening & Context
Start warm: "Hey! I appreciate you wanting to help [name]. How do you know them?"

Then naturally flow into:
- "How did you hear about The Introduction?"
- Establish your relationship to the single

### Basic Data (Ask Naturally)
- "How old is [person]?"
- "Where do they live?"
- "Do they have any children?"
- "What do they do for work?"

For Nigerian singles: Ask about tribe and tribe preferences naturally in conversation.

### The Diagnostic Question (CRITICAL)

**Always ask:**
"Why do you think [person] is still single?"

or

"In your opinion, why do you think [person] hasn't gotten married yet?"

**Listen for patterns and follow up:**
- "Standards too high" → "What kinds of things are they looking for?"
- "Focused on career" → "When did they become open to marriage?"
- "Not approached" → probe whether it's exposure or something else

### Relationship History

**Ask:**
"Has [person] ever been in a long-term relationship?"

If NO: "Have they dated much at all, or is this pretty new for them?"
If YES: "What happened with that relationship?" and "How long were they together?"

### Physical Description

Ask naturally:
- "How tall is [person]?"
- "How would you describe their build - slim, average, athletic, heavier?"
- "Are they into fitness?"
- "How would you describe their style?"

### What They're Looking For

- "What type of [man/woman] are they looking for?"
- Height preferences?
- Physical/fitness requirements?
- Career/income expectations?
- Religious requirements?

Listen for rigid ("MUST be") vs flexible ("Preferably") signals.

### Market Reality Education (When Needed)

If expectations seem unrealistic, DON'T lecture. Use Socratic questioning:

Example:
You: "So she's 45 and only wants a man who's never been married?"
Them: "Yes"
You: "In your circle, how many men around that age who've never been married do you know?"
Them: "Not many..."
You: "Right. Should we also be open to someone divorced or widowed?"

Let them reach conclusions themselves.

### Deal Breakers

"Is there anything that would be a complete deal breaker that's out of the ordinary? Not the normal stuff - I mean unusual things I might be surprised to learn about?"

Probe: tattoos, divorced status, kids from previous relationships, specific physical features.

### Appreciation & Process

Thank them for helping their friend/family member.

Explain:
- They're the matchmaker - they'll vet potential matches before the single sees them
- You'll reach out to them (not the single) when you find someone
- Set realistic expectations about timeline

## After the Interview

Profile was already saved incrementally during the interview (\`add_single\` at name, \`update_person\` after each answer). When the interview is complete:

1. Use \`find_matches\` to see potential matches
2. Present matches to the matchmaker conversationally

## Your Voice Throughout

- **Warm and friendly** - like a friend who happens to be good at matchmaking
- **Direct but kind** - "I care about their success" frames hard truths
- **Questions over lectures** - Lead them to conclusions
- **One question at a time** - React, then ask the next
- **Never clinical** - No "Phase 1" or bullet lists of questions`

	// Helpers for structured content
	let extractCity = (location: string | null | undefined): string | null => {
		if (!location || !location.trim()) return null
		return location.split(',')[0]?.trim() || null
	}

	let extractProfession = (notes: string | null | undefined): string | null => {
		if (!notes) return null
		let m = notes.match(
			/(?:works as (?:a |an )?|profession:\s*|career:\s*|job:\s*|occupation:\s*)([^,.;\n]+?)(?:\s+and\s|\s+who\s|[,.;\n]|$)/i
		)
		return m ? m[1]!.trim() : null
	}

	let maskAge = (age?: number | null): string | null => {
		if (!age || !Number.isFinite(age)) return null
		return `${Math.floor(age / 10) * 10}s`
	}

	// Structured content builder for match results UI
	let buildMatchStructuredContent = (personId: string, matches: Record<string, unknown>[]) => ({
		view: 'match_results',
		for_person_id: personId,
		matches: matches.map(match => {
			let person = match.person as Record<string, unknown> | undefined
			return {
				id: person?.id ?? '',
				age: maskAge(person?.age as number | null),
				gender: (person?.gender as string | null) ?? null,
				profession: extractProfession(person?.notes as string | null),
				city: extractCity(person?.location as string | null),
				compatibility_score: match.compatibility_score ?? null,
				match_reasons: match.reasons ?? [],
			}
		}),
	})

	// Create MCP server with tools
	let createMcpServer = (userId: string) => {
		let server = new McpServer(
			{
				name: 'matchmaker-mcp',
				version: '1.0.0',
			},
			{
				capabilities: {
					tools: {},
					prompts: {},
					resources: {},
				},
				instructions: MATCHMAKER_INTERVIEW_PROMPT,
			}
		)

		// Register UI resource via ext-apps helper
		registerAppResource(
			server,
			'matchmaker-discovery-ui',
			UI_RESOURCE_URI,
			{
				description: 'Discovery-only UI for matchmaker intake and masked match previews',
			},
			async () => {
				let html = await readFile(new URL('../../ui/discovery.html', import.meta.url), 'utf-8')
				return {
					contents: [{
						uri: UI_RESOURCE_URI,
						mimeType: RESOURCE_MIME_TYPE,
						text: html,
					}],
				}
			}
		)

		// Register the interview methodology prompt
		server.registerPrompt('matchmaker-interview', {
			description:
				'The complete matchmaker intake interview methodology. ALWAYS use this when someone wants to match a friend or family member. It guides you through a warm, conversational interview process.',
		}, async () => ({
			messages: [{
				role: 'user',
				content: {
					type: 'text',
					text: MATCHMAKER_INTERVIEW_PROMPT,
				},
			}],
		}))

		// --- Regular tools (13 tools) ---

		server.registerTool('add_single', {
			description:
				'Add a new person to the matchmaker database. Call this IMMEDIATELY when you learn someone\'s name - do NOT wait for the full interview. Only the name is required. Use update_person later to add details as you learn them.',
			inputSchema: {
				name: z.string().describe('Person name'),
			},
		}, async ({ name }) => {
			// Verify the matchmaker exists
			let { data: matchmaker, error: matchmakerError } = await supabaseClient
				.from('matchmakers')
				.select('id, name')
				.eq('id', userId)
				.single()

			if (matchmakerError) {
				throw new Error(`Matchmaker not found for user ${userId}. Please sign out and sign back in.`)
			}

			let { data, error } = await supabaseClient
				.from('people')
				.insert({ name, matchmaker_id: userId })
				.select()
				.single()
			if (error) throw new Error(error.message)
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
			}
		})

		server.registerTool('list_singles', {
			description: 'List all people you\'ve added. Call this FIRST when someone mentions a name - check if that person already exists. If they exist, get_person to see their profile and RESUME the interview where you left off. If not, add_single to create them.',
			inputSchema: {},
		}, async () => {
			let { data, error } = await supabaseClient
				.from('people')
				.select('*')
				.eq('matchmaker_id', userId)
				.eq('active', true)
			if (error) throw new Error(error.message)
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
			}
		})

		server.registerTool('get_person', {
			description: 'Retrieve a person\'s full profile. Use this when resuming an interview - check what fields are filled (age, location, gender, notes) vs empty/null to know what to ask next. A complete profile has: age, location, gender, and comprehensive notes with relationship history, physical description, preferences, and deal breakers.',
			inputSchema: {
				id: z.string().describe('Person ID (UUID)'),
			},
		}, async ({ id }) => {
			let { data, error } = await supabaseClient
				.from('people')
				.select('*')
				.eq('id', id)
				.eq('matchmaker_id', userId)
				.single()
			if (error) throw new Error(error.message)
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
			}
		})

		server.registerTool('update_person', {
			description: "Save profile data incrementally as you learn it. Call this AFTER EACH answer to save progress - users may not finish in one session. Add to the notes field as you go: why single, relationship history, physical description, preferences, deal breakers. Each update preserves previous data.",
			inputSchema: {
				id: z.string().describe('Person ID (UUID)'),
				name: z.string().optional().describe('Person name'),
				age: z.number().optional().describe('Person age'),
				location: z.string().optional().describe('Person location'),
				gender: z.string().optional().describe('Person gender'),
				preferences: z.object({}).passthrough().optional().describe('Person preferences'),
				personality: z.object({}).passthrough().optional().describe('Person personality traits'),
				notes: z.string().optional().describe('Append interview intelligence here incrementally'),
			},
		}, async ({ id, ...updates }) => {
			// Filter out undefined values so we only update fields that were provided
			let cleanUpdates: Record<string, unknown> = {}
			for (let [key, value] of Object.entries(updates)) {
				if (value !== undefined) cleanUpdates[key] = value
			}
			let { data, error } = await supabaseClient
				.from('people')
				.update(cleanUpdates)
				.eq('id', id)
				.eq('matchmaker_id', userId)
				.select()
				.single()
			if (error) throw new Error(error.message)
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
			}
		})

		server.registerTool('delete_person', {
			description: 'Soft-delete a person (sets active=false)',
			inputSchema: {
				id: z.string().describe('Person ID (UUID)'),
			},
		}, async ({ id }) => {
			let { data, error } = await supabaseClient
				.from('people')
				.update({ active: false })
				.eq('id', id)
				.eq('matchmaker_id', userId)
				.select()
				.single()
			if (error) throw new Error(error.message)
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
			}
		})

		server.registerTool('create_introduction', {
			description: 'Create an introduction between two people',
			inputSchema: {
				person_a_id: z.string().describe('First person ID (UUID)'),
				person_b_id: z.string().describe('Second person ID (UUID)'),
				notes: z.string().optional().describe('Notes about the introduction'),
			},
		}, async ({ person_a_id, person_b_id, notes }) => {
			let { data, error } = await supabaseClient
				.from('introductions')
				.insert({
					matchmaker_id: userId,
					person_a_id,
					person_b_id,
					notes: notes || null,
					status: 'pending',
				})
				.select()
				.single()
			if (error) throw new Error(error.message)
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
			}
		})

		server.registerTool('list_introductions', {
			description: 'List all introductions for the matchmaker',
			inputSchema: {},
		}, async () => {
			let { data, error } = await supabaseClient
				.from('introductions')
				.select('*')
				.eq('matchmaker_id', userId)
			if (error) throw new Error(error.message)
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
			}
		})

		server.registerTool('get_introduction', {
			description: 'Get details of a specific introduction',
			inputSchema: {
				id: z.string().describe('Introduction ID (UUID)'),
			},
		}, async ({ id }) => {
			let { data, error } = await supabaseClient
				.from('introductions')
				.select('*')
				.eq('id', id)
				.eq('matchmaker_id', userId)
				.single()
			if (error) throw new Error(error.message)
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
			}
		})

		server.registerTool('update_introduction', {
			description: 'Update introduction status or notes',
			inputSchema: {
				id: z.string().describe('Introduction ID (UUID)'),
				status: z.enum(['pending', 'accepted', 'declined', 'dating', 'ended']).optional().describe('Introduction status'),
				notes: z.string().optional().describe('Notes about the introduction'),
			},
		}, async ({ id, ...updates }) => {
			let cleanUpdates: Record<string, unknown> = {}
			for (let [key, value] of Object.entries(updates)) {
				if (value !== undefined) cleanUpdates[key] = value
			}
			let { data, error } = await supabaseClient
				.from('introductions')
				.update(cleanUpdates)
				.eq('id', id)
				.eq('matchmaker_id', userId)
				.select()
				.single()
			if (error) throw new Error(error.message)
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
			}
		})

		server.registerTool('submit_feedback', {
			description: 'Submit feedback about an introduction',
			inputSchema: {
				introduction_id: z.string().describe('Introduction ID (UUID)'),
				from_person_id: z.string().describe('Person ID (UUID) submitting the feedback'),
				content: z.string().describe('Feedback content'),
				sentiment: z.string().optional().describe('Feedback sentiment (e.g., positive, negative, neutral)'),
			},
		}, async ({ introduction_id, from_person_id, content, sentiment }) => {
			let { data, error } = await supabaseClient
				.from('feedback')
				.insert({
					introduction_id,
					from_person_id,
					content,
					sentiment: sentiment || null,
				})
				.select()
				.single()
			if (error) throw new Error(error.message)
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
			}
		})

		server.registerTool('list_feedback', {
			description: 'Get all feedback for a specific introduction',
			inputSchema: {
				introduction_id: z.string().describe('Introduction ID (UUID)'),
			},
		}, async ({ introduction_id }) => {
			let { data, error } = await supabaseClient
				.from('feedback')
				.select('*')
				.eq('introduction_id', introduction_id)
			if (error) throw new Error(error.message)
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
			}
		})

		server.registerTool('get_feedback', {
			description: 'Get a specific feedback record',
			inputSchema: {
				id: z.string().describe('Feedback ID (UUID)'),
			},
		}, async ({ id }) => {
			let { data, error } = await supabaseClient
				.from('feedback')
				.select('*')
				.eq('id', id)
				.single()
			if (error) throw new Error(error.message)
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
			}
		})

		// --- find_matches: the key tool with UI binding via ext-apps ---

		registerAppTool(
			server,
			'find_matches',
			{
				description: 'Find compatible matches for a person. Only use AFTER their profile is complete with full interview data (age, preferences, deal breakers, notes). Present matches to the matchmaker with: name, age, location, why they might work, and any concerns.',
				inputSchema: {
					person_id: z.string().describe('Person ID (UUID) to find matches for'),
				},
				_meta: { ui: { resourceUri: UI_RESOURCE_URI } },
			},
			async ({ person_id }) => {
				console.log(`[MCP Tool] Calling tool: find_matches for userId: ${userId}`)

				// Verify the person exists and belongs to this user
				let { error: personError } = await supabaseClient
					.from('people')
					.select('id')
					.eq('id', person_id)
					.eq('matchmaker_id', userId)
					.single()
				if (personError) throw new Error(personError.message)

				// Get all active people except the person we're matching for
				let { data: candidates, error: candidatesError } = await supabaseClient
					.from('people')
					.select('*')
					.eq('active', true)
					.neq('id', person_id)
				if (candidatesError) throw new Error(candidatesError.message)

				console.log(`[MCP find_matches] Found ${candidates?.length || 0} candidates for person ${person_id}`)

				// Simple matching - return candidates with compatibility score
				let matches = (candidates || []).map(candidate => ({
					person: candidate,
					compatibility_score: Math.random(), // Placeholder - TODO: implement real matching algorithm
					reasons: ['Both are active singles in the system'],
				}))

				let sc = buildMatchStructuredContent(person_id, matches)

				return {
					content: [{ type: 'text' as const, text: `Found ${matches.length} potential matches. Review the match cards for details.` }],
					structuredContent: sc,
				}
			}
		)

		return server
	}

	// Handle all MCP requests
	app.all('/', authMiddleware, async c => {
		let userId = c.get('userId')
		let path = new URL(c.req.url).pathname

		// Create transport in stateless mode (no session ID generator)
		let transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: false,
		})

		// Create and connect MCP server
		let server = createMcpServer(userId)
		await server.connect(transport)

		// Handle the request
		try {
			let response = await transport.handleRequest(c.req.raw)
			return response
		} catch (error) {
			let errorType = error instanceof Error ? error.constructor.name : 'UnknownError'
			let errorMessage = error instanceof Error ? error.message : String(error)
			let status = error instanceof SyntaxError ? 400 : 500

			logError({
				timestamp: new Date().toISOString(),
				type: errorType,
				path,
				status,
				message: errorMessage,
			})

			if (error instanceof SyntaxError) {
				return c.json({ error: 'Invalid JSON' }, 400)
			}
			throw error
		}
	})

	return app
}
