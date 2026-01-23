// In-memory store for OAuth clients (Dynamic Client Registration)
// In production, this would be backed by a database

type ClientData = {
	clientId: string
	clientName: string
	redirectUris: string[]
	createdAt: number
}

let clients = new Map<string, ClientData>()

function generateClientId(): string {
	let array = new Uint8Array(16)
	crypto.getRandomValues(array)
	return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function registerClient(clientName: string, redirectUris: string[]): ClientData {
	let clientId = generateClientId()
	let clientData: ClientData = {
		clientId,
		clientName,
		redirectUris,
		createdAt: Date.now(),
	}
	clients.set(clientId, clientData)
	return clientData
}

export function getClient(clientId: string): ClientData | null {
	return clients.get(clientId) ?? null
}

export function isValidRedirectUri(clientId: string, redirectUri: string): boolean {
	let client = clients.get(clientId)
	if (!client) {
		return false
	}
	return client.redirectUris.includes(redirectUri)
}

export function clearAllClients(): void {
	clients.clear()
}
