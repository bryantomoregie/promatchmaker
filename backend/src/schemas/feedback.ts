import { z } from 'zod'

export let createFeedbackSchema = z.object({
	introduction_id: z.string().uuid(),
	from_person_id: z.string().uuid(),
	content: z.string().min(1),
	sentiment: z.string().optional(),
})

export let feedbackResponseSchema = z.object({
	id: z.string().uuid(),
	introduction_id: z.string().uuid(),
	from_person_id: z.string().uuid(),
	content: z.string(),
	sentiment: z.string().nullable(),
	created_at: z.string(),
})

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>
