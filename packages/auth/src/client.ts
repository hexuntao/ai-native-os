import type { BetterAuthClientOptions } from 'better-auth/client'
import { createAuthClient } from 'better-auth/client'

import { resolveAuthEnvironment } from './env'

export function createAiNativeAuthClient(
  options: BetterAuthClientOptions = {},
): ReturnType<typeof createAuthClient> {
  const authEnvironment = resolveAuthEnvironment()

  return createAuthClient({
    baseURL: authEnvironment.baseURL,
    ...options,
  })
}

export const authClient = createAiNativeAuthClient()
