import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { createRegisterRoutes } from '../../src/routes/register'
import * as clientStore from '../../src/lib/clientStore'

type ClientRegistrationResponse = {
	client_id: string
	client_name: string
	redirect_uris: string[]
}

type OAuthErrorResponse = {
	error: string
	error_description?: string
}

describe('POST /register', () => {
	beforeEach(() => {
		clientStore.clearAllClients()
	})

	test('should return 201 with client_id for valid registration', async () => {
		let app = new Hono()
		app.route('/register', createRegisterRoutes())

		let req = new Request('http://localhost/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_name: 'My Test App',
				redirect_uris: ['http://localhost:3000/callback'],
			}),
		})

		let res = await app.fetch(req)

		expect(res.status).toBe(201)
		expect(res.headers.get('Content-Type')).toContain('application/json')

		let body = (await res.json()) as ClientRegistrationResponse
		expect(body.client_id).toBeDefined()
		expect(body.client_id.length).toBeGreaterThan(0)
		expect(body.client_name).toBe('My Test App')
		expect(body.redirect_uris).toEqual(['http://localhost:3000/callback'])
	})

	test('should return 400 for missing client_name', async () => {
		let app = new Hono()
		app.route('/register', createRegisterRoutes())

		let req = new Request('http://localhost/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				redirect_uris: ['http://localhost:3000/callback'],
			}),
		})

		let res = await app.fetch(req)

		expect(res.status).toBe(400)
		let body = (await res.json()) as OAuthErrorResponse
		expect(body.error).toBe('invalid_client_metadata')
		expect(body.error_description).toContain('client_name')
	})

	test('should return 400 for missing redirect_uris', async () => {
		let app = new Hono()
		app.route('/register', createRegisterRoutes())

		let req = new Request('http://localhost/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_name: 'My Test App',
			}),
		})

		let res = await app.fetch(req)

		expect(res.status).toBe(400)
		let body = (await res.json()) as OAuthErrorResponse
		expect(body.error).toBe('invalid_client_metadata')
		expect(body.error_description).toContain('redirect_uris')
	})

	test('should return 400 for empty redirect_uris array', async () => {
		let app = new Hono()
		app.route('/register', createRegisterRoutes())

		let req = new Request('http://localhost/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_name: 'My Test App',
				redirect_uris: [],
			}),
		})

		let res = await app.fetch(req)

		expect(res.status).toBe(400)
		let body = (await res.json()) as OAuthErrorResponse
		expect(body.error).toBe('invalid_client_metadata')
		expect(body.error_description).toContain('redirect_uris')
	})

	test('should return 400 for invalid redirect_uri format', async () => {
		let app = new Hono()
		app.route('/register', createRegisterRoutes())

		let req = new Request('http://localhost/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_name: 'My Test App',
				redirect_uris: ['not-a-valid-uri'],
			}),
		})

		let res = await app.fetch(req)

		expect(res.status).toBe(400)
		let body = (await res.json()) as OAuthErrorResponse
		expect(body.error).toBe('invalid_redirect_uri')
	})

	test('should return 400 for invalid JSON body', async () => {
		let app = new Hono()
		app.route('/register', createRegisterRoutes())

		let req = new Request('http://localhost/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: 'not valid json',
		})

		let res = await app.fetch(req)

		expect(res.status).toBe(400)
		let body = (await res.json()) as OAuthErrorResponse
		expect(body.error).toBe('invalid_client_metadata')
	})

	test('should generate unique client_ids for different registrations', async () => {
		let app = new Hono()
		app.route('/register', createRegisterRoutes())

		let req1 = new Request('http://localhost/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_name: 'App One',
				redirect_uris: ['http://localhost:3000/callback'],
			}),
		})

		let req2 = new Request('http://localhost/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_name: 'App Two',
				redirect_uris: ['http://localhost:4000/callback'],
			}),
		})

		let res1 = await app.fetch(req1)
		let res2 = await app.fetch(req2)

		let body1 = (await res1.json()) as ClientRegistrationResponse
		let body2 = (await res2.json()) as ClientRegistrationResponse

		expect(body1.client_id).not.toBe(body2.client_id)
	})

	test('should accept multiple redirect_uris', async () => {
		let app = new Hono()
		app.route('/register', createRegisterRoutes())

		let redirectUris = [
			'http://localhost:3000/callback',
			'https://myapp.example.com/oauth/callback',
		]

		let req = new Request('http://localhost/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_name: 'Multi-Redirect App',
				redirect_uris: redirectUris,
			}),
		})

		let res = await app.fetch(req)

		expect(res.status).toBe(201)
		let body = (await res.json()) as ClientRegistrationResponse
		expect(body.redirect_uris).toEqual(redirectUris)
	})

	test('registered client can be retrieved from store', async () => {
		let app = new Hono()
		app.route('/register', createRegisterRoutes())

		let req = new Request('http://localhost/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_name: 'Stored App',
				redirect_uris: ['http://localhost:3000/callback'],
			}),
		})

		let res = await app.fetch(req)
		let body = (await res.json()) as ClientRegistrationResponse

		// Verify the client was stored and can be retrieved
		let storedClient = clientStore.getClient(body.client_id)
		expect(storedClient).toBeDefined()
		expect(storedClient?.clientName).toBe('Stored App')
		expect(storedClient?.redirectUris).toEqual(['http://localhost:3000/callback'])
	})
})

describe('GET /register', () => {
	test('should return 405 Method Not Allowed with Allow header', async () => {
		let app = new Hono()
		app.route('/register', createRegisterRoutes())

		let req = new Request('http://localhost/register', {
			method: 'GET',
		})

		let res = await app.fetch(req)

		expect(res.status).toBe(405)
		expect(res.headers.get('Allow')).toBe('POST')
	})
})
