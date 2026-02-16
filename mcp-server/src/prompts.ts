import type { GetPromptResult, PromptMessage } from '@modelcontextprotocol/sdk/types.js'
import { MATCHMAKER_INTERVIEW_PROMPT } from './matchmaker-interview-prompt.js'

export type { GetPromptResult, PromptMessage }

export const MATCHMAKER_INTERVIEW_NAME = 'matchmaker_interview'

export interface Prompt {
	name: string
	description: string
	arguments: Array<{
		name: string
		description: string
		required?: boolean
	}>
}

export const prompts: Prompt[] = [
	{
		name: MATCHMAKER_INTERVIEW_NAME,
		description: '14-phase interview methodology for matchmakers advocating on behalf of singles',
		arguments: [],
	},
]

export function getPrompt(name: string): GetPromptResult {
	if (name !== MATCHMAKER_INTERVIEW_NAME) {
		throw new Error(`Unknown prompt: ${name}`)
	}

	return {
		messages: [
			{
				role: 'user',
				content: {
					type: 'text',
					text: MATCHMAKER_INTERVIEW_PROMPT,
				},
			},
		],
	}
}
