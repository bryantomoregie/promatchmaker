import type { SupabaseClient } from '../lib/supabase'
import type { PersonResponse } from '../schemas/people'
import type { MatchResponse } from '../schemas/matches'
import { findMatches, type DeclineReason } from './matchingAlgorithm'

let DEFAULT_MATCH_LIMIT = 3

type FindMatchesWithExclusionsParams = {
	personId: string
	userId: string
	person: PersonResponse
}

type FindMatchesResult =
	| { matches: MatchResponse[]; error: null }
	| { matches: null; error: { message: string; status: number } }

export let findMatchesWithExclusions = async (
	supabaseClient: SupabaseClient,
	params: FindMatchesWithExclusionsParams
): Promise<FindMatchesResult> => {
	let { personId, userId, person } = params

	// Get ALL active people across all matchmakers (excluding the subject)
	let { data: allPeople, error: peopleError } = await supabaseClient
		.from('people')
		.select('*')
		.eq('active', true)
		.neq('id', personId)

	if (peopleError) {
		return { matches: null, error: { message: peopleError.message, status: 500 } }
	}

	// Get previous match decisions to exclude already-decided candidates
	let { data: decisions, error: decisionsError } = await supabaseClient
		.from('match_decisions')
		.select('candidate_id, decision, decline_reason')
		.eq('person_id', personId)
		.eq('matchmaker_id', userId)

	if (decisionsError) {
		return { matches: null, error: { message: decisionsError.message, status: 500 } }
	}

	// Get existing introductions to exclude already-introduced candidates
	let { data: introductions, error: introError } = await supabaseClient
		.from('introductions')
		.select('person_a_id, person_b_id')
		.or(`person_a_id.eq.${personId},person_b_id.eq.${personId}`)

	if (introError) {
		return { matches: null, error: { message: introError.message, status: 500 } }
	}

	// Build exclude set from decisions + introductions
	let excludeIds = new Set<string>()
	for (let d of decisions || []) {
		excludeIds.add(d.candidate_id)
	}
	for (let intro of introductions || []) {
		let otherId = intro.person_a_id === personId ? intro.person_b_id : intro.person_a_id
		excludeIds.add(otherId)
	}

	// Collect decline reasons as revealed preferences
	let declineReasons: DeclineReason[] = (decisions || [])
		.filter(d => d.decision === 'declined' && d.decline_reason)
		.map(d => ({
			candidateId: d.candidate_id,
			reason: d.decline_reason!,
		}))

	// Find matches using the algorithm with options
	let matches = findMatches(person, allPeople || [], userId, {
		excludeIds,
		declineReasons,
		limit: DEFAULT_MATCH_LIMIT,
	})

	return { matches, error: null }
}
