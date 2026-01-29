import type { PersonPreferences, PersonPersonality } from './api.js'

// Tool name type - all valid tool names
export type ToolName =
	| 'start_intake_interview'
	| 'add_person'
	| 'list_people'
	| 'get_person'
	| 'update_person'
	| 'create_introduction'
	| 'list_introductions'
	| 'update_introduction'
	| 'delete_person'
	| 'get_introduction'
	| 'submit_feedback'
	| 'list_feedback'
	| 'get_feedback'

// Discriminated union types for tool arguments
export type StartIntakeInterviewArgs = {
	single_name?: string
}

export type AddPersonArgs = {
	name: string
}

export type ListPeopleArgs = Record<string, never>

export type GetPersonArgs = {
	id: string
}

export type UpdatePersonArgs = {
	id: string
	name?: string
	age?: number
	location?: string
	gender?: string
	preferences?: PersonPreferences
	personality?: PersonPersonality
	notes?: string
}

export type CreateIntroductionArgs = {
	person_a_id: string
	person_b_id: string
	notes?: string
}

export type ListIntroductionsArgs = Record<string, never>

export type UpdateIntroductionArgs = {
	id: string
	status?: 'pending' | 'accepted' | 'declined' | 'dating' | 'ended'
	notes?: string
}

export type DeletePersonArgs = {
	id: string
}

export type GetIntroductionArgs = {
	id: string
}

export type SubmitFeedbackArgs = {
	introduction_id: string
	from_person_id: string
	content: string
	sentiment?: string
}

export type ListFeedbackArgs = {
	introduction_id: string
}

export type GetFeedbackArgs = {
	id: string
}

// Discriminated union for all tool calls
export type ToolCall =
	| { name: 'start_intake_interview'; args: StartIntakeInterviewArgs }
	| { name: 'add_person'; args: AddPersonArgs }
	| { name: 'list_people'; args: ListPeopleArgs }
	| { name: 'get_person'; args: GetPersonArgs }
	| { name: 'update_person'; args: UpdatePersonArgs }
	| { name: 'create_introduction'; args: CreateIntroductionArgs }
	| { name: 'list_introductions'; args: ListIntroductionsArgs }
	| { name: 'update_introduction'; args: UpdateIntroductionArgs }
	| { name: 'delete_person'; args: DeletePersonArgs }
	| { name: 'get_introduction'; args: GetIntroductionArgs }
	| { name: 'submit_feedback'; args: SubmitFeedbackArgs }
	| { name: 'list_feedback'; args: ListFeedbackArgs }
	| { name: 'get_feedback'; args: GetFeedbackArgs }

// Type guard functions for argument validation
export function isValidObject(args: unknown): args is Record<string, unknown> {
	return args !== null && typeof args === 'object'
}

export function hasString(obj: Record<string, unknown>, key: string): boolean {
	return key in obj && typeof obj[key] === 'string'
}

export function validateAddPersonArgs(args: unknown): AddPersonArgs {
	if (!isValidObject(args) || !hasString(args, 'name')) {
		throw new Error('Invalid arguments: name is required and must be a string')
	}
	return { name: args.name as string }
}

export function validateGetPersonArgs(args: unknown): GetPersonArgs {
	if (!isValidObject(args) || !hasString(args, 'id')) {
		throw new Error('Invalid arguments: id is required and must be a string')
	}
	return { id: args.id as string }
}

export function validateUpdatePersonArgs(args: unknown): UpdatePersonArgs {
	if (!isValidObject(args) || !hasString(args, 'id')) {
		throw new Error('Invalid arguments: id is required and must be a string')
	}
	let { id, ...updates } = args as UpdatePersonArgs
	return { id, ...updates }
}

export function validateCreateIntroductionArgs(args: unknown): CreateIntroductionArgs {
	if (
		!isValidObject(args) ||
		!hasString(args, 'person_a_id') ||
		!hasString(args, 'person_b_id')
	) {
		throw new Error(
			'Invalid arguments: person_a_id and person_b_id are required and must be strings'
		)
	}
	return {
		person_a_id: args.person_a_id as string,
		person_b_id: args.person_b_id as string,
		notes: typeof args.notes === 'string' ? args.notes : undefined,
	}
}

export function validateUpdateIntroductionArgs(args: unknown): UpdateIntroductionArgs {
	if (!isValidObject(args) || !hasString(args, 'id')) {
		throw new Error('Invalid arguments: id is required and must be a string')
	}
	let { id, status, notes } = args as UpdateIntroductionArgs
	return { id, status, notes }
}

export function validateDeletePersonArgs(args: unknown): DeletePersonArgs {
	if (!isValidObject(args) || !hasString(args, 'id')) {
		throw new Error('Invalid arguments: id is required and must be a string')
	}
	return { id: args.id as string }
}

export function validateGetIntroductionArgs(args: unknown): GetIntroductionArgs {
	if (!isValidObject(args) || !hasString(args, 'id')) {
		throw new Error('Invalid arguments: id is required and must be a string')
	}
	return { id: args.id as string }
}

export function validateSubmitFeedbackArgs(args: unknown): SubmitFeedbackArgs {
	if (
		!isValidObject(args) ||
		!hasString(args, 'introduction_id') ||
		!hasString(args, 'from_person_id') ||
		!hasString(args, 'content')
	) {
		throw new Error(
			'Invalid arguments: introduction_id, from_person_id, and content are required and must be strings'
		)
	}
	return {
		introduction_id: args.introduction_id as string,
		from_person_id: args.from_person_id as string,
		content: args.content as string,
		sentiment: typeof args.sentiment === 'string' ? args.sentiment : undefined,
	}
}

export function validateListFeedbackArgs(args: unknown): ListFeedbackArgs {
	if (!isValidObject(args) || !hasString(args, 'introduction_id')) {
		throw new Error('Invalid arguments: introduction_id is required and must be a string')
	}
	return { introduction_id: args.introduction_id as string }
}

export function validateGetFeedbackArgs(args: unknown): GetFeedbackArgs {
	if (!isValidObject(args) || !hasString(args, 'id')) {
		throw new Error('Invalid arguments: id is required and must be a string')
	}
	return { id: args.id as string }
}
