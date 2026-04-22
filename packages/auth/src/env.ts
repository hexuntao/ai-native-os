const defaultDevAuthSecret = 'ai-native-os-dev-secret-change-me'
const defaultDevAuthUrl = 'http://localhost:3001'
const defaultAppUrl = 'http://localhost:3000'
const defaultDevTrustedOrigins = ['http://localhost:3000', 'http://localhost:3002'] as const

export const authBasePath = '/api/auth'

export interface AuthEnvironment {
  appUrl: string
  basePath: string
  baseURL: string
  secret: string
  trustedOrigins: string[]
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '')
}

function parseTrustedOrigins(env: NodeJS.ProcessEnv): string[] {
  const configuredOrigins = env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map(normalizeOrigin)

  const appUrl = normalizeOrigin(env.APP_URL ?? defaultAppUrl)
  const defaultOrigins =
    env.NODE_ENV === 'production'
      ? [appUrl]
      : [appUrl, ...defaultDevTrustedOrigins.map((origin) => normalizeOrigin(origin))]

  return Array.from(new Set([...defaultOrigins, ...(configuredOrigins ?? [])]))
}

export function resolveAuthEnvironment(env: NodeJS.ProcessEnv = process.env): AuthEnvironment {
  const baseURL = normalizeOrigin(env.BETTER_AUTH_URL ?? env.API_URL ?? defaultDevAuthUrl)
  const secret = env.BETTER_AUTH_SECRET

  if (!secret && env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET is required to initialize @ai-native-os/auth in production')
  }

  return {
    appUrl: normalizeOrigin(env.APP_URL ?? defaultAppUrl),
    basePath: authBasePath,
    baseURL,
    secret: secret ?? defaultDevAuthSecret,
    trustedOrigins: parseTrustedOrigins(env),
  }
}
