import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { SupabaseClient } from '../lib/supabase'
import { createPersonSchema } from '../schemas/people'

type Variables = {
	userId: string
}

export let createPeopleRoutes = (
	supabaseClient: SupabaseClient
): Hono<{ Variables: Variables }> => {
	let app = new Hono<{ Variables: Variables }>()

	app.post('/', zValidator('json', createPersonSchema), async c => {
		let userId = c.get('userId')
		let data = c.req.valid('json')

		let { data: person, error } = await supabaseClient
			.from('people')
			.insert({
				...data,
				matchmaker_id: userId,
			})
			.select()
			.single()

		if (error) {
			return c.json({ error: error.message }, 500)
		}

		return c.json(person, 201)
	})

	app.get('/', async c => {
		let userId = c.get('userId')

		let { data: people, error } = await supabaseClient
			.from('people')
			.select('*')
			.eq('matchmaker_id', userId)

		if (error) {
			return c.json({ error: error.message }, 500)
		}

		return c.json(people || [], 200)
	})

	return app
}
