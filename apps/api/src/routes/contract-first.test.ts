import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { db, roles, userRoles, users } from '@ai-native-os/db'
import { eq } from 'drizzle-orm'

import { app } from '@/index'

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
  const email = `contract-${roleCode}-${randomUUID()}@example.com`
  const username = `contract_${roleCode}_${randomUUID().replaceAll('-', '').slice(0, 12)}`
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
    nickname: `Contract ${roleCode}`,
    passwordHash: 'contract-test-placeholder',
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
      name: `Contract ${roleCode}`,
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

test('OpenAPI document exposes the contract-first business skeleton paths', async () => {
  const response = await app.request('http://localhost/api/openapi.json')
  const payload = (await response.json()) as {
    paths: Record<string, unknown>
  }

  assert.equal(response.status, 200)
  assert.ok('/api/v1/system/users' in payload.paths)
  assert.ok('/api/v1/system/roles' in payload.paths)
  assert.ok('/api/v1/system/permissions' in payload.paths)
  assert.ok('/api/v1/system/menus' in payload.paths)
  assert.ok('/api/v1/monitor/logs' in payload.paths)
  assert.ok('/api/v1/monitor/online' in payload.paths)
  assert.ok('/api/v1/monitor/server' in payload.paths)
  assert.ok('/api/v1/ai/knowledge' in payload.paths)
  assert.ok('/api/v1/ai/evals' in payload.paths)
  assert.ok('/api/v1/ai/audit' in payload.paths)
})

test('viewer can consume the contract-first system and monitor read skeleton routes', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const [
    usersResponse,
    rolesResponse,
    menusResponse,
    logsResponse,
    onlineResponse,
    serverResponse,
  ] = await Promise.all([
    app.request('http://localhost/api/v1/system/users?page=1&pageSize=5', {
      headers: authHeaders,
    }),
    app.request('http://localhost/api/v1/system/roles?page=1&pageSize=5', {
      headers: authHeaders,
    }),
    app.request('http://localhost/api/v1/system/menus?page=1&pageSize=10', {
      headers: authHeaders,
    }),
    app.request('http://localhost/api/v1/monitor/logs?page=1&pageSize=5', {
      headers: authHeaders,
    }),
    app.request('http://localhost/api/v1/monitor/online?page=1&pageSize=5', {
      headers: authHeaders,
    }),
    app.request('http://localhost/api/v1/monitor/server', {
      headers: authHeaders,
    }),
  ])

  const usersPayload = (await usersResponse.json()) as {
    json: {
      data: Array<{ email: string }>
      pagination: { total: number }
    }
  }
  const rolesPayload = (await rolesResponse.json()) as {
    json: {
      data: Array<{ code: string }>
      pagination: { total: number }
    }
  }
  const menusPayload = (await menusResponse.json()) as {
    json: {
      data: Array<{ path: string | null }>
    }
  }
  const logsPayload = (await logsResponse.json()) as {
    json: {
      data: Array<unknown>
    }
  }
  const onlinePayload = (await onlineResponse.json()) as {
    json: {
      data: Array<{ roleCodes: string[] }>
    }
  }
  const serverPayload = (await serverResponse.json()) as {
    json: {
      health: {
        api: string
        redis: string
        telemetry: {
          openTelemetry: string
          sentry: string
        }
      }
      runtime: { toolCount: number }
    }
  }

  assert.equal(usersResponse.status, 200)
  assert.equal(rolesResponse.status, 200)
  assert.equal(menusResponse.status, 200)
  assert.equal(logsResponse.status, 200)
  assert.equal(onlineResponse.status, 200)
  assert.equal(serverResponse.status, 200)
  assert.ok(usersPayload.json.pagination.total >= 1)
  assert.ok(rolesPayload.json.data.some((role) => role.code === 'viewer'))
  assert.ok(menusPayload.json.data.some((menu) => menu.path === '/system/roles'))
  assert.ok(Array.isArray(logsPayload.json.data))
  assert.ok(
    logsPayload.json.data.some(
      (row) =>
        typeof row === 'object' &&
        row !== null &&
        'module' in row &&
        (row as { module?: string }).module === 'auth',
    ),
  )
  assert.ok(onlinePayload.json.data.some((sessionRow) => sessionRow.roleCodes.includes('viewer')))
  assert.equal(serverPayload.json.health.api, 'ok')
  assert.ok(['ok', 'error', 'unknown'].includes(serverPayload.json.health.redis))
  assert.ok(['ok', 'error', 'unknown'].includes(serverPayload.json.health.telemetry.openTelemetry))
  assert.ok(['ok', 'error', 'unknown'].includes(serverPayload.json.health.telemetry.sentry))
  assert.ok(serverPayload.json.runtime.toolCount >= 1)
})

test('AI contract routes expose knowledge, evals skeleton, and audit logs for administrators', async () => {
  const authHeaders = await createSessionForRole('admin')
  const [knowledgeResponse, evalsResponse, auditResponse, feedbackResponse] = await Promise.all([
    app.request('http://localhost/api/v1/ai/knowledge?page=1&pageSize=5', {
      headers: authHeaders,
    }),
    app.request('http://localhost/api/v1/ai/evals?page=1&pageSize=5', {
      headers: authHeaders,
    }),
    app.request('http://localhost/api/v1/ai/audit?page=1&pageSize=5', {
      headers: authHeaders,
    }),
    app.request('http://localhost/api/v1/ai/feedback?page=1&pageSize=5', {
      headers: authHeaders,
    }),
  ])

  const knowledgePayload = (await knowledgeResponse.json()) as {
    json: {
      data: Array<unknown>
      pagination: { total: number }
    }
  }
  const evalsPayload = (await evalsResponse.json()) as {
    json: {
      data: Array<unknown>
      summary: { configured: boolean; totalExperiments: number }
    }
  }
  const auditPayload = (await auditResponse.json()) as {
    json: {
      data: Array<{
        feedbackCount: number
        humanOverride: boolean
        latestUserAction: string | null
      }>
      pagination: { page: number }
    }
  }
  const feedbackPayload = (await feedbackResponse.json()) as {
    json: {
      data: Array<unknown>
      summary: {
        accepted: number
        humanOverrideCount: number
      }
    }
  }

  assert.equal(knowledgeResponse.status, 200)
  assert.equal(evalsResponse.status, 200)
  assert.equal(auditResponse.status, 200)
  assert.equal(feedbackResponse.status, 200)
  assert.ok(knowledgePayload.json.pagination.total >= 0)
  assert.equal(evalsPayload.json.summary.configured, false)
  assert.equal(evalsPayload.json.summary.totalExperiments, 0)
  assert.equal(auditPayload.json.pagination.page, 1)
  assert.ok(
    auditPayload.json.data.every(
      (row) =>
        typeof row.feedbackCount === 'number' &&
        typeof row.humanOverride === 'boolean' &&
        (typeof row.latestUserAction === 'string' || row.latestUserAction === null),
    ),
  )
  assert.ok(Array.isArray(feedbackPayload.json.data))
  assert.ok(feedbackPayload.json.summary.accepted >= 0)
  assert.ok(feedbackPayload.json.summary.humanOverrideCount >= 0)
})

test('super admin can read the contract-first permission list route', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const response = await app.request(
    'http://localhost/api/v1/system/permissions?page=1&pageSize=10',
    {
      headers: authHeaders,
    },
  )
  const payload = (await response.json()) as {
    json: {
      data: Array<{ action: string; resource: string }>
      pagination: { total: number }
    }
  }

  assert.equal(response.status, 200)
  assert.ok(payload.json.pagination.total >= 1)
  assert.ok(payload.json.data.some((permission) => permission.resource === 'User'))
})
