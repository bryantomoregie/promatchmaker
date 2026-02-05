import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	ListPromptsRequestSchema,
	GetPromptRequestSchema,
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { loadConfig } from './config.js'
import { ApiClient } from './api.js'
import { createToolHandlers, isValidToolName } from './handlers.js'
import { MATCHMAKER_INTERVIEW_PROMPT } from './prompts.js'
import { UI_RESOURCE_MIME_TYPE, UI_RESOURCE_URI } from './ui.js'
import { readFile } from 'node:fs/promises'

export function createServer(apiClient: ApiClient) {
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
		}
	)

	// Register prompts
	server.setRequestHandler(ListPromptsRequestSchema, async () => ({
		prompts: [
			{
				name: 'matchmaker-intake-interview',
				description:
					'The complete 14-phase intake interview methodology for matchmakers. Use this when someone wants to match a friend/family member. Guides you through gathering all necessary information conversationally.',
				arguments: [
					{
						name: 'single_name',
						description: 'Name of the single person being matched (optional)',
						required: false,
					},
					{
						name: 'matchmaker_name',
						description: 'Name of the matchmaker conducting the referral (optional)',
						required: false,
					},
				],
			},
		],
	}))

	// Register UI resources for ChatGPT apps
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
		if (uri !== UI_RESOURCE_URI) {
			throw new Error(`Unknown resource URI: ${uri}`)
		}

		let html = await readFile(new URL('../ui/discovery.html', import.meta.url), 'utf-8')
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

	server.setRequestHandler(GetPromptRequestSchema, async request => {
		let { name, arguments: args } = request.params

		if (name !== 'matchmaker-intake-interview') {
			throw new Error(`Unknown prompt: ${name}`)
		}

		let singleName = args?.single_name
		let matchmakerName = args?.matchmaker_name

		let contextIntro = ''
		if (singleName || matchmakerName) {
			contextIntro = '## Interview Context\n\n'
			if (matchmakerName) {
				contextIntro += `You are speaking with ${matchmakerName}, who is the matchmaker.\n`
			}
			if (singleName) {
				contextIntro += `They want to help match ${singleName}.\n`
			}
			contextIntro += '\n---\n\n'
		}

		return {
			description: 'Matchmaker intake interview methodology',
			messages: [
				{
					role: 'user',
					content: {
						type: 'text',
						text: contextIntro + MATCHMAKER_INTERVIEW_PROMPT,
					},
				},
			],
		}
	})

	// Register tools
	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: [
			{
				name: 'add_person',
				description:
					'Add a new person to the matchmaker database. Call this IMMEDIATELY when you learn someone\'s name - do NOT wait for the full interview. Only the name is required. Use update_person later to add details as you learn them.',
				_meta: {
					ui: {
						resourceUri: UI_RESOURCE_URI,
					},
				},
				inputSchema: {
					type: 'object',
					properties: {
						name: { type: 'string', description: 'Person name' },
					},
					required: ['name'],
				},
			},
			{
				name: 'get_person',
				description: 'Retrieve detailed profile for an existing person by ID. Use to review a profile or find matching candidates.',
				_meta: {
					ui: {
						resourceUri: UI_RESOURCE_URI,
					},
				},
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
				_meta: {
					ui: {
						resourceUri: UI_RESOURCE_URI,
					},
				},
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
				name: 'find_matches',
				description:
					'Find compatible matches for a person. Returns a ranked list of potential matches based on preferences, location, age range, and deal breakers. Use this after completing an intake interview to suggest matches to the matchmaker.',
				_meta: {
					ui: {
						resourceUri: UI_RESOURCE_URI,
					},
				},
				inputSchema: {
					type: 'object',
					properties: {
						person_id: { type: 'string', description: 'Person ID (UUID) to find matches for' },
					},
					required: ['person_id'],
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
