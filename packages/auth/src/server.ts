import { account, db, session, user, verification } from '@ai-native-os/db'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'

import { authBasePath, resolveAuthEnvironment } from '@/env'

export const authEnvironment = resolveAuthEnvironment()

export const auth = betterAuth({
  appName: 'AI Native OS',
  basePath: authBasePath,
  baseURL: authEnvironment.baseURL,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      account,
      session,
      user,
      verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: authEnvironment.secret,
  trustedOrigins: authEnvironment.trustedOrigins,
})

export type AuthInstance = typeof auth
