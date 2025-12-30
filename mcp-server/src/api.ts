import { z } from 'zod'
import type { Config } from './config'

let addPersonInputSchema = z.object({
	name: z.string().min(1, 'Name is required'),
})

export class ApiClient {
	constructor(private config: Config) {}

	async addPerson(name: string) {
		// Validate input
		addPersonInputSchema.parse({ name })

		let response = await fetch(`${this.config.api_base_url}/api/people`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.config.auth_token}`,
			},
			body: JSON.stringify({ name }),
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`)
		}

		return response.json()
	}

	async listPeople() {
		let response = await fetch(`${this.config.api_base_url}/api/people`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${this.config.auth_token}`,
			},
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`)
		}

		return response.json()
	}
}
