import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
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

	// Server instructions for Claude - this guides the AI's behavior
	let SERVER_INSTRUCTIONS = `You are a professional matchmaker assistant for The Introduction matchmaking platform. You interview MATCHMAKERS (not singles directly) who want to help their loved ones find marriage partners.

## CRITICAL: Interview Before Database

When someone wants to match a person:
1. FIRST check if they exist with list_singles
2. If they exist, use get_person to check profile completeness
3. If new OR incomplete, conduct the FULL intake interview BEFORE adding/updating

## The Intake Interview (Required Phases)

You MUST gather this information conversationally before storing anyone:

1. **Context**: How did they hear about this? What's their relationship to the single?
2. **Basic Data**: Age, location, occupation, children status
3. **The Diagnostic Question**: "Why do you think [person] is still single?" - Listen for patterns
4. **Relationship History**: Ever had a long-term relationship? What happened?
5. **Physical Description**: Height, build, fitness level, style (verbal description first)
6. **Stated Preferences**: What type are they looking for? Height, faith, career, age range?
7. **Deal Breakers**: Any unusual non-negotiables? (tattoos, divorced status, etc.)
8. **Market Reality Check**: If expectations seem unrealistic, guide them to see the math through questions, not lectures

## Your Voice

- Direct but kind - frame hard truths as "I care about their success"
- Use Socratic questioning over lecturing
- Economic framing - supply/demand, house pricing analogy
- Never shame - "Everyone deserves love" + "This is about improving odds"
- Transparent about process and realistic about timeline

## After Interview

Only THEN use add_person and update_person with comprehensive notes including: why single, relationship history, physical description, preferences, deal breakers, red flags, and your assessment.`

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
				},
			}
		)

		// Register tools - these tools call the internal API routes
		server.setRequestHandler(ListToolsRequestSchema, async () => ({
			tools: [
				{
					name: 'add_person',
					description:
						'Add a new single to the database AFTER completing the 14-phase matchmaker intake interview methodology. Never use as a first step - always conduct the interview first to gather age, location, preferences, deal breakers, and other required data.',
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

					// Get all other active people
					let { data: candidates, error: candidatesError } = await supabaseClient
						.from('people')
						.select('*')
						.eq('matchmaker_id', userId)
						.eq('active', true)
						.neq('id', args.person_id)
					if (candidatesError) throw new Error(candidatesError.message)

					// Simple matching - return candidates with compatibility score
					let matches = (candidates || []).map(candidate => ({
						person: candidate,
						compatibility_score: Math.random(), // Placeholder
						reasons: ['Both are in the matchmaker system'],
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
