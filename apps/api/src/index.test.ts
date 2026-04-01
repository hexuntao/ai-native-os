import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { app } from './index'

function convertSetCookieToCookie(headers: Headers): Headers {
  const setCookieHeaders = headers.getSetCookie()

  if (setCookieHeaders.length === 0) {
    return headers
  }

  const existingCookies = headers.get('cookie')
  const cookies = existingCookies ? existingCookies.split('; ') : []

  for (const setCookie of setCookieHeaders) {
    const cookiePair = setCookie.split(';')[0]?.trim()

    if (cookiePair) {
      cookies.push(cookiePair)
    }
  }

  headers.set('cookie', cookies.join('; '))

  return headers
}

test('health endpoint responds without crashing the app', async () => {
  const response = await app.request('http://localhost/health')
  const payload = (await response.json()) as {
    checks: { api: string; database: string; redis: string }
    status: string
  }

  assert.ok(response.status === 200 || response.status === 503)
  assert.equal(payload.checks.api, 'ok')
  assert.ok(['ok', 'degraded'].includes(payload.status))
})

test('ping endpoint returns the initial oRPC payload', async () => {
  const response = await app.request('http://localhost/api/v1/system/ping')
  const payload = (await response.json()) as {
    json: { ok: boolean; service: string; timestamp: string }
  }

  assert.equal(response.status, 200)
  assert.equal(payload.json.ok, true)
  assert.equal(payload.json.service, 'api')
})

test('protected session endpoint returns 401 without an authenticated session', async () => {
  const response = await app.request('http://localhost/api/v1/system/session')
  const payload = (await response.json()) as {
    code?: string
    message?: string
    status?: number
  }

  assert.equal(response.status, 401)
  assert.ok(payload.message === undefined || payload.message === 'Unauthorized')
})

test('auth routes create a session that unlocks the protected session endpoint', async () => {
  const email = `api-auth-${randomUUID()}@example.com`
  const password = 'Passw0rd!Passw0rd!'
  const origin = 'http://localhost:3000'

  const signUpResponse = await app.request('http://localhost/api/auth/sign-up/email', {
    body: JSON.stringify({
      callbackURL: origin,
      email,
      name: 'API Auth Test User',
      password,
    }),
    headers: {
      'content-type': 'application/json',
      origin,
    },
    method: 'POST',
  })

  assert.equal(signUpResponse.status, 200)

  const signInResponse = await app.request('http://localhost/api/auth/sign-in/email', {
    body: JSON.stringify({
      email,
      password,
      rememberMe: true,
    }),
    headers: {
      'content-type': 'application/json',
      origin,
    },
    method: 'POST',
  })

  assert.equal(signInResponse.status, 200)

  const authHeaders = convertSetCookieToCookie(signInResponse.headers)
  authHeaders.set('origin', origin)

  const sessionResponse = await app.request('http://localhost/api/v1/system/session', {
    headers: authHeaders,
  })
  const sessionPayload = (await sessionResponse.json()) as {
    json: {
      authenticated: boolean
      user: {
        email: string
        emailVerified: boolean
        id: string
        name: string
      }
    }
  }

  assert.equal(sessionResponse.status, 200)
  assert.equal(sessionPayload.json.authenticated, true)
  assert.equal(sessionPayload.json.user.email, email)
  assert.equal(sessionPayload.json.user.name, 'API Auth Test User')
})
