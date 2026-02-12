import { describe, test, expect } from 'bun:test'
import { findMatches } from '../../src/services/matchingAlgorithm'
import type { PersonResponse } from '../../src/schemas/people'

let matchmakerId = '750e8400-e29b-41d4-a716-446655440002'
let otherMatchmakerId = '999e8400-e29b-41d4-a716-446655440099'

let makePerson = (overrides: Partial<PersonResponse> = {}): PersonResponse => ({
	id: '650e8400-e29b-41d4-a716-446655440001',
	matchmaker_id: matchmakerId,
	name: 'Alice',
	age: 28,
	location: 'NYC',
	gender: 'female',
	preferences: null,
	personality: null,
	notes: 'Private notes about Alice',
	active: true,
	created_at: new Date().toISOString(),
	updated_at: new Date().toISOString(),
	...overrides,
})

describe('findMatches', () => {
	let subject = makePerson({
		id: '550e8400-e29b-41d4-a716-446655440000',
		name: 'Sarah',
		age: 27,
		location: 'NYC',
		gender: 'female',
	})

	test('should return candidates excluding the subject person', () => {
		let candidates = [
			subject,
			makePerson({ id: '111e8400-e29b-41d4-a716-446655440011', name: 'Bob', age: 30, gender: 'male' }),
		]

		let matches = findMatches(subject, candidates, matchmakerId)

		expect(matches).toHaveLength(1)
		expect(matches[0].person.name).toBe('Bob')
	})

	test('should exclude inactive people', () => {
		let candidates = [
			makePerson({ id: '111e8400-e29b-41d4-a716-446655440011', name: 'Bob', active: false }),
		]

		let matches = findMatches(subject, candidates, matchmakerId)

		expect(matches).toHaveLength(0)
	})

	test('should flag is_cross_matchmaker correctly for same matchmaker', () => {
		let candidates = [
			makePerson({
				id: '111e8400-e29b-41d4-a716-446655440011',
				name: 'Bob',
				matchmaker_id: matchmakerId,
			}),
		]

		let matches = findMatches(subject, candidates, matchmakerId)

		expect(matches).toHaveLength(1)
		expect(matches[0].is_cross_matchmaker).toBe(false)
	})

	test('should flag is_cross_matchmaker correctly for different matchmaker', () => {
		let candidates = [
			makePerson({
				id: '111e8400-e29b-41d4-a716-446655440011',
				name: 'Bob',
				matchmaker_id: otherMatchmakerId,
			}),
		]

		let matches = findMatches(subject, candidates, matchmakerId)

		expect(matches).toHaveLength(1)
		expect(matches[0].is_cross_matchmaker).toBe(true)
	})

	test('should strip sensitive fields from cross-matchmaker results', () => {
		let candidates = [
			makePerson({
				id: '111e8400-e29b-41d4-a716-446655440011',
				name: 'Bob',
				matchmaker_id: otherMatchmakerId,
				notes: 'Secret notes',
				preferences: { likes: 'hiking' },
				personality: { type: 'introvert' },
			}),
		]

		let matches = findMatches(subject, candidates, matchmakerId)

		expect(matches).toHaveLength(1)
		let person = matches[0].person
		expect(person.id).toBeDefined()
		expect(person.name).toBe('Bob')
		expect(person.age).toBeDefined()
		expect(person.location).toBeDefined()
		expect(person.gender).toBeDefined()
		// Should NOT have sensitive fields
		expect('notes' in person).toBe(false)
		expect('preferences' in person).toBe(false)
		expect('personality' in person).toBe(false)
		expect('matchmaker_id' in person).toBe(false)
	})

	test('should include match_explanation string', () => {
		let candidates = [
			makePerson({
				id: '111e8400-e29b-41d4-a716-446655440011',
				name: 'Bob',
				age: 30,
				location: 'NYC',
				gender: 'male',
			}),
		]

		let matches = findMatches(subject, candidates, matchmakerId)

		expect(matches).toHaveLength(1)
		expect(typeof matches[0].match_explanation).toBe('string')
		expect(matches[0].match_explanation.length).toBeGreaterThan(0)
	})

	test('should include compatibility_score as a number', () => {
		let candidates = [
			makePerson({
				id: '111e8400-e29b-41d4-a716-446655440011',
				name: 'Bob',
			}),
		]

		let matches = findMatches(subject, candidates, matchmakerId)

		expect(matches).toHaveLength(1)
		expect(typeof matches[0].compatibility_score).toBe('number')
		expect(matches[0].compatibility_score).toBeGreaterThanOrEqual(0)
		expect(matches[0].compatibility_score).toBeLessThanOrEqual(1)
	})

	test('should score higher for same location', () => {
		let candidates = [
			makePerson({
				id: '111e8400-e29b-41d4-a716-446655440011',
				name: 'Bob',
				location: 'NYC',
				age: 30,
			}),
			makePerson({
				id: '222e8400-e29b-41d4-a716-446655440022',
				name: 'Charlie',
				location: 'LA',
				age: 30,
			}),
		]

		let matches = findMatches(subject, candidates, matchmakerId)

		expect(matches).toHaveLength(2)
		// NYC match should score higher than LA match
		let bobMatch = matches.find(m => m.person.name === 'Bob')!
		let charlieMatch = matches.find(m => m.person.name === 'Charlie')!
		expect(bobMatch.compatibility_score).toBeGreaterThan(charlieMatch.compatibility_score)
	})

	test('should sort results by compatibility_score descending', () => {
		let candidates = [
			makePerson({
				id: '222e8400-e29b-41d4-a716-446655440022',
				name: 'Charlie',
				location: 'LA',
				age: 45,
			}),
			makePerson({
				id: '111e8400-e29b-41d4-a716-446655440011',
				name: 'Bob',
				location: 'NYC',
				age: 29,
			}),
		]

		let matches = findMatches(subject, candidates, matchmakerId)

		expect(matches).toHaveLength(2)
		expect(matches[0].compatibility_score).toBeGreaterThanOrEqual(matches[1].compatibility_score)
	})

	test('should return empty array when no candidates', () => {
		let matches = findMatches(subject, [], matchmakerId)
		expect(matches).toHaveLength(0)
	})

	test('should include location in explanation when locations match', () => {
		let candidates = [
			makePerson({
				id: '111e8400-e29b-41d4-a716-446655440011',
				name: 'Bob',
				location: 'NYC',
			}),
		]

		let matches = findMatches(subject, candidates, matchmakerId)

		expect(matches[0].match_explanation).toContain('NYC')
	})
})
