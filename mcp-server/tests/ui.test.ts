import { describe, test, expect } from 'bun:test'
import type { Match, Person } from '../src/api'
import {
	buildMatchStructuredContent,
	buildSingleStructuredContent,
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

	test('buildMatchStructuredContent masks personal details', () => {
		let matches: Match[] = [
			{
				person: {
					id: 'match-1',
					name: 'Jordan Lee',
					age: 33,
					location: 'Austin, TX',
				},
				compatibility_score: 0.82,
				match_reasons: ['Shared interests'],
			},
		]

		let structured = buildMatchStructuredContent('person-1', matches)
		expect(structured.view).toBe('match_results')
		expect(structured.matches[0]?.masked.name).toBe('J***** L**')
		expect(structured.matches[0]?.masked.location).toBe('Location hidden')
		expect(structured.matches[0]?.masked.age).toBe('30s')
	})
})
