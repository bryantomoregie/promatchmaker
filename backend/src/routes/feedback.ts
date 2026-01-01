import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { SupabaseClient } from '../lib/supabase'
import { createFeedbackSchema } from '../schemas/feedback'

type Variables = {
	userId: string
}

export let createFeedbackRoutes = (
	supabaseClient: SupabaseClient
): Hono<{ Variables: Variables }> => {
	let app = new Hono<{ Variables: Variables }>()

	app.post('/', zValidator('json', createFeedbackSchema), async c => {
		let data = c.req.valid('json')

		let { data: feedback, error } = await supabaseClient
			.from('feedback')
			.insert(data)
			.select()
			.single()

		if (error) {
			return c.json({ error: error.message }, 500)
		}

		return c.json(feedback, 201)
	})

	app.get('/', async c => {
		let introductionId = c.req.query('introductionId')

		if (!introductionId) {
			return c.json({ error: 'introductionId query parameter required' }, 400)
		}

		let { data: feedback, error } = await supabaseClient
			.from('feedback')
			.select('*')
			.eq('introduction_id', introductionId)

		if (error) {
			return c.json({ error: error.message }, 500)
		}

		return c.json(feedback || [], 200)
	})

	app.get('/:id', async c => {
		let feedbackId = c.req.param('id')

		let { data: feedback, error } = await supabaseClient
			.from('feedback')
			.select('*')
			.eq('id', feedbackId)
			.maybeSingle()

		if (error) {
			return c.json({ error: error.message }, 500)
		}

		if (!feedback) {
			return c.json({ error: 'Feedback not found' }, 404)
		}

		return c.json(feedback, 200)
	})

	return app
}
