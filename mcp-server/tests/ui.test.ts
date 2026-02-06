import { describe, test, expect } from 'bun:test'
import type { Match, Person } from '../src/api'
import {
	buildMatchStructuredContent,
	buildSingleStructuredContent,
	extractCity,
	extractProfession,
	maskAge,
	maskLocation,
	maskName,
} from '../src/ui'

describe('UI structured content helpers', () => {
	test('maskName masks each word while keeping initials', () => {
		expect(maskName('Jordan Lee')).toBe('J***** L**')
		expect(maskName('A')).toBe('*')
		expect(maskName('')).toBe('Single')
	})

	test('maskAge buckets ages into decades', () => {
		expect(maskAge(31)).toBe('30s')
		expect(maskAge(40)).toBe('40s')
		expect(maskAge(null)).toBe('Age hidden')
	})

	test('maskLocation always hides location', () => {
		expect(maskLocation('Austin, TX')).toBe('Location hidden')
		expect(maskLocation(null)).toBe('Location hidden')
	})

	test('extractCity pulls city from "City, State" format', () => {
		expect(extractCity('Houston, TX')).toBe('Houston')
		expect(extractCity('Austin')).toBe('Austin')
		expect(extractCity(null)).toBeNull()
		expect(extractCity('')).toBeNull()
	})

	test('extractProfession finds profession in notes text', () => {
		expect(extractProfession('He works as a medical doctor and loves hiking')).toBe('medical doctor')
		expect(extractProfession('PROFESSION: Software Engineer\nOther notes')).toBe('Software Engineer')
		expect(extractProfession('career: accountant, very dedicated')).toBe('accountant')
		expect(extractProfession('Just some random notes')).toBeNull()
		expect(extractProfession(null)).toBeNull()
	})

	test('buildSingleStructuredContent returns single profile payload', () => {
		let person: Person = {
			id: 'person-1',
			name: 'Avery Chen',
			matchmaker_id: 'matchmaker-1',
			age: 31,
			location: 'Austin, TX',
			gender: 'woman',
			preferences: { ageRange: { min: 28, max: 38 } },
			personality: { traits: ['curious'] },
			notes: 'Values kindness',
			active: true,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		}

		let structured = buildSingleStructuredContent(person)
		expect(structured.view).toBe('single_profile')
		expect(structured.single.name).toBe('Avery Chen')
		expect(structured.single.location).toBe('Austin, TX')
	})

	test('buildMatchStructuredContent returns card data without name', () => {
		let matches: Match[] = [
			{
				person: {
					id: 'match-1',
					name: 'Jordan Lee',
					age: 33,
					location: 'Austin, TX',
					gender: 'female',
					notes: 'She works as a nurse. Very outgoing.',
				},
				compatibility_score: 0.82,
				match_reasons: ['Shared interests'],
			},
		]

		let structured = buildMatchStructuredContent('person-1', matches)
		expect(structured.view).toBe('match_results')

		let match = structured.matches[0]!
		// Should NOT have a name field
		expect(match).not.toHaveProperty('masked')
		// Should have card display fields
		expect(match.age).toBe('30s')
		expect(match.gender).toBe('female')
		expect(match.profession).toBe('nurse')
		expect(match.city).toBe('Austin')
		expect(match.match_reasons).toEqual(['Shared interests'])
		expect(match.id).toBe('match-1')
	})

	test('buildMatchStructuredContent handles missing data gracefully', () => {
		let matches: Match[] = [
			{
				person: {
					id: 'match-2',
					name: 'Unknown Person',
					age: null,
					location: null,
					gender: null,
					notes: null,
				},
				compatibility_score: 0.5,
				match_reasons: [],
			},
		]

		let structured = buildMatchStructuredContent('person-1', matches)
		let match = structured.matches[0]!
		expect(match.age).toBeNull()
		expect(match.gender).toBeNull()
		expect(match.profession).toBeNull()
		expect(match.city).toBeNull()
	})
})
