import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	ListPromptsRequestSchema,
	GetPromptRequestSchema,
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { readFile } from 'node:fs/promises'
import type { SupabaseClient } from '../lib/supabase'

let UI_RESOURCE_URI = 'matchmaker-ui://discovery'
let UI_RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app'

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

	// Create MCP server with tools
	let createMcpServer = (userId: string) => {
		let server = new Server(
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

		// Register prompts - the interview methodology
		server.setRequestHandler(ListPromptsRequestSchema, async () => ({
			prompts: [
				{
					name: 'matchmaker-interview',
					description:
						'The complete matchmaker intake interview methodology. ALWAYS use this when someone wants to match a friend or family member. It guides you through a warm, conversational interview process.',
				},
			],
		}))

		server.setRequestHandler(GetPromptRequestSchema, async request => {
			let { name } = request.params

			if (name === 'matchmaker-interview') {
				return {
					description: 'Matchmaker intake interview methodology',
					messages: [
						{
							role: 'user',
							content: {
								type: 'text',
								text: MATCHMAKER_INTERVIEW_PROMPT,
							},
						},
					],
				}
			}

			throw new Error(`Unknown prompt: ${name}`)
		})

		// Register UI resources
		server.setRequestHandler(ListResourcesRequestSchema, async () => ({
			resources: [
				{
					name: 'matchmaker-discovery-ui',
					uri: UI_RESOURCE_URI,
					description: 'Discovery-only UI for matchmaker intake and masked match previews',
					mimeType: UI_RESOURCE_MIME_TYPE,
				},
			],
		}))

		server.setRequestHandler(ReadResourceRequestSchema, async request => {
			let { uri } = request.params
			console.log(`[MCP ReadResource] Requested URI: ${uri}`)
			if (uri !== UI_RESOURCE_URI) {
				console.log(`[MCP ReadResource] Unknown URI, expected: ${UI_RESOURCE_URI}`)
				throw new Error(`Unknown resource URI: ${uri}`)
			}

			let html = await readFile(new URL('../../ui/discovery.html', import.meta.url), 'utf-8')
			console.log(`[MCP ReadResource] Serving discovery.html (${html.length} bytes)`)
			return {
				contents: [
					{
						uri,
						mimeType: UI_RESOURCE_MIME_TYPE,
						text: html,
					},
				],
			}
		})

		// Register tools - these tools call the internal API routes
		server.setRequestHandler(ListToolsRequestSchema, async () => {
			console.log(`[MCP ListTools] ChatGPT requested tool list`)
			let toolList = {
			tools: [
				{
					name: 'add_single',
					description:
						'Add a new person to the matchmaker database. Call this IMMEDIATELY when you learn someone\'s name - do NOT wait for the full interview. Only the name is required. Use update_person later to add details as you learn them.',
					inputSchema: {
						type: 'object',
						properties: {
							name: { type: 'string', description: 'Person name' },
						},
						required: ['name'],
					},
				},
				{
					name: 'list_singles',
					description: 'List all people you\'ve added. Call this FIRST when someone mentions a name - check if that person already exists. If they exist, get_person to see their profile and RESUME the interview where you left off. If not, add_single to create them.',
					inputSchema: {
						type: 'object',
						properties: {},
					},
				},
				{
					name: 'get_person',
					description: 'Retrieve a person\'s full profile. Use this when resuming an interview - check what fields are filled (age, location, gender, notes) vs empty/null to know what to ask next. A complete profile has: age, location, gender, and comprehensive notes with relationship history, physical description, preferences, and deal breakers.',
					inputSchema: {
						type: 'object',
						properties: {
							id: { type: 'string', description: 'Person ID (UUID)' },
						},
						required: ['id'],
					},
				},
				{
					name: 'update_person',
					description: "Save profile data incrementally as you learn it. Call this AFTER EACH answer to save progress - users may not finish in one session. Add to the notes field as you go: why single, relationship history, physical description, preferences, deal breakers. Each update preserves previous data.",
					inputSchema: {
						type: 'object',
						properties: {
							id: { type: 'string', description: 'Person ID (UUID)' },
							name: { type: 'string', description: 'Person name' },
							age: { type: 'number', description: 'Person age' },
							location: { type: 'string', description: 'Person location' },
							gender: { type: 'string', description: 'Person gender' },
							preferences: { type: 'object', description: 'Person preferences' },
							personality: { type: 'object', description: 'Person personality traits' },
							notes: { type: 'string', description: 'Append interview intelligence here incrementally' },
						},
						required: ['id'],
					},
				},
				{
					name: 'create_introduction',
					description: 'Create an introduction between two people',
					inputSchema: {
						type: 'object',
						properties: {
							person_a_id: { type: 'string', description: 'First person ID (UUID)' },
							person_b_id: { type: 'string', description: 'Second person ID (UUID)' },
							notes: { type: 'string', description: 'Notes about the introduction' },
						},
						required: ['person_a_id', 'person_b_id'],
					},
				},
				{
					name: 'list_introductions',
					description: 'List all introductions for the matchmaker',
					inputSchema: {
						type: 'object',
						properties: {},
					},
				},
				{
					name: 'update_introduction',
					description: 'Update introduction status or notes',
					inputSchema: {
						type: 'object',
						properties: {
							id: { type: 'string', description: 'Introduction ID (UUID)' },
							status: {
								type: 'string',
								enum: ['pending', 'accepted', 'declined', 'dating', 'ended'],
								description: 'Introduction status',
							},
							notes: { type: 'string', description: 'Notes about the introduction' },
						},
						required: ['id'],
					},
				},
				{
					name: 'find_matches',
					_meta: { ui: { resourceUri: UI_RESOURCE_URI } },
					description: 'Find compatible matches for a person. Only use AFTER their profile is complete with full interview data (age, preferences, deal breakers, notes). Present matches to the matchmaker with: name, age, location, why they might work, and any concerns.',
					inputSchema: {
						type: 'object',
						properties: {
							person_id: {
								type: 'string',
								description: 'Person ID (UUID) to find matches for',
							},
						},
						required: ['person_id'],
					},
				},
				{
					name: 'delete_person',
					description: 'Soft-delete a person (sets active=false)',
					inputSchema: {
						type: 'object',
						properties: {
							id: { type: 'string', description: 'Person ID (UUID)' },
						},
						required: ['id'],
					},
				},
				{
					name: 'get_introduction',
					description: 'Get details of a specific introduction',
					inputSchema: {
						type: 'object',
						properties: {
							id: { type: 'string', description: 'Introduction ID (UUID)' },
						},
						required: ['id'],
					},
				},
				{
					name: 'submit_feedback',
					description: 'Submit feedback about an introduction',
					inputSchema: {
						type: 'object',
						properties: {
							introduction_id: { type: 'string', description: 'Introduction ID (UUID)' },
							from_person_id: {
								type: 'string',
								description: 'Person ID (UUID) submitting the feedback',
							},
							content: { type: 'string', description: 'Feedback content' },
							sentiment: {
								type: 'string',
								description: 'Feedback sentiment (e.g., positive, negative, neutral)',
							},
						},
						required: ['introduction_id', 'from_person_id', 'content'],
					},
				},
				{
					name: 'list_feedback',
					description: 'Get all feedback for a specific introduction',
					inputSchema: {
						type: 'object',
						properties: {
							introduction_id: { type: 'string', description: 'Introduction ID (UUID)' },
						},
						required: ['introduction_id'],
					},
				},
				{
					name: 'get_feedback',
					description: 'Get a specific feedback record',
					inputSchema: {
						type: 'object',
						properties: {
							id: { type: 'string', description: 'Feedback ID (UUID)' },
						},
						required: ['id'],
					},
				},
			],
		}
			let findMatchesTool = toolList.tools.find(t => t.name === 'find_matches')
			console.log(`[MCP ListTools] find_matches tool _meta: ${JSON.stringify((findMatchesTool as any)?._meta)}`)
			return toolList
		})

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

		let discoveryResult = (matchCount: number, structuredContent: Record<string, unknown>) => {
			let result = {
				content: [{ type: 'text' as const, text: `Found ${matchCount} potential matches. Review the match cards for details.` }],
				structuredContent,
				_meta: { ui: { resourceUri: UI_RESOURCE_URI } },
			}
			console.log(`[MCP discoveryResult] matchCount=${matchCount}`)
			console.log(`[MCP discoveryResult] structuredContent keys: ${Object.keys(structuredContent).join(', ')}`)
			console.log(`[MCP discoveryResult] structuredContent.matches count: ${(structuredContent as any).matches?.length ?? 'N/A'}`)
			console.log(`[MCP discoveryResult] _meta.ui.resourceUri: ${result._meta.ui.resourceUri}`)
			console.log(`[MCP discoveryResult] full response shape: ${JSON.stringify(Object.keys(result))}`)
			console.log(`[MCP discoveryResult] full response: ${JSON.stringify(result).substring(0, 500)}`)
			return result
		}

		// Handle tool calls by making direct database calls
		server.setRequestHandler(CallToolRequestSchema, async request => {
			let { name, arguments: args } = request.params

			console.log(`[MCP Tool] Calling tool: ${name} for userId: ${userId}`)
			console.log(`[MCP Tool] Arguments:`, JSON.stringify(args))

			try {
				if (name === 'add_single') {
					if (
						!args ||
						typeof args !== 'object' ||
						!('name' in args) ||
						typeof args.name !== 'string'
					) {
						throw new Error('Invalid arguments: name is required and must be a string')
					}

					// First verify the matchmaker exists
					let { data: matchmaker, error: matchmakerError } = await supabaseClient
						.from('matchmakers')
						.select('id, name')
						.eq('id', userId)
						.single()

					console.log(`[MCP Tool] Matchmaker lookup for ${userId}:`, matchmaker ? JSON.stringify(matchmaker) : 'NOT FOUND')
					if (matchmakerError) {
						console.error(`[MCP Tool] Matchmaker error:`, matchmakerError.message)
						throw new Error(`Matchmaker not found for user ${userId}. Please sign out and sign back in.`)
					}

					let { data, error } = await supabaseClient
						.from('people')
						.insert({ name: args.name, matchmaker_id: userId })
						.select()
						.single()
					if (error) {
						console.error(`[MCP Tool] Insert error:`, error.message)
						throw new Error(error.message)
					}
					console.log(`[MCP Tool] Person created:`, JSON.stringify(data))
					return {
						content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
					}
				}

				if (name === 'list_singles') {
					let { data, error } = await supabaseClient
						.from('people')
						.select('*')
						.eq('matchmaker_id', userId)
						.eq('active', true)
					if (error) throw new Error(error.message)
					return {
						content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
					}
				}

				if (name === 'get_person') {
					if (!args || typeof args !== 'object' || !('id' in args) || typeof args.id !== 'string') {
						throw new Error('Invalid arguments: id is required and must be a string')
					}
					let { data, error } = await supabaseClient
						.from('people')
						.select('*')
						.eq('id', args.id)
						.eq('matchmaker_id', userId)
						.single()
					if (error) throw new Error(error.message)
					return {
						content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
					}
				}

				if (name === 'update_person') {
					if (!args || typeof args !== 'object' || !('id' in args) || typeof args.id !== 'string') {
						throw new Error('Invalid arguments: id is required and must be a string')
					}
					let { id, ...updates } = args as Record<string, unknown>
					let { data, error } = await supabaseClient
						.from('people')
						.update(updates)
						.eq('id', id)
						.eq('matchmaker_id', userId)
						.select()
						.single()
					if (error) throw new Error(error.message)
					return {
						content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
					}
				}

				if (name === 'create_introduction') {
					if (
						!args ||
						typeof args !== 'object' ||
						!('person_a_id' in args) ||
						typeof args.person_a_id !== 'string' ||
						!('person_b_id' in args) ||
						typeof args.person_b_id !== 'string'
					) {
						throw new Error(
							'Invalid arguments: person_a_id and person_b_id are required and must be strings'
						)
					}
					let { person_a_id, person_b_id, notes } = args as {
						person_a_id: string
						person_b_id: string
						notes?: string
					}
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
						content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
					}
				}

				if (name === 'list_introductions') {
					let { data, error } = await supabaseClient
						.from('introductions')
						.select('*')
						.eq('matchmaker_id', userId)
					if (error) throw new Error(error.message)
					return {
						content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
					}
				}

				if (name === 'update_introduction') {
					if (!args || typeof args !== 'object' || !('id' in args) || typeof args.id !== 'string') {
						throw new Error('Invalid arguments: id is required and must be a string')
					}
					let { id, ...updates } = args as Record<string, unknown>
					let { data, error } = await supabaseClient
						.from('introductions')
						.update(updates)
						.eq('id', id)
						.eq('matchmaker_id', userId)
						.select()
						.single()
					if (error) throw new Error(error.message)
					return {
						content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
					}
				}

				if (name === 'find_matches') {
					console.log(`[MCP find_matches] Called with args: ${JSON.stringify(args)}`)
					if (
						!args ||
						typeof args !== 'object' ||
						!('person_id' in args) ||
						typeof args.person_id !== 'string'
					) {
						throw new Error('Invalid arguments: person_id is required and must be a string')
					}
					// Verify the person exists and belongs to this user
					let { error: personError } = await supabaseClient
						.from('people')
						.select('id')
						.eq('id', args.person_id)
						.eq('matchmaker_id', userId)
						.single()
					if (personError) {
					console.log(`[MCP find_matches] Person lookup error: ${personError.message}`)
					throw new Error(personError.message)
				}

					// Get all active people except the person we're matching for
					// Includes both this matchmaker's singles and other matchmakers' singles
					let { data: candidates, error: candidatesError } = await supabaseClient
						.from('people')
						.select('*')
						.eq('active', true)
						.neq('id', args.person_id)
					if (candidatesError) {
					console.log(`[MCP find_matches] Candidates query error: ${candidatesError.message}`)
					throw new Error(candidatesError.message)
				}

					console.log(`[MCP find_matches] Found ${candidates?.length || 0} candidates for person ${args.person_id}`)

					// Simple matching - return candidates with compatibility score
					let matches = (candidates || []).map(candidate => ({
						person: candidate,
						compatibility_score: Math.random(), // Placeholder - TODO: implement real matching algorithm
						reasons: ['Both are active singles in the system'],
					}))
					let sc = buildMatchStructuredContent(args.person_id as string, matches)
					console.log(`[MCP find_matches] structuredContent.matches count: ${sc.matches.length}`)
					console.log(`[MCP find_matches] First match sample: ${JSON.stringify(sc.matches[0] ?? null)}`)

					let result = discoveryResult(matches.length, sc)
					console.log(`[MCP find_matches] Response keys: ${JSON.stringify(Object.keys(result))}`)
					console.log(`[MCP find_matches] _meta: ${JSON.stringify(result._meta)}`)
					console.log(`[MCP find_matches] Full response (truncated): ${JSON.stringify(result).substring(0, 800)}`)
					return result
				}

				if (name === 'delete_person') {
					if (!args || typeof args !== 'object' || !('id' in args) || typeof args.id !== 'string') {
						throw new Error('Invalid arguments: id is required and must be a string')
					}
					let { data, error } = await supabaseClient
						.from('people')
						.update({ active: false })
						.eq('id', args.id)
						.eq('matchmaker_id', userId)
						.select()
						.single()
					if (error) throw new Error(error.message)
					return {
						content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
					}
				}

				if (name === 'get_introduction') {
					if (!args || typeof args !== 'object' || !('id' in args) || typeof args.id !== 'string') {
						throw new Error('Invalid arguments: id is required and must be a string')
					}
					let { data, error } = await supabaseClient
						.from('introductions')
						.select('*')
						.eq('id', args.id)
						.eq('matchmaker_id', userId)
						.single()
					if (error) throw new Error(error.message)
					return {
						content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
					}
				}

				if (name === 'submit_feedback') {
					if (
						!args ||
						typeof args !== 'object' ||
						!('introduction_id' in args) ||
						typeof args.introduction_id !== 'string' ||
						!('from_person_id' in args) ||
						typeof args.from_person_id !== 'string' ||
						!('content' in args) ||
						typeof args.content !== 'string'
					) {
						throw new Error(
							'Invalid arguments: introduction_id, from_person_id, and content are required and must be strings'
						)
					}
					let { introduction_id, from_person_id, content, sentiment } = args as {
						introduction_id: string
						from_person_id: string
						content: string
						sentiment?: string
					}
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
						content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
					}
				}

				if (name === 'list_feedback') {
					if (
						!args ||
						typeof args !== 'object' ||
						!('introduction_id' in args) ||
						typeof args.introduction_id !== 'string'
					) {
						throw new Error('Invalid arguments: introduction_id is required and must be a string')
					}
					let { data, error } = await supabaseClient
						.from('feedback')
						.select('*')
						.eq('introduction_id', args.introduction_id)
					if (error) throw new Error(error.message)
					return {
						content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
					}
				}

				if (name === 'get_feedback') {
					if (!args || typeof args !== 'object' || !('id' in args) || typeof args.id !== 'string') {
						throw new Error('Invalid arguments: id is required and must be a string')
					}
					let { data, error } = await supabaseClient
						.from('feedback')
						.select('*')
						.eq('id', args.id)
						.single()
					if (error) throw new Error(error.message)
					return {
						content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
					}
				}

				throw new Error(`Unknown tool: ${name}`)
			} catch (error) {
				let errorMessage = 'Unknown error'
				if (error instanceof Error) {
					errorMessage = error.message
				} else if (typeof error === 'string') {
					errorMessage = error
				}
				return {
					content: [{ type: 'text', text: `Error: ${errorMessage}` }],
					isError: true,
				}
			}
		})

		return server
	}

	// Handle all MCP requests
	app.all('/', authMiddleware, async c => {
		let userId = c.get('userId')
		let path = new URL(c.req.url).pathname

		// Log incoming request
		let reqBody = await c.req.text()
		console.log(`[MCP request] ${c.req.method} ${path} userId=${userId}`)
		console.log(`[MCP request] Body (truncated): ${reqBody.substring(0, 500)}`)

		// Reconstruct the request with the consumed body so transport can read it
		let reconstructed = new Request(c.req.url, {
			method: c.req.method,
			headers: c.req.raw.headers,
			body: reqBody,
		})

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
			let response = await transport.handleRequest(reconstructed)
			// Log the wire response for debugging
			if (response) {
				let cloned = response.clone()
				cloned.text().then(body => {
					console.log(`[MCP transport] Response status: ${response.status}`)
					console.log(`[MCP transport] Response content-type: ${response.headers.get('content-type')}`)
					console.log(`[MCP transport] Response body (truncated): ${body.substring(0, 1000)}`)
				}).catch(() => {})
			}
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
