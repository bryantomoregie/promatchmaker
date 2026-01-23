import { Hono } from 'hono'
import { registerClient } from '../lib/clientStore'

// OAuth 2.0 Dynamic Client Registration error response helper
function registrationError(c: any, error: string, description?: string, status = 400) {
	return c.json(
		{
			error,
			...(description && { error_description: description }),
		},
		status
	)
}

function isValidUrl(urlString: string): boolean {
	try {
		new URL(urlString)
		return true
	} catch {
		return false
	}
}

export let createRegisterRoutes = (): Hono => {
	let app = new Hono()

	// Handle GET requests - return 405 Method Not Allowed per RFC 7591
	app.get('/', c => {
		return c.text('Method Not Allowed', 405, {
			Allow: 'POST',
		})
	})

	app.post('/', async c => {
		let body: unknown

		try {
			body = await c.req.json()
		} catch {
			return registrationError(c, 'invalid_client_metadata', 'Invalid JSON body')
		}

		if (typeof body !== 'object' || body === null) {
			return registrationError(c, 'invalid_client_metadata', 'Request body must be a JSON object')
		}

		let { client_name, redirect_uris } = body as Record<string, unknown>

		// Validate client_name
		if (!client_name || typeof client_name !== 'string') {
			return registrationError(
				c,
				'invalid_client_metadata',
				'client_name is required and must be a string'
			)
		}

		// Validate redirect_uris
		if (!redirect_uris || !Array.isArray(redirect_uris)) {
			return registrationError(
				c,
				'invalid_client_metadata',
				'redirect_uris is required and must be an array'
			)
		}

		if (redirect_uris.length === 0) {
			return registrationError(
				c,
				'invalid_client_metadata',
				'redirect_uris must contain at least one URI'
			)
		}

		// Validate each redirect_uri
		for (let uri of redirect_uris) {
			if (typeof uri !== 'string' || !isValidUrl(uri)) {
				return registrationError(c, 'invalid_redirect_uri', `Invalid redirect URI: ${uri}`)
			}
		}

		// Register the client
		let clientData = registerClient(client_name, redirect_uris as string[])

		// Return the registration response per RFC 7591
		return c.json(
			{
				client_id: clientData.clientId,
				client_name: clientData.clientName,
				redirect_uris: clientData.redirectUris,
			},
			201
		)
	})

	return app
}
