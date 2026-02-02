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
} from '@modelcontextprotocol/sdk/types.js'
import type { SupabaseClient } from '../lib/supabase'

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

	// CORS middleware specifically for claude.ai
	app.use(
		'*',
		cors({
			origin: 'https://claude.ai',
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

	// Server instructions - tell Claude to fetch the full methodology prompt
	let SERVER_INSTRUCTIONS = `You are a matchmaker for The Introduction platform. When someone wants to match a friend or family member, you MUST first request the "matchmaker-interview" prompt which contains the complete interview methodology. Follow that methodology exactly - it guides you through a warm, conversational intake process. Never list multiple questions at once. Ask one question, react to the answer, then ask the next.`

	// The full interview methodology prompt
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
1. First check if they already exist using \`list_singles\`
2. If they exist, retrieve their profile with \`get_person\` and assess completeness
3. If they don't exist OR their profile is incomplete, begin the interview

**If no name is mentioned:**
1. Ask: "Tell me about the person you're trying to match"
2. Get their name first, then check the database
3. Proceed with interview as needed

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

1. Use \`add_person\` to create their profile
2. Use \`update_person\` to add all the details including comprehensive notes
3. Use \`find_matches\` to see potential matches
4. Present matches to the matchmaker conversationally

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
				instructions: SERVER_INSTRUCTIONS,
			},
			{
				capabilities: {
					tools: {},
					prompts: {},
				},
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

		// Register tools - these tools call the internal API routes
		server.setRequestHandler(ListToolsRequestSchema, async () => ({
			tools: [
				{
					name: 'add_person',
					description:
						'Add a person ONLY after having a full conversation with the matchmaker. If you have not asked multiple back-and-forth questions about age, location, why they are single, relationship history, physical description, and preferences, DO NOT use this tool yet. Go back and have the conversation first.',
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
					description: 'List all people in the matchmaker database. Use this FIRST when someone mentions wanting to match a person by name - check if they already exist before starting an interview.',
					inputSchema: {
						type: 'object',
						properties: {},
					},
				},
				{
					name: 'get_person',
					description: 'Retrieve detailed profile for a person. Use to review if their profile is complete before finding matches. A complete profile has: age, location, gender, relationship history, physical description, preferences, and deal breakers in the notes field.',
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
					description: "Update a person's profile with interview data. The notes field should contain the FULL interview intelligence including: why they're single (matchmaker's diagnosis), relationship history, physical description (height, build, fitness), stated preferences, non-standard deal breakers, expectation assessment, and any red flags detected.",
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
							notes: { type: 'string', description: 'Notes about the person' },
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
		}))

		// Handle tool calls by making direct database calls
		server.setRequestHandler(CallToolRequestSchema, async request => {
			let { name, arguments: args } = request.params

			console.log(`[MCP Tool] Calling tool: ${name} for userId: ${userId}`)
			console.log(`[MCP Tool] Arguments:`, JSON.stringify(args))

			try {
				if (name === 'add_person') {
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
						content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
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
						content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
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
						content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
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
					if (personError) throw new Error(personError.message)

					// Get active people from OTHER matchmakers (not this user's singles)
					// This matches the single against the broader pool, not the user's own list
					let { data: candidates, error: candidatesError } = await supabaseClient
						.from('people')
						.select('*')
						.eq('active', true)
						.neq('id', args.person_id)
						.neq('matchmaker_id', userId)  // Exclude this user's singles
					if (candidatesError) throw new Error(candidatesError.message)

					console.log(`[MCP find_matches] Found ${candidates?.length || 0} candidates from other matchmakers for person ${args.person_id}`)

					// Simple matching - return candidates with compatibility score
					let matches = (candidates || []).map(candidate => ({
						person: candidate,
						compatibility_score: Math.random(), // Placeholder - TODO: implement real matching algorithm
						reasons: ['Both are active singles in the system'],
					}))
					return {
						content: [{ type: 'text', text: JSON.stringify(matches, null, 2) }],
					}
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
