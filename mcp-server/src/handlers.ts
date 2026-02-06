import type { ApiClient } from './api.js'
import type { ToolName } from './tools.js'
import {
	validateAddPersonArgs,
	validateGetPersonArgs,
	validateUpdatePersonArgs,
	validateFindMatchesArgs,
	validateCreateIntroductionArgs,
	validateUpdateIntroductionArgs,
	validateDeletePersonArgs,
	validateGetIntroductionArgs,
	validateSubmitFeedbackArgs,
	validateListFeedbackArgs,
	validateGetFeedbackArgs,
} from './tools.js'
import {
	buildMatchStructuredContent,
	UI_RESOURCE_URI,
} from './ui.js'

type ToolResult = {
	content: Array<{ type: 'text'; text: string }>
	structuredContent?: Record<string, unknown>
	_meta?: Record<string, unknown>
	isError?: boolean
}

type ToolHandler = (args: unknown) => Promise<ToolResult>

function successResult(
	data: unknown,
	options?: { structuredContent?: Record<string, unknown>; includeUi?: boolean }
): ToolResult {
	let result: ToolResult = {
		content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
	}

	if (options?.structuredContent) {
		result.structuredContent = options.structuredContent
	}

	if (options?.includeUi) {
		result._meta = {
			ui: {
				resourceUri: UI_RESOURCE_URI,
			},
			'openai/outputTemplate': UI_RESOURCE_URI,
		}
	}

	return result
}

export function createToolHandlers(apiClient: ApiClient): Record<ToolName, ToolHandler> {
	return {
		add_single: async args => {
			let validated = validateAddPersonArgs(args)
			let result = await apiClient.addPerson(validated.name)
			return successResult(result)
		},

		list_singles: async () => {
			let result = await apiClient.listPeople()
			return successResult(result)
		},

		get_person: async args => {
			let validated = validateGetPersonArgs(args)
			let result = await apiClient.getPerson(validated.id)
			return successResult(result)
		},

		update_person: async args => {
			let validated = validateUpdatePersonArgs(args)
			let { id, ...updates } = validated
			let result = await apiClient.updatePerson(id, updates)
			return successResult(result)
		},

		find_matches: async args => {
			let validated = validateFindMatchesArgs(args)
			let result = await apiClient.findMatches(validated.person_id)
			return successResult(result, {
				structuredContent: buildMatchStructuredContent(validated.person_id, result),
				includeUi: true,
			})
		},

		create_introduction: async args => {
			let validated = validateCreateIntroductionArgs(args)
			let result = await apiClient.createIntroduction(
				validated.person_a_id,
				validated.person_b_id,
				validated.notes
			)
			return successResult(result)
		},

		list_introductions: async () => {
			let result = await apiClient.listIntroductions()
			return successResult(result)
		},

		update_introduction: async args => {
			let validated = validateUpdateIntroductionArgs(args)
			let { id, ...updates } = validated
			let result = await apiClient.updateIntroduction(id, updates)
			return successResult(result)
		},

		delete_person: async args => {
			let validated = validateDeletePersonArgs(args)
			let result = await apiClient.deletePerson(validated.id)
			return successResult(result)
		},

		get_introduction: async args => {
			let validated = validateGetIntroductionArgs(args)
			let result = await apiClient.getIntroduction(validated.id)
			return successResult(result)
		},

		submit_feedback: async args => {
			let validated = validateSubmitFeedbackArgs(args)
			let result = await apiClient.submitFeedback(
				validated.introduction_id,
				validated.from_person_id,
				validated.content,
				validated.sentiment
			)
			return successResult(result)
		},

		list_feedback: async args => {
			let validated = validateListFeedbackArgs(args)
			let result = await apiClient.listFeedback(validated.introduction_id)
			return successResult(result)
		},

		get_feedback: async args => {
			let validated = validateGetFeedbackArgs(args)
			let result = await apiClient.getFeedback(validated.id)
			return successResult(result)
		},
	}
}

export function isValidToolName(name: string): name is ToolName {
	let validNames: ToolName[] = [
		'add_single',
		'list_singles',
		'get_person',
		'update_person',
		'find_matches',
		'create_introduction',
		'list_introductions',
		'update_introduction',
		'delete_person',
		'get_introduction',
		'submit_feedback',
		'list_feedback',
		'get_feedback',
	]
	return validNames.includes(name as ToolName)
}
