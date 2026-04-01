export interface WebEnvironment {
  apiUrl: string
  appUrl: string
}

export function resolveWebEnvironment(): WebEnvironment {
  return {
    apiUrl: process.env.API_URL ?? 'http://localhost:3001',
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  }
}
