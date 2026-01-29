import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { loadConfig } from './config.js'
import { ApiClient } from './api.js'
import { createToolHandlers, isValidToolName } from './handlers.js'

export function createServer(apiClient: ApiClient) {
	let server = new Server(
		{
			name: 'matchmaker-mcp',
			version: '1.0.0',
		},
		{
			capabilities: {
				tools: {},
			},
		}
	)

	// Register tools
	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: [
			{
				name: 'start_intake_interview',
				description: 'MANDATORY FIRST STEP. When a user says "match", "help find a partner", "add someone", or mentions wanting to help a friend/family member find love - call this tool IMMEDIATELY. Do NOT call list_people, get_person, or any other tool first. This returns the interview script you must follow to gather information conversationally.',
				inputSchema: {
					type: 'object',
					properties: {
						single_name: {
							type: 'string',
							description: 'Name of the single person to be matched (optional - can be gathered during interview)'
						},
					},
					required: [],
				},
			},
			{
				name: 'add_person',
				description: 'Store a new single in the database AFTER completing the intake interview via start_intake_interview. Never use this as a first step.',
				inputSchema: {
					type: 'object',
					properties: {
						name: { type: 'string', description: 'Person name' },
					},
					required: ['name'],
				},
			},
			{
				name: 'list_people',
				description: 'ADMIN ONLY. Lists singles in database. NEVER use this when user says they want to "match someone" or "help a friend" - those requests require start_intake_interview FIRST. Only use list_people for explicit admin requests like "show me everyone in the system".',
				inputSchema: {
					type: 'object',
					properties: {},
				},
			},
			{
				name: 'get_person',
				description: 'Retrieve details for an existing person by ID. Not for intake - use start_intake_interview when someone wants to match a new person.',
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
				description: "Update a person's profile information",
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

	// Create tool handlers with discriminated union pattern
	let toolHandlers = createToolHandlers(apiClient)

	// Handle tool calls using lookup-based dispatch
	server.setRequestHandler(CallToolRequestSchema, async request => {
		let { name, arguments: args } = request.params

		try {
			if (!isValidToolName(name)) {
				throw new Error(`Unknown tool: ${name}`)
			}
			return await toolHandlers[name](args)
		} catch (error) {
			let errorMessage = 'Unknown error'
			if (error instanceof Error) {
				errorMessage = error.message
			} else if (typeof error === 'string') {
				errorMessage = error
			}
			return {
				content: [
					{
						type: 'text',
						text: `Error: ${errorMessage}`,
					},
				],
				isError: true,
			}
		}
	})

	return server
}

async function runServer() {
	let config = await loadConfig()
	let apiClient = new ApiClient(config)
	let server = createServer(apiClient)
	let transport = new StdioServerTransport()

	// Set up signal handlers for graceful shutdown
	let shutdown = async () => {
		console.error('Shutting down MCP server...')
		await transport.close()
		process.exit(0)
	}

	process.on('SIGTERM', shutdown)
	process.on('SIGINT', shutdown)

	// Connect and start listening
	await server.connect(transport)
	console.error('MCP Server running on stdio')
}

// Run server with error handling
if (import.meta.main) {
	runServer().catch(error => {
		console.error('Fatal error in MCP server:', error)
		process.exit(1)
	})
}
