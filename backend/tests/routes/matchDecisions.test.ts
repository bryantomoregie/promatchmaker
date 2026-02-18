import { describe, test, expect, mock } from 'bun:test'
import { Hono } from 'hono'
import { createMatchDecisionsRoutes } from '../../src/routes/matchDecisions'
import { createMockSupabaseClient } from '../mocks/supabase'

type Variables = {
	userId: string
}

type ErrorResponse = {
	error: string
}

let mockUserId = '550e8400-e29b-41d4-a716-446655440000'
let mockPersonId = '650e8400-e29b-41d4-a716-446655440001'
let mockCandidateId = '750e8400-e29b-41d4-a716-446655440002'

let mockDecision = {
	id: '850e8400-e29b-41d4-a716-446655440003',
	matchmaker_id: mockUserId,
	person_id: mockPersonId,
	candidate_id: mockCandidateId,
	decision: 'declined',
	decline_reason: 'too many tattoos',
	created_at: new Date().toISOString(),
}

let createApp = (mockClient: ReturnType<typeof createMockSupabaseClient>) => {
	let app = new Hono<{ Variables: Variables }>()
	app.use('*', async (c, next) => {
		c.set('userId', mockUserId)
		await next()
	})
	app.route('/', createMatchDecisionsRoutes(mockClient))
	return app
}

let mockOwnershipCheck = (person: { id: string } | null = { id: mockPersonId }) =>
	mock(() => ({
		eq: mock(() => ({
			eq: mock(() => ({
				maybeSingle: mock(() => ({
					data: person,
					error: null,
				})),
			})),
		})),
	}))

describe('POST /api/match-decisions', () => {
	test('should create a decision and return 201', async () => {
		let upsertMock = mock((_data: unknown, _opts: unknown) => ({
			select: mock(() => ({
				single: mock(() => ({
					data: mockDecision,
					error: null,
				})),
			})),
		}))

		let mockClient = createMockSupabaseClient({
			from: mock((table: string) => {
				if (table === 'people') {
					return { select: mockOwnershipCheck() }
				}
				return { upsert: upsertMock }
			}),
		})

		let app = createApp(mockClient)

		let res = await app.fetch(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					person_id: mockPersonId,
					candidate_id: mockCandidateId,
					decision: 'declined',
					decline_reason: 'too many tattoos',
				}),
			})
		)

		let json = await res.json()

		expect(res.status).toBe(201)
		expect(json).toEqual(mockDecision)
	})

	test('should return 400 for invalid decision value', async () => {
		let mockClient = createMockSupabaseClient()

		let app = createApp(mockClient)

		let res = await app.fetch(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					person_id: mockPersonId,
					candidate_id: mockCandidateId,
					decision: 'maybe',
				}),
			})
		)

		expect(res.status).toBe(400)
	})

	test('should return 400 when person_id is missing', async () => {
		let mockClient = createMockSupabaseClient()

		let app = createApp(mockClient)

		let res = await app.fetch(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					candidate_id: mockCandidateId,
					decision: 'declined',
				}),
			})
		)

		expect(res.status).toBe(400)
	})

	test('should set matchmaker_id from auth context', async () => {
		let upsertedData: unknown = null
		let upsertMock = mock((data: unknown, _opts: unknown) => {
			upsertedData = data
			return {
				select: mock(() => ({
					single: mock(() => ({
						data: mockDecision,
						error: null,
					})),
				})),
			}
		})

		let mockClient = createMockSupabaseClient({
			from: mock((table: string) => {
				if (table === 'people') {
					return { select: mockOwnershipCheck() }
				}
				return { upsert: upsertMock }
			}),
		})

		let app = createApp(mockClient)

		await app.fetch(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					person_id: mockPersonId,
					candidate_id: mockCandidateId,
					decision: 'accepted',
				}),
			})
		)

		expect(upsertedData).toEqual(
			expect.objectContaining({
				matchmaker_id: mockUserId,
			})
		)
	})

	test('should return 404 when person is not owned by matchmaker', async () => {
		let mockClient = createMockSupabaseClient({
			from: mock((table: string) => {
				if (table === 'people') {
					return { select: mockOwnershipCheck(null) }
				}
				return {}
			}),
		})

		let app = createApp(mockClient)

		let res = await app.fetch(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					person_id: mockPersonId,
					candidate_id: mockCandidateId,
					decision: 'declined',
					decline_reason: 'test',
				}),
			})
		)

		let json = (await res.json()) as ErrorResponse

		expect(res.status).toBe(404)
		expect(json.error).toBe('Person not found or not owned by you')
	})

	test('should return 500 when Supabase upsert fails', async () => {
		let mockClient = createMockSupabaseClient({
			from: mock((table: string) => {
				if (table === 'people') {
					return { select: mockOwnershipCheck() }
				}
				return {
					upsert: mock((_data: unknown, _opts: unknown) => ({
						select: mock(() => ({
							single: mock(() => ({
								data: null,
								error: { message: 'Unique constraint violated' },
							})),
						})),
					})),
				}
			}),
		})

		let app = createApp(mockClient)

		let res = await app.fetch(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					person_id: mockPersonId,
					candidate_id: mockCandidateId,
					decision: 'declined',
					decline_reason: 'test',
				}),
			})
		)

		let json = (await res.json()) as ErrorResponse

		expect(res.status).toBe(500)
		expect(json.error).toBeDefined()
	})
})

describe('GET /api/match-decisions/:personId', () => {
	test('should return decisions for a person', async () => {
		let decisions = [mockDecision]

		let mockClient = createMockSupabaseClient({
			from: mock((table: string) => {
				if (table === 'people') {
					return { select: mockOwnershipCheck() }
				}
				return {
					select: mock((_columns: string) => ({
						eq: mock((_column: string, _value: unknown) => ({
							eq: mock(() => ({
								data: decisions,
								error: null,
							})),
						})),
					})),
				}
			}),
		})

		let app = createApp(mockClient)

		let res = await app.fetch(new Request(`http://localhost/${mockPersonId}`))
		let json = await res.json()

		expect(res.status).toBe(200)
		expect(Array.isArray(json)).toBe(true)
		expect(json).toHaveLength(1)
		expect(json[0].decision).toBe('declined')
		expect(json[0].decline_reason).toBe('too many tattoos')
	})

	test('should return 404 when person is not owned by matchmaker', async () => {
		let mockClient = createMockSupabaseClient({
			from: mock((table: string) => {
				if (table === 'people') {
					return { select: mockOwnershipCheck(null) }
				}
				return {}
			}),
		})

		let app = createApp(mockClient)

		let res = await app.fetch(new Request(`http://localhost/${mockPersonId}`))
		let json = (await res.json()) as ErrorResponse

		expect(res.status).toBe(404)
		expect(json.error).toBe('Person not found or not owned by you')
	})

	test('should return empty array when no decisions exist', async () => {
		let mockClient = createMockSupabaseClient({
			from: mock((table: string) => {
				if (table === 'people') {
					return { select: mockOwnershipCheck() }
				}
				return {
					select: mock((_columns: string) => ({
						eq: mock((_column: string, _value: unknown) => ({
							eq: mock(() => ({
								data: [],
								error: null,
							})),
						})),
					})),
				}
			}),
		})

		let app = createApp(mockClient)

		let res = await app.fetch(new Request(`http://localhost/${mockPersonId}`))
		let json = await res.json()

		expect(res.status).toBe(200)
		expect(json).toEqual([])
	})

	test('should return 500 when Supabase query fails', async () => {
		let mockClient = createMockSupabaseClient({
			from: mock((table: string) => {
				if (table === 'people') {
					return { select: mockOwnershipCheck() }
				}
				return {
					select: mock((_columns: string) => ({
						eq: mock((_column: string, _value: unknown) => ({
							eq: mock(() => ({
								data: null,
								error: { message: 'Database error' },
							})),
						})),
					})),
				}
			}),
		})

		let app = createApp(mockClient)

		let res = await app.fetch(new Request(`http://localhost/${mockPersonId}`))
		let json = (await res.json()) as ErrorResponse

		expect(res.status).toBe(500)
		expect(json.error).toBe('Database error')
	})
})
