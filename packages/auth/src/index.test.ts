import assert from 'node:assert/strict'
import test from 'node:test'

import { authBasePath, resolveAuthEnvironment } from './env'

test('resolveAuthEnvironment falls back to local defaults in development', () => {
  const environment = resolveAuthEnvironment({
    API_URL: 'http://localhost:3001',
    APP_URL: 'http://localhost:3000',
    NODE_ENV: 'development',
  })

  assert.equal(environment.basePath, authBasePath)
  assert.equal(environment.baseURL, 'http://localhost:3001')
  assert.equal(environment.secret, 'ai-native-os-dev-secret-change-me')
  assert.deepEqual(environment.trustedOrigins, ['http://localhost:3000'])
})

test('resolveAuthEnvironment requires BETTER_AUTH_SECRET in production', () => {
  assert.throws(
    () =>
      resolveAuthEnvironment({
        BETTER_AUTH_URL: 'https://api.example.com',
        NODE_ENV: 'production',
      }),
    /BETTER_AUTH_SECRET is required/,
  )
})
