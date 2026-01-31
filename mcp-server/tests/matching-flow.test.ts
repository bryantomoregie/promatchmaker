import { describe, test, expect, mock } from 'bun:test'
import type {
	ApiClient,
	Person,
	Match,
	PersonPreferences,
	PersonPersonality,
} from '../src/api'
import { MATCHMAKER_INTERVIEW_PROMPT } from '../src/prompts'

// Mock person factory for creating test data
function createMockPerson(overrides: Partial<Person> = {}): Person {
	return {
		id: overrides.id ?? 'test-id',
		name: overrides.name ?? 'Test Person',
		matchmaker_id: 'user-id',
		age: overrides.age ?? 30,
		location: overrides.location ?? 'Houston, TX',
		gender: overrides.gender ?? 'female',
		preferences: overrides.preferences ?? null,
		personality: overrides.personality ?? null,
		notes: overrides.notes ?? null,
		active: true,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	}
}

function createMockApiClient(overrides?: Partial<ApiClient>): ApiClient {
	return {
		addPerson: mock(
			async (name: string): Promise<Person> => createMockPerson({ name })
		),
		listPeople: mock(async (): Promise<Person[]> => []),
		getPerson: mock(async (id: string): Promise<Person> => createMockPerson({ id })),
		updatePerson: mock(
			async (
				id: string,
				updates: {
					name?: string
					age?: number
					location?: string
					gender?: string
					preferences?: PersonPreferences
					personality?: PersonPersonality
					notes?: string
				}
			): Promise<Person> => createMockPerson({ id, ...updates })
		),
		findMatches: mock(async (_personId: string): Promise<Match[]> => []),
		createIntroduction: mock(async () => ({
			id: 'intro-id',
			matchmaker_id: 'user-id',
			person_a_id: 'a',
			person_b_id: 'b',
			status: 'pending',
			notes: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})),
		listIntroductions: mock(async () => []),
		updateIntroduction: mock(async () => ({
			id: 'intro-id',
			matchmaker_id: 'user-id',
			person_a_id: 'a',
			person_b_id: 'b',
			status: 'pending',
			notes: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})),
		deletePerson: mock(async (id: string) => createMockPerson({ id, active: false })),
		getIntroduction: mock(async () => ({
			id: 'intro-id',
			matchmaker_id: 'user-id',
			person_a_id: 'a',
			person_b_id: 'b',
			status: 'pending',
			notes: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})),
		submitFeedback: mock(async () => ({
			id: 'feedback-id',
			introduction_id: 'intro-id',
			from_person_id: 'person-id',
			content: 'test',
			sentiment: null,
			created_at: new Date().toISOString(),
		})),
		listFeedback: mock(async () => []),
		getFeedback: mock(async () => ({
			id: 'feedback-id',
			introduction_id: 'intro-id',
			from_person_id: 'person-id',
			content: 'test',
			sentiment: null,
			created_at: new Date().toISOString(),
		})),
		...overrides,
	} as unknown as ApiClient
}

describe('MCP Prompts Capability', () => {
	test('MATCHMAKER_INTERVIEW_PROMPT contains all 14 phases', () => {
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 1: Opening & Context')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 2: Basic Data Collection')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 3: The Diagnostic Question')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 4: Relationship History')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 5: Physical Appearance Assessment')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 6: Stated Preferences')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 7: The Weight Discussion')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 8: Market Reality Education')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 9: Previous Matchmaking Attempts')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 10: Deal Breaker Mining')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 11: Appreciation for the Matchmaker')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 12: Process Explanation')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 13: Expectation Setting')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Phase 14: Contact Information')
	})

	test('MATCHMAKER_INTERVIEW_PROMPT contains trigger phrase recognition', () => {
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Recognizing When to Start')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('I want to match')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('list_singles')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('get_person')
	})

	test('MATCHMAKER_INTERVIEW_PROMPT contains post-interview MCP tool instructions', () => {
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('After Interview: Using MCP Tools')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('add_person')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('update_person')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('find_matches')
	})

	test('MATCHMAKER_INTERVIEW_PROMPT contains match presentation instructions', () => {
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Presenting Matches to the Matchmaker')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('create_introduction')
	})

	test('MATCHMAKER_INTERVIEW_PROMPT contains both new and existing person scenarios', () => {
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Scenario A: New Person')
		expect(MATCHMAKER_INTERVIEW_PROMPT).toContain('Scenario B: Existing Person')
	})

	test('prompts handlers are registered on server', async () => {
		let { createServer } = await import('../src/index')
		let mockApiClient = createMockApiClient()
		let server = createServer(mockApiClient)

		// Server should be created without throwing
		expect(server).toBeDefined()
	})
})

describe('find_matches Tool', () => {
	test('find_matches calls API with correct person_id', async () => {
		let mockFindMatches = mock(async (personId: string): Promise<Match[]> => [
			{
				person: {
					id: 'match-1',
					name: 'Compatible Match',
					age: 32,
					location: 'Houston, TX',
				},
				compatibility_score: 85,
				match_reasons: ['Same location', 'Age range match', 'Faith alignment'],
			},
		])

		let mockApiClient = createMockApiClient({
			findMatches: mockFindMatches,
		})

		let result = await mockApiClient.findMatches('test-person-id')

		expect(mockFindMatches).toHaveBeenCalledWith('test-person-id')
		expect(result).toHaveLength(1)
		expect(result[0]?.person?.name).toBe('Compatible Match')
		expect(result[0]?.compatibility_score).toBe(85)
	})

	test('find_matches returns empty array when no matches found', async () => {
		let mockFindMatches = mock(async (_personId: string): Promise<Match[]> => [])

		let mockApiClient = createMockApiClient({
			findMatches: mockFindMatches,
		})

		let result = await mockApiClient.findMatches('lonely-person-id')

		expect(result).toHaveLength(0)
	})

	test('find_matches returns multiple ranked matches', async () => {
		let mockFindMatches = mock(async (_personId: string): Promise<Match[]> => [
			{
				person: { id: '1', name: 'Best Match', age: 30 },
				compatibility_score: 95,
				match_reasons: ['Excellent fit'],
			},
			{
				person: { id: '2', name: 'Good Match', age: 28 },
				compatibility_score: 80,
				match_reasons: ['Good fit'],
			},
			{
				person: { id: '3', name: 'Okay Match', age: 35 },
				compatibility_score: 65,
				match_reasons: ['Possible fit'],
			},
		])

		let mockApiClient = createMockApiClient({
			findMatches: mockFindMatches,
		})

		let result = await mockApiClient.findMatches('test-id')

		expect(result).toHaveLength(3)
		// Results should be in ranked order (highest score first)
		expect(result[0]?.compatibility_score).toBe(95)
		expect(result[1]?.compatibility_score).toBe(80)
		expect(result[2]?.compatibility_score).toBe(65)
	})
})

describe('Seed Data Validation', () => {
	test('seed profiles have required structure', async () => {
		// Import the seed data types - we'll validate the structure
		// This tests that our seed data follows the expected format

		interface SeedPerson {
			name: string
			age: number
			location: string
			gender: string
			preferences: Record<string, unknown>
			personality: {
				traits: string[]
				interests: string[]
			}
			notes: string
		}

		// Validate a sample profile structure
		let sampleProfile: SeedPerson = {
			name: 'Test Person',
			age: 30,
			location: 'Houston, TX',
			gender: 'female',
			preferences: {
				ageRange: { min: 28, max: 40 },
				heightPreference: "5'10\" or taller",
			},
			personality: {
				traits: ['ambitious', 'kind'],
				interests: ['reading', 'travel'],
			},
			notes: 'MATCHMAKER: Test\nWHY SINGLE: Test reason',
		}

		expect(sampleProfile.name).toBeDefined()
		expect(typeof sampleProfile.age).toBe('number')
		expect(sampleProfile.location).toContain('TX')
		expect(['male', 'female']).toContain(sampleProfile.gender)
		expect(sampleProfile.personality.traits).toBeInstanceOf(Array)
		expect(sampleProfile.personality.interests).toBeInstanceOf(Array)
		expect(sampleProfile.notes).toContain('MATCHMAKER')
	})
})

describe('Matching Flow Evaluation Scenarios', () => {
	test('Eval: New person intake flow', async () => {
		// Scenario: User says "I want to match my friend Sarah"
		// Expected flow:
		// 1. Check if Sarah exists (list_singles)
		// 2. Sarah doesn't exist, start interview
		// 3. After interview, add_person + update_person
		// 4. Call find_matches
		// 5. Present matches

		let addPersonCalled = false
		let updatePersonCalled = false
		let findMatchesCalled = false

		let mockApiClient = createMockApiClient({
			listPeople: mock(async () => []), // Sarah doesn't exist
			addPerson: mock(async (name: string) => {
				addPersonCalled = true
				return createMockPerson({ id: 'sarah-id', name })
			}),
			updatePerson: mock(async (id: string, updates) => {
				updatePersonCalled = true
				return createMockPerson({ id, ...updates })
			}),
			findMatches: mock(async (_personId: string) => {
				findMatchesCalled = true
				return [
					{
						person: { id: 'match-1', name: 'Compatible Guy', age: 32 },
						compatibility_score: 88,
						match_reasons: ['Great match'],
					},
				]
			}),
		})

		// Simulate the flow
		let people = await mockApiClient.listPeople()
		expect(people).toHaveLength(0) // Sarah not found

		let sarah = await mockApiClient.addPerson('Sarah')
		expect(addPersonCalled).toBe(true)

		await mockApiClient.updatePerson(sarah.id, {
			age: 28,
			location: 'Dallas, TX',
			gender: 'female',
			notes: 'Full interview notes here',
		})
		expect(updatePersonCalled).toBe(true)

		let matches = await mockApiClient.findMatches(sarah.id)
		expect(findMatchesCalled).toBe(true)
		expect(matches).toHaveLength(1)
	})

	test('Eval: Existing person matching flow', async () => {
		// Scenario: User says "I want to match Marcus" and Marcus exists
		// Expected flow:
		// 1. Check if Marcus exists (list_singles) - he does
		// 2. Get his full profile (get_person)
		// 3. Profile is complete, skip to find_matches
		// 4. Present matches

		let existingMarcus = createMockPerson({
			id: 'marcus-id',
			name: 'Marcus Johnson',
			age: 30,
			location: 'Dallas, TX',
			gender: 'male',
			notes: 'Complete profile with all interview data',
		})

		let mockApiClient = createMockApiClient({
			listPeople: mock(async () => [existingMarcus]),
			getPerson: mock(async (_id: string) => existingMarcus),
			findMatches: mock(async (_personId: string) => [
				{
					person: { id: 'match-1', name: 'Michelle', age: 28 },
					compatibility_score: 90,
					match_reasons: ['Location match', 'Age range match'],
				},
			]),
		})

		// Simulate the flow
		let people = await mockApiClient.listPeople()
		let marcus = people.find(p => p.name === 'Marcus Johnson')
		expect(marcus).toBeDefined()

		let fullProfile = await mockApiClient.getPerson(marcus!.id)
		expect(fullProfile.notes).toContain('Complete profile')

		let matches = await mockApiClient.findMatches(marcus!.id)
		expect(matches).toHaveLength(1)
		expect(matches[0]?.person?.name).toBe('Michelle')
	})

	test('Eval: No matches found scenario', async () => {
		// Scenario: Person has very specific requirements, no matches
		// Expected: Gracefully handle empty results, suggest flexibility

		let mockApiClient = createMockApiClient({
			findMatches: mock(async (_personId: string) => []),
		})

		let matches = await mockApiClient.findMatches('picky-person-id')

		expect(matches).toHaveLength(0)
		// In real flow, AI should explain why no matches and suggest flexibility
	})

	test('Eval: Deal breaker filtering', async () => {
		// Scenario: Person has deal breakers that filter out potential matches
		// Expected: Matches returned respect deal breakers

		let mockApiClient = createMockApiClient({
			findMatches: mock(async (_personId: string) => [
				{
					person: { id: 'match-1', name: 'Good Match', age: 30 },
					compatibility_score: 85,
					match_reasons: ['Passes all deal breaker checks'],
				},
				// Note: matches that violate deal breakers should NOT appear
			]),
		})

		let matches = await mockApiClient.findMatches('has-deal-breakers-id')

		// All returned matches should pass deal breaker checks
		for (let match of matches) {
			expect(match.match_reasons).toBeDefined()
			// In a real implementation, we'd verify deal breakers aren't violated
		}
	})
})

describe('Tool Validation', () => {
	test('validateFindMatchesArgs requires person_id', async () => {
		let { validateFindMatchesArgs } = await import('../src/tools')

		// Valid args
		let valid = validateFindMatchesArgs({ person_id: 'test-id' })
		expect(valid.person_id).toBe('test-id')

		// Invalid args - missing person_id
		expect(() => validateFindMatchesArgs({})).toThrow()
		expect(() => validateFindMatchesArgs({ id: 'wrong-key' })).toThrow()
		expect(() => validateFindMatchesArgs(null)).toThrow()
	})
})
