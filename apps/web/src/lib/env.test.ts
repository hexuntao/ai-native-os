import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveWebEnvironment } from './env'

test('resolveWebEnvironment keeps localhost defaults for local development', () => {
  const environment = resolveWebEnvironment({})

  assert.equal(environment.appUrl, 'http://localhost:3000')
  assert.equal(environment.apiUrl, 'http://localhost:3001')
})

test('resolveWebEnvironment respects explicit app and api URLs', () => {
  const environment = resolveWebEnvironment({
    API_URL: 'https://api.example.com',
    APP_URL: 'https://admin.example.com',
  })

  assert.equal(environment.appUrl, 'https://admin.example.com')
  assert.equal(environment.apiUrl, 'https://api.example.com')
})

test('resolveWebEnvironment falls back to the current Vercel deployment URL', () => {
  const environment = resolveWebEnvironment({
    VERCEL: '1',
    VERCEL_URL: 'preview-example.vercel.app',
  })

  assert.equal(environment.appUrl, 'https://preview-example.vercel.app')
  assert.equal(environment.apiUrl, 'https://preview-example.vercel.app')
})
