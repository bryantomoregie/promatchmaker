import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authorizeQuerySchema } from '../schemas/oauth'

export let createOAuthRoutes = (): Hono => {
	let app = new Hono()

	app.get('/authorize', zValidator('query', authorizeQuerySchema), async c => {
		let params = c.req.valid('query')

		// Build login URL with all OAuth parameters preserved
		let loginParams = new URLSearchParams({
			client_id: params.client_id,
			redirect_uri: params.redirect_uri,
			response_type: params.response_type,
			state: params.state,
			code_challenge: params.code_challenge,
			code_challenge_method: params.code_challenge_method,
		})

		let loginUrl = `/login?${loginParams.toString()}`

		return c.redirect(loginUrl, 302)
	})

	return app
}
