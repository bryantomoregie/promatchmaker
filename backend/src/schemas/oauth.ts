import { z } from 'zod'

export let authorizeQuerySchema = z.object({
	client_id: z.string().min(1, 'client_id is required'),
	redirect_uri: z.string().url('redirect_uri must be a valid URL'),
	response_type: z.literal('code', {
		errorMap: () => ({ message: "response_type must be 'code'" }),
	}),
	state: z.string().min(1, 'state is required'),
	code_challenge: z.string().min(43, 'code_challenge must be at least 43 characters'),
	code_challenge_method: z.literal('S256', {
		errorMap: () => ({ message: "code_challenge_method must be 'S256'" }),
	}),
})

export type AuthorizeQuery = z.infer<typeof authorizeQuerySchema>
