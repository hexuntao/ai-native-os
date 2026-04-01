import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { db, roles, userRoles, users, writeAiAuditLog } from '@ai-native-os/db'
import { deserializeAbility } from '@ai-native-os/shared'
import { eq } from 'drizzle-orm'

import {
  agUiRuntimeEventsPath,
  agUiRuntimePath,
  copilotKitEndpointPath,
} from './copilotkit/runtime'
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

test('Mastra runtime routes reject unauthenticated requests', async () => {
  const response = await app.request('http://localhost/mastra/system/packages')
  const payload = (await response.json()) as {
    code: string
    message: string
  }

  assert.equal(response.status, 401)
  assert.equal(payload.code, 'UNAUTHORIZED')
  assert.equal(payload.message, 'Authentication required for Mastra routes')
})

test('Copilot bridge summary route rejects unauthenticated requests', async () => {
  const response = await app.request(`http://localhost${agUiRuntimePath}`)
  const payload = (await response.json()) as {
    code: string
    message: string
  }

  assert.equal(response.status, 401)
  assert.equal(payload.code, 'UNAUTHORIZED')
  assert.equal(payload.message, 'Authentication required for Copilot bridge routes')
})

test('CopilotKit bridge route rejects unauthenticated requests', async () => {
  const response = await app.request(`http://localhost${copilotKitEndpointPath}`, {
    method: 'POST',
  })
  const payload = (await response.json()) as {
    code: string
    message: string
  }

  assert.equal(response.status, 401)
  assert.equal(payload.code, 'UNAUTHORIZED')
  assert.equal(payload.message, 'Authentication required for Copilot bridge routes')
})

test('Mastra runtime system route boots under the Hono adapter for authenticated users', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const response = await app.request('http://localhost/mastra/system/packages', {
    headers: authHeaders,
  })
  const payload = (await response.json()) as {
    cmsEnabled: boolean
    isDev: boolean
    packages: Array<{
      name: string
      version: string
    }>
    storageType?: string
  }

  assert.equal(response.status, 200)
  assert.ok(Array.isArray(payload.packages))
  assert.equal(typeof payload.isDev, 'boolean')
  assert.equal(typeof payload.cmsEnabled, 'boolean')
})

test('Mastra request context bridge injects Better Auth and RBAC data', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const response = await app.request('http://localhost/mastra/system/request-context', {
    headers: authHeaders,
  })
  const payload = (await response.json()) as {
    authUserId: string
    permissionRules: Array<{
      action: string
      subject: string
    }>
    rbacUserId: string | null
    requestId: string
    roleCodes: string[]
    userEmail: string | null
  }

  assert.equal(response.status, 200)
  assert.ok(payload.authUserId.length > 0)
  assert.ok(payload.permissionRules.length > 0)
  assert.ok(payload.requestId.length > 0)
  assert.deepEqual(payload.roleCodes, ['viewer'])
  assert.ok(payload.rbacUserId)
  assert.ok(payload.userEmail?.includes('@example.com'))
})

test('Mastra OpenAPI route is exposed from the mounted runtime prefix for authenticated users', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const response = await app.request('http://localhost/mastra/openapi.json', {
    headers: authHeaders,
  })
  const payload = (await response.json()) as {
    info: {
      title: string
      version: string
    }
    openapi: string
    paths: Record<string, unknown>
  }

  assert.equal(response.status, 200)
  assert.equal(payload.info.title, 'Mastra API')
  assert.equal(payload.info.version, '1.0.0')
  assert.ok(payload.openapi.startsWith('3.'))
  assert.ok('/system/packages' in payload.paths)
})

test('Mastra agent list route exposes the initial read-only agents for authenticated users', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const response = await app.request('http://localhost/mastra/agents', {
    headers: authHeaders,
  })
  const payload = (await response.json()) as Record<
    string,
    {
      description?: string
      name: string
      tools: Record<string, { id: string }>
    }
  >

  assert.equal(response.status, 200)
  assert.deepEqual(Object.keys(payload).sort(), ['admin-copilot', 'audit-analyst'])
  assert.equal(payload['admin-copilot']?.name, 'Admin Copilot')
  assert.equal(payload['audit-analyst']?.name, 'Audit Analyst')
  assert.ok('userDirectory' in (payload['admin-copilot']?.tools ?? {}))
  assert.ok('operationLogSearch' in (payload['audit-analyst']?.tools ?? {}))
})

test('Mastra agent detail route exposes tool metadata for the selected agent', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const response = await app.request('http://localhost/mastra/agents/admin-copilot', {
    headers: authHeaders,
  })
  const payload = (await response.json()) as {
    description?: string
    name: string
    tools: Record<string, { id: string }>
  }

  assert.equal(response.status, 200)
  assert.equal(payload.name, 'Admin Copilot')
  assert.ok('runtimeConfig' in payload.tools)
  assert.ok('permissionProfile' in payload.tools)
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

test('current permissions endpoint returns normalized RBAC rules for the active user', async () => {
  const authHeaders = await createSessionForRole('viewer')

  const response = await app.request('http://localhost/api/v1/system/permissions/current', {
    headers: authHeaders,
  })
  const payload = (await response.json()) as {
    json: {
      permissionRules: Array<{
        action: string
        subject: string
      }>
      rbacUserId: string | null
      roleCodes: string[]
      userId: string
    }
  }

  assert.equal(response.status, 200)
  assert.deepEqual(payload.json.roleCodes, ['viewer'])
  assert.ok(payload.json.rbacUserId)
  assert.ok(payload.json.userId)
  assert.ok(
    payload.json.permissionRules.some((rule) => rule.action === 'read' && rule.subject === 'Role'),
  )
})

test('serialized ability endpoint returns rules that can be deserialized by frontend consumers', async () => {
  const authHeaders = await createSessionForRole('viewer')

  const response = await app.request('http://localhost/api/v1/system/permissions/ability', {
    headers: authHeaders,
  })
  const payload = (await response.json()) as {
    json: {
      roleCodes: string[]
      rules: Array<{
        action:
          | 'approve'
          | 'assign'
          | 'create'
          | 'delete'
          | 'export'
          | 'import'
          | 'manage'
          | 'read'
          | 'update'
        subject:
          | 'AiAgent'
          | 'AiAuditLog'
          | 'AiKnowledge'
          | 'AiWorkflow'
          | 'Approval'
          | 'Config'
          | 'Dict'
          | 'Menu'
          | 'OnlineUser'
          | 'OperationLog'
          | 'Permission'
          | 'Report'
          | 'Role'
          | 'User'
          | 'all'
      }>
      userId: string
    }
  }
  const ability = deserializeAbility(payload.json.rules)

  assert.equal(response.status, 200)
  assert.deepEqual(payload.json.roleCodes, ['viewer'])
  assert.ok(payload.json.userId)
  assert.equal(ability.can('read', 'Role'), true)
  assert.equal(ability.can('manage', 'Permission'), false)
})

test('AI tool catalog endpoint exposes enabled tools for the authenticated principal', async () => {
  const authHeaders = await createSessionForRole('viewer')

  const response = await app.request('http://localhost/api/v1/system/ai/tools/catalog', {
    headers: authHeaders,
  })
  const payload = (await response.json()) as {
    json: {
      tools: Array<{
        enabled: boolean
        id: string
      }>
    }
  }

  const toolById = new Map(payload.json.tools.map((tool) => [tool.id, tool]))

  assert.equal(response.status, 200)
  assert.equal(toolById.get('user-directory')?.enabled, true)
  assert.equal(toolById.get('operation-log-search')?.enabled, true)
  assert.equal(toolById.get('ai-audit-log-search')?.enabled, false)
  assert.equal(toolById.get('knowledge-semantic-search')?.enabled, false)
  assert.equal(toolById.get('runtime-config')?.enabled, false)
})

test('AI audit logs endpoint returns recent entries for administrators', async () => {
  const authHeaders = await createSessionForRole('admin')
  const testToolId = `api-audit-${randomUUID()}`

  await writeAiAuditLog({
    action: 'read',
    actorAuthUserId: `auth-${randomUUID()}`,
    actorRbacUserId: null,
    requestInfo: {
      requestId: randomUUID(),
      userEmail: 'admin@ai-native-os.local',
    },
    roleCodes: ['admin'],
    status: 'success',
    subject: 'AiAuditLog',
    toolId: testToolId,
  })

  const response = await app.request('http://localhost/api/v1/system/ai/audit-logs/recent', {
    headers: authHeaders,
  })
  const payload = (await response.json()) as {
    json: {
      logs: Array<{
        status: string
        toolId: string
      }>
    }
  }

  assert.equal(response.status, 200)
  assert.ok(payload.json.logs.some((log) => log.toolId === testToolId && log.status === 'success'))
})

test('Mastra runtime summary route reflects the current runtime registry state', async () => {
  const response = await app.request('http://localhost/api/v1/system/mastra-runtime')
  const payload = (await response.json()) as {
    json: {
      agentCount: number
      defaultModel: string
      openapiPath: string
      registeredAgentIds: string[]
      registeredWorkflowIds: string[]
      routePrefix: string
      runtimeStage: 'agents_ready' | 'tools_only' | 'workflows_ready'
      toolCount: number
      workflowCount: number
    }
  }

  assert.equal(response.status, 200)
  assert.equal(payload.json.routePrefix, '/mastra')
  assert.equal(payload.json.openapiPath, '/openapi.json')
  assert.equal(payload.json.defaultModel, 'openai/gpt-4.1-mini')
  assert.equal(payload.json.toolCount, 7)
  assert.deepEqual(payload.json.registeredAgentIds.sort(), ['admin-copilot', 'audit-analyst'])
  assert.equal(payload.json.agentCount, payload.json.registeredAgentIds.length)
  assert.deepEqual(payload.json.registeredWorkflowIds.sort(), ['report-schedule'])
  assert.equal(payload.json.workflowCount, payload.json.registeredWorkflowIds.length)
  assert.equal(payload.json.runtimeStage, 'workflows_ready')
})

test('Mastra workflow routes expose the registered report workflow for authenticated users', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const response = await app.request('http://localhost/mastra/workflows', {
    headers: authHeaders,
  })
  const payload = (await response.json()) as unknown

  assert.equal(response.status, 200)
  assert.ok(JSON.stringify(payload).includes('report-schedule'))
})

test('Copilot bridge summary route exposes authenticated AG-UI runtime metadata', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const response = await app.request(`http://localhost${agUiRuntimePath}`, {
    headers: authHeaders,
  })
  const payload = (await response.json()) as {
    agentIds: string[]
    authRequired: boolean
    defaultAgentId: string
    endpoint: string
    protocol: 'ag-ui'
    resourceId: string
    runtimePath: string
    transport: 'streaming-http'
  }

  assert.equal(response.status, 200)
  assert.equal(payload.authRequired, true)
  assert.equal(payload.protocol, 'ag-ui')
  assert.equal(payload.transport, 'streaming-http')
  assert.equal(payload.endpoint, copilotKitEndpointPath)
  assert.equal(payload.runtimePath, agUiRuntimePath)
  assert.equal(payload.defaultAgentId, 'admin-copilot')
  assert.deepEqual(payload.agentIds, ['admin-copilot', 'audit-analyst'])
  assert.ok(payload.resourceId.length > 0)
})

test('AG-UI runtime events endpoint emits authenticated SSE bootstrap events', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const response = await app.request(`http://localhost${agUiRuntimeEventsPath}`, {
    headers: authHeaders,
  })
  const body = await response.text()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8')
  assert.ok(body.includes('event: runtime.ready'))
  assert.ok(body.includes('event: session.context'))
  assert.ok(body.includes('admin-copilot'))
})

test('CopilotKit bridge route is mounted and rejects unsupported authenticated GET requests', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const response = await app.request(`http://localhost${copilotKitEndpointPath}`, {
    headers: authHeaders,
    method: 'GET',
  })

  assert.equal(response.status, 404)
})
