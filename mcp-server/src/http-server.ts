import { createServer as createHttpServer } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer } from './index.js'
import { createClient } from '@supabase/supabase-js'

// Direct Supabase client for the HTTP MCP server
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
	console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
	process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Create a direct API client that talks to Supabase
class DirectApiClient {
	async addPerson(name: string) {
		const { data, error } = await supabase
			.from('people')
			.insert({ name, matchmaker_id: await this.getDefaultMatchmakerId() })
			.select()
			.single()
		if (error) throw new Error(error.message)
		return data
	}

	async listPeople() {
		const { data, error } = await supabase.from('people').select('*').eq('active', true)
		if (error) throw new Error(error.message)
		return data || []
	}

	async getPerson(id: string) {
		const { data, error } = await supabase.from('people').select('*').eq('id', id).single()
		if (error) throw new Error(error.message)
		return data
	}

	async updatePerson(id: string, updates: Record<string, unknown>) {
		const { data, error } = await supabase.from('people').update(updates).eq('id', id).select().single()
		if (error) throw new Error(error.message)
		return data
	}

	async createIntroduction(person_a_id: string, person_b_id: string, notes?: string) {
		const { data, error } = await supabase
			.from('introductions')
			.insert({
				person_a_id,
				person_b_id,
				notes,
				matchmaker_id: await this.getDefaultMatchmakerId(),
			})
			.select()
			.single()
		if (error) throw new Error(error.message)
		return data
	}

	async listIntroductions() {
		const { data, error } = await supabase.from('introductions').select('*')
		if (error) throw new Error(error.message)
		return data || []
	}

	async updateIntroduction(id: string, updates: Record<string, unknown>) {
		const { data, error } = await supabase.from('introductions').update(updates).eq('id', id).select().single()
		if (error) throw new Error(error.message)
		return data
	}

	async findMatches(personId: string) {
		// Get the person to find matches for
		const person = await this.getPerson(personId)
		if (!person) throw new Error('Person not found')

		// Get all other active people
		const { data: people, error } = await supabase
			.from('people')
			.select('*')
			.eq('active', true)
			.neq('id', personId)
		if (error) throw new Error(error.message)

		// Simple matching: return all people with basic compatibility info
		return (people || []).map(p => ({
			person: { id: p.id, name: p.name, age: p.age, location: p.location },
			compatibility_score: 0.5,
			match_reasons: ['Available for matching'],
		}))
	}

	async deletePerson(id: string) {
		const { data, error } = await supabase
			.from('people')
			.update({ active: false })
			.eq('id', id)
			.select()
			.single()
		if (error) throw new Error(error.message)
		return data
	}

	async getIntroduction(id: string) {
		const { data, error } = await supabase.from('introductions').select('*').eq('id', id).single()
		if (error) throw new Error(error.message)
		return data
	}

	async submitFeedback(introduction_id: string, from_person_id: string, content: string, sentiment?: string) {
		const { data, error } = await supabase
			.from('feedback')
			.insert({ introduction_id, from_person_id, content, sentiment })
			.select()
			.single()
		if (error) throw new Error(error.message)
		return data
	}

	async listFeedback(introduction_id: string) {
		const { data, error } = await supabase.from('feedback').select('*').eq('introduction_id', introduction_id)
		if (error) throw new Error(error.message)
		return data || []
	}

	async getFeedback(id: string) {
		const { data, error } = await supabase.from('feedback').select('*').eq('id', id).single()
		if (error) throw new Error(error.message)
		return data
	}

	// Cache the matchmaker ID to avoid repeated lookups
	private cachedMatchmakerId: string | null = null

	// Get or create a default matchmaker for the MCP server
	private async getDefaultMatchmakerId(): Promise<string> {
		// Return cached ID if available
		if (this.cachedMatchmakerId) return this.cachedMatchmakerId

		// Check for existing matchmaker
		const { data: existing } = await supabase.from('matchmakers').select('id').limit(1).single()
		if (existing) {
			this.cachedMatchmakerId = existing.id
			return existing.id
		}

		// Create an auth user first (required because matchmakers.id references auth.users)
		const mcpEmail = 'mcp-server@matchmaker.local'
		const mcpPassword = 'mcp-server-internal-user-' + Date.now()

		const { data: authData, error: authError } = await supabase.auth.admin.createUser({
			email: mcpEmail,
			password: mcpPassword,
			email_confirm: true,
		})

		if (authError) {
			// If user already exists, try to get their ID
			if (authError.message.includes('already been registered')) {
				const { data: users } = await supabase.auth.admin.listUsers()
				const existingUser = users?.users?.find(u => u.email === mcpEmail)
				if (existingUser) {
					// Create matchmaker entry for existing user
					const { data: matchmaker, error: matchmakerError } = await supabase
						.from('matchmakers')
						.insert({ id: existingUser.id, name: 'MCP Server Matchmaker' })
						.select()
						.single()
					if (matchmakerError && !matchmakerError.message.includes('duplicate')) {
						throw new Error(`Failed to create matchmaker: ${matchmakerError.message}`)
					}
					this.cachedMatchmakerId = existingUser.id
					return existingUser.id
				}
			}
			throw new Error(`Failed to create auth user: ${authError.message}`)
		}

		// Create matchmaker entry with the auth user's ID
		const { data: newMatchmaker, error: matchmakerError } = await supabase
			.from('matchmakers')
			.insert({ id: authData.user.id, name: 'MCP Server Matchmaker' })
			.select()
			.single()

		if (matchmakerError) throw new Error(`Failed to create matchmaker: ${matchmakerError.message}`)

		this.cachedMatchmakerId = newMatchmaker.id
		return newMatchmaker.id
	}
}

const apiClient = new DirectApiClient()

// Create transport and server instances - these will be reused
const transport = new StreamableHTTPServerTransport({
	sessionIdGenerator: undefined, // Stateless mode
})

const mcpServer = createServer(apiClient as any)

// Connect server to transport
mcpServer.connect(transport)

const PORT = parseInt(process.env.PORT || '3001', 10)

const httpServer = createHttpServer(async (req, res) => {
	// CORS headers
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id')

	if (req.method === 'OPTIONS') {
		res.writeHead(204)
		res.end()
		return
	}

	// Health check
	if (req.url === '/health' && req.method === 'GET') {
		res.writeHead(200, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ status: 'healthy' }))
		return
	}

	// MCP endpoint
	if (req.url === '/mcp' || req.url === '/') {
		try {
			await transport.handleRequest(req, res)
		} catch (error) {
			console.error('MCP request error:', error)
			if (!res.headersSent) {
				res.writeHead(500, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify({ error: 'Internal server error' }))
			}
		}
		return
	}

	// 404 for other routes
	res.writeHead(404, { 'Content-Type': 'application/json' })
	res.end(JSON.stringify({ error: 'Not found' }))
})

httpServer.listen(PORT, () => {
	console.log(`MCP HTTP Server running on port ${PORT}`)
	console.log(`Health check: http://localhost:${PORT}/health`)
	console.log(`MCP endpoint: http://localhost:${PORT}/mcp`)
})
