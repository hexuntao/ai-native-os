import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { db, roles, userRoles, users } from '@ai-native-os/db'
import { eq } from 'drizzle-orm'

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

async function createSessionForRole(roleCode: string): Promise<Headers> {
  const email = `api-${roleCode}-${randomUUID()}@example.com`
  const username = `api_${roleCode}_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const origin = 'http://localhost:3000'
  const [role] = await db
    .select({
      id: roles.id,
    })
    .from(roles)
    .where(eq(roles.code, roleCode))
    .limit(1)

  assert.ok(role, `Expected seeded role ${roleCode} to exist`)

  const userId = randomUUID()

  await db.insert(users).values({
    email,
    id: userId,
    nickname: `API ${roleCode}`,
    passwordHash: 'api-test-placeholder',
    username,
  })
  await db.insert(userRoles).values({
    roleId: role.id,
    userId,
  })

  const password = 'Passw0rd!Passw0rd!'
  const signUpResponse = await app.request('http://localhost/api/auth/sign-up/email', {
    body: JSON.stringify({
      callbackURL: origin,
      email,
      name: `API ${roleCode}`,
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

  return authHeaders
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

test('RBAC summary endpoint returns role-derived context for authorized users', async () => {
  const authHeaders = await createSessionForRole('viewer')

  const response = await app.request('http://localhost/api/v1/system/rbac-summary', {
    headers: authHeaders,
  })
  const payload = (await response.json()) as {
    json: {
      permissionRuleCount: number
      rbacUserId: string | null
      roleCodes: string[]
    }
  }

  assert.equal(response.status, 200)
  assert.deepEqual(payload.json.roleCodes, ['viewer'])
  assert.ok(payload.json.permissionRuleCount > 0)
  assert.ok(payload.json.rbacUserId)
})

test('permission admin endpoint returns 403 when the authenticated role lacks permission', async () => {
  const authHeaders = await createSessionForRole('admin')

  const response = await app.request('http://localhost/api/v1/system/permission-admin-check', {
    headers: authHeaders,
  })
  const payload = (await response.json()) as {
    json?: {
      code?: string
      message?: string
      status?: number
    }
  }

  assert.equal(response.status, 403)
  assert.equal(payload.json?.code, 'FORBIDDEN')
  assert.equal(payload.json?.message, 'Missing permission manage:Permission')
})
