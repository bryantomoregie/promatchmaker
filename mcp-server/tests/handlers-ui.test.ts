import { describe, test, expect, mock } from 'bun:test'
import type { ApiClient, Match, Person } from '../src/api'
import { createToolHandlers } from '../src/handlers'
import { UI_RESOURCE_URI } from '../src/ui'

function createMockApiClient(overrides?: Partial<ApiClient>): ApiClient {
	return {
		addPerson: mock(async (name: string): Promise<Person> => ({
			id: 'person-1',
			name,
			matchmaker_id: 'matchmaker-1',
			active: true,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})),
		listPeople: mock(async (): Promise<Person[]> => []),
		getPerson: mock(async (id: string): Promise<Person> => ({
			id,
			name: 'Alex',
			matchmaker_id: 'matchmaker-1',
			active: true,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})),
		updatePerson: mock(async (id: string): Promise<Person> => ({
			id,
			name: 'Alex',
			matchmaker_id: 'matchmaker-1',
			active: true,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})),
		findMatches: mock(async (): Promise<Match[]> => [
			{
				person: {
					id: 'match-1',
					name: 'Jordan Lee',
					age: 33,
					location: 'Austin, TX',
					gender: 'female',
					notes: 'She works as a teacher. Very kind.',
				},
				compatibility_score: 0.8,
				match_reasons: ['Shared interests'],
			},
		]),
		createIntroduction: mock(async () => ({
			id: 'intro',
			matchmaker_id: 'matchmaker-1',
			person_a_id: 'a',
			person_b_id: 'b',
			status: 'pending',
			notes: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})),
		listIntroductions: mock(async () => []),
		updateIntroduction: mock(async () => ({
			id: 'intro',
			matchmaker_id: 'matchmaker-1',
			person_a_id: 'a',
			person_b_id: 'b',
			status: 'pending',
			notes: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})),
		deletePerson: mock(async (id: string) => ({
			id,
			name: 'Alex',
			matchmaker_id: 'matchmaker-1',
			active: false,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})),
		getIntroduction: mock(async () => ({
			id: 'intro',
			matchmaker_id: 'matchmaker-1',
			person_a_id: 'a',
			person_b_id: 'b',
			status: 'pending',
			notes: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})),
		submitFeedback: mock(async () => ({
			id: 'feedback',
			introduction_id: 'intro',
			from_person_id: 'person',
			content: 'test',
			sentiment: null,
			created_at: new Date().toISOString(),
		})),
		listFeedback: mock(async () => []),
		getFeedback: mock(async () => ({
			id: 'feedback',
			introduction_id: 'intro',
			from_person_id: 'person',
			content: 'test',
			sentiment: null,
			created_at: new Date().toISOString(),
		})),
		...overrides,
	} as unknown as ApiClient
}

describe('tool handlers emit UI metadata and structuredContent', () => {
	test('add_single returns plain result without UI metadata', async () => {
		let handlers = createToolHandlers(createMockApiClient())
		let result = await handlers.add_single({ name: 'Avery Chen' })

		expect(result._meta).toBeUndefined()
		expect(result.structuredContent).toBeUndefined()
		expect(result.content[0]?.text).toContain('Avery Chen')
	})

	test('find_matches includes UI resource and card data without name', async () => {
		let handlers = createToolHandlers(createMockApiClient())
		let result = await handlers.find_matches({ person_id: 'person-1' })
		let structured = result.structuredContent as any

		expect(result._meta?.ui?.resourceUri).toBe(UI_RESOURCE_URI)
		expect(structured?.view).toBe('match_results')

		let match = structured?.matches?.[0]
		expect(match).not.toHaveProperty('masked')
		expect(match?.age).toBe('30s')
		expect(match?.gender).toBe('female')
		expect(match?.city).toBe('Austin')
		expect(match?.profession).toBe('teacher')
	})
})
