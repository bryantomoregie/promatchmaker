import type { Match, Person } from './api.js'

export const UI_RESOURCE_URI = 'matchmaker-ui://discovery'
export const UI_RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app'

export function buildSingleStructuredContent(person: Person) {
	return {
		view: 'single_profile',
		single: {
			id: person.id,
			name: person.name,
			age: person.age ?? null,
			location: person.location ?? null,
			gender: person.gender ?? null,
			preferences: person.preferences ?? null,
			personality: person.personality ?? null,
			notes: person.notes ?? null,
			updated_at: person.updated_at,
		},
	}
}

export function buildMatchStructuredContent(personId: string, matches: Match[]) {
	return {
		view: 'match_results',
		for_person_id: personId,
		matches: matches.map(match => {
			let person = match.person
			let age = person?.age ? maskAge(person.age) : null
			let notes = (person as Record<string, unknown> | undefined)?.notes as string | null | undefined
			return {
				id: person?.id ?? '',
				age,
				gender: (person as Record<string, unknown> | undefined)?.gender as string | null ?? null,
				profession: extractProfession(notes ?? null),
				city: extractCity(person?.location ?? null),
				compatibility_score: match.compatibility_score ?? null,
				match_reasons: match.match_reasons ?? [],
			}
		}),
	}
}

export function maskName(name: string): string {
	let parts = name
		.split(/\s+/)
		.filter(Boolean)
		.map(part => {
			if (part.length <= 1) return '*'
			let mask = '*'.repeat(part.length - 1)
			return `${part[0]?.toUpperCase() ?? '*'}${mask}`
		})
	return parts.length > 0 ? parts.join(' ') : 'Single'
}

export function maskAge(age?: number | null): string {
	if (!age || !Number.isFinite(age)) return 'Age hidden'
	let decade = Math.floor(age / 10) * 10
	return `${decade}s`
}

export function maskLocation(location?: string | null): string {
	if (!location) return 'Location hidden'
	return 'Location hidden'
}

export function extractCity(location: string | null): string | null {
	if (!location || !location.trim()) return null
	return location.split(',')[0]?.trim() || null
}

export function extractProfession(notes: string | null): string | null {
	if (!notes) return null
	let match = notes.match(
		/(?:works as (?:a |an )?|profession:\s*|career:\s*|job:\s*|occupation:\s*)([^,.;\n]+?)(?:\s+and\s|\s+who\s|[,.;\n]|$)/i
	)
	return match ? match[1]!.trim() : null
}
