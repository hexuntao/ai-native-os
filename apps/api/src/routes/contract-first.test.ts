import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import {
  db,
  listAiEvalRunsByEvalKey,
  listOperationLogsByModule,
  roles,
  userRoles,
  users,
} from '@ai-native-os/db'
import { eq } from 'drizzle-orm'

import { app } from '@/index'
import { runMastraEvalSuite } from '@/mastra/evals/runner'

interface OpenApiDocument {
  components?: {
    schemas?: Record<string, unknown>
  }
  paths: Record<string, unknown>
}

// 判断任意值是否为可安全读取属性的对象字面量。
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// 兼容 OpenAPI inline schema 与 `$ref` schema 两种输出形态。
function resolveOpenApiSchema(document: OpenApiDocument, schema: unknown): Record<string, unknown> {
  if (!isRecord(schema)) {
    throw new Error('Expected schema object')
  }

  const refValue = schema.$ref

  if (typeof refValue !== 'string') {
    return schema
  }

  const schemaName = refValue.replace('#/components/schemas/', '')
  const resolvedSchema = document.components?.schemas?.[schemaName]

  assert.ok(
    resolvedSchema && isRecord(resolvedSchema),
    `Expected schema ref ${schemaName} to resolve`,
  )

  return resolvedSchema
}

// 将 Better Auth 响应里的 `Set-Cookie` 头转换为后续请求可复用的 `Cookie` 头。
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

// 为给定角色构造一条真实登录态，供 contract-first 路由烟雾测试复用。
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
  const payload = (await response.json()) as OpenApiDocument

  assert.equal(response.status, 200)
  assert.ok('/api/v1/system/users' in payload.paths)
  assert.ok('/api/v1/system/roles' in payload.paths)
  assert.ok('/api/v1/system/permissions' in payload.paths)
  assert.ok('/api/v1/system/menus' in payload.paths)
  assert.ok('/api/v1/system/dicts' in payload.paths)
  assert.ok('/api/v1/system/config' in payload.paths)
  assert.ok('/api/v1/monitor/logs' in payload.paths)
  assert.ok('/api/v1/monitor/online' in payload.paths)
  assert.ok('/api/v1/monitor/server' in payload.paths)
  assert.ok('/api/v1/ai/knowledge' in payload.paths)
  assert.ok('/api/v1/ai/evals' in payload.paths)
  assert.ok('/api/v1/ai/audit' in payload.paths)
  assert.ok('/api/v1/ai/prompts' in payload.paths)
  assert.ok('/api/v1/tools/gen' in payload.paths)
  assert.ok('/api/v1/tools/jobs' in payload.paths)
})

test('OpenAPI document exposes rich schema metadata for system user write contracts', async () => {
  const response = await app.request('http://localhost/api/openapi.json')
  const payload = (await response.json()) as OpenApiDocument
  const usersPath = payload.paths['/api/v1/system/users']

  assert.ok(usersPath && isRecord(usersPath), 'Expected /api/v1/system/users path to exist')

  const postOperation = usersPath.post

  assert.ok(postOperation && isRecord(postOperation), 'Expected POST operation for system users')
  assert.equal(postOperation.summary, '创建后台用户')
  assert.equal(
    postOperation.description,
    '创建后台用户主体，并同步写入 Better Auth 凭证身份与 RBAC 角色绑定；该操作会记录审计日志。',
  )

  const requestBody = postOperation.requestBody

  assert.ok(requestBody && isRecord(requestBody), 'Expected request body metadata to exist')

  const requestContent = requestBody.content

  assert.ok(
    requestContent && isRecord(requestContent),
    'Expected request body content map to exist',
  )

  const jsonContent = requestContent['application/json']

  assert.ok(jsonContent && isRecord(jsonContent), 'Expected JSON request body schema to exist')

  const inputSchema = resolveOpenApiSchema(payload, jsonContent.schema)

  assert.equal(inputSchema.title, 'CreateUserInput')
  assert.equal(
    inputSchema.description,
    '创建后台用户主体，请求会同时写入应用用户表、Better Auth 凭证主体以及 RBAC 角色绑定。',
  )
  assert.ok(Array.isArray(inputSchema.examples))
  assert.ok(
    isRecord(inputSchema.properties) &&
      isRecord(inputSchema.properties.username) &&
      inputSchema.properties.username.description ===
        '系统内唯一用户名，用于后台用户标识与目录检索，不直接替代邮箱登录。',
  )
  assert.ok(
    isRecord(inputSchema.properties) &&
      isRecord(inputSchema.properties.password) &&
      inputSchema.properties.password.description ===
        '初始登录密码，最少 12 位；仅在创建用户或显式重置密码时使用，不会在任何响应中返回。',
  )
  assert.ok(
    isRecord(inputSchema.properties) &&
      isRecord(inputSchema.properties.roleCodes) &&
      Array.isArray(inputSchema.properties.roleCodes.examples),
  )

  const responses = postOperation.responses

  assert.ok(responses && isRecord(responses), 'Expected response metadata to exist')

  const createdResponse = responses['201'] ?? responses['200']

  assert.ok(
    createdResponse && isRecord(createdResponse),
    'Expected success response metadata to exist',
  )

  const responseContent = createdResponse.content

  assert.ok(responseContent && isRecord(responseContent), 'Expected JSON response content to exist')

  const jsonResponse = responseContent['application/json']

  assert.ok(jsonResponse && isRecord(jsonResponse), 'Expected JSON response schema to exist')

  const outputSchema = resolveOpenApiSchema(payload, jsonResponse.schema)

  assert.equal(outputSchema.title, 'UserEntry')
  assert.equal(
    outputSchema.description,
    '后台用户目录条目，包含应用用户基础信息与当前归一化后的 RBAC 角色编码。',
  )
  assert.ok(
    isRecord(outputSchema.properties) &&
      isRecord(outputSchema.properties.email) &&
      outputSchema.properties.email.description ===
        '登录邮箱，必须唯一；创建或更新时会同步到 Better Auth 主体。',
  )
})

test('viewer can consume the contract-first system and monitor read skeleton routes', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const [
    usersResponse,
    rolesResponse,
    dictsResponse,
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
    app.request('http://localhost/api/v1/system/dicts?page=1&pageSize=10', {
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
  const dictsPayload = (await dictsResponse.json()) as {
    json: {
      data: Array<{ code: string; entryCount: number }>
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
  assert.equal(dictsResponse.status, 200)
  assert.equal(menusResponse.status, 200)
  assert.equal(logsResponse.status, 200)
  assert.equal(onlineResponse.status, 200)
  assert.equal(serverResponse.status, 200)
  assert.ok(usersPayload.json.pagination.total >= 1)
  assert.ok(rolesPayload.json.data.some((role) => role.code === 'viewer'))
  assert.ok(dictsPayload.json.pagination.total >= 1)
  assert.ok(
    dictsPayload.json.data.some(
      (dictionary) => dictionary.code === 'role_codes' && dictionary.entryCount >= 1,
    ),
  )
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

test('super_admin can perform full contract-first CRUD on system users', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const userSuffix = randomUUID().slice(0, 8)
  const createResponse = await app.request('http://localhost/api/v1/system/users', {
    body: JSON.stringify({
      email: `crud-${userSuffix}@example.com`,
      nickname: 'Contract CRUD User',
      password: 'Passw0rd!Passw0rd!',
      roleCodes: ['viewer'],
      status: true,
      username: `crud_${userSuffix}`,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const createPayload = (await createResponse.json()) as {
    json: {
      email: string
      id: string
      nickname: string | null
      roleCodes: string[]
      status: boolean
      username: string
    }
  }

  assert.equal(createResponse.status, 200)
  assert.equal(createPayload.json.email, `crud-${userSuffix}@example.com`)
  assert.equal(createPayload.json.nickname, 'Contract CRUD User')
  assert.deepEqual(createPayload.json.roleCodes, ['viewer'])
  assert.equal(createPayload.json.status, true)

  const getResponse = await app.request(
    `http://localhost/api/v1/system/users/${createPayload.json.id}`,
    {
      headers: authHeaders,
    },
  )
  const getPayload = (await getResponse.json()) as {
    json: {
      id: string
      roleCodes: string[]
      username: string
    }
  }

  assert.equal(getResponse.status, 200)
  assert.equal(getPayload.json.id, createPayload.json.id)
  assert.deepEqual(getPayload.json.roleCodes, ['viewer'])
  assert.equal(getPayload.json.username, `crud_${userSuffix}`)

  const updateResponse = await app.request(
    `http://localhost/api/v1/system/users/${createPayload.json.id}`,
    {
      body: JSON.stringify({
        email: `crud-updated-${userSuffix}@example.com`,
        nickname: 'Contract CRUD User Updated',
        roleCodes: ['editor'],
        status: true,
        username: `crud_updated_${userSuffix}`,
      }),
      headers: {
        ...Object.fromEntries(authHeaders.entries()),
        'content-type': 'application/json',
      },
      method: 'PUT',
    },
  )
  const updatePayload = (await updateResponse.json()) as {
    json: {
      email: string
      id: string
      nickname: string | null
      roleCodes: string[]
      username: string
    }
  }

  assert.equal(updateResponse.status, 200)
  assert.equal(updatePayload.json.id, createPayload.json.id)
  assert.equal(updatePayload.json.email, `crud-updated-${userSuffix}@example.com`)
  assert.equal(updatePayload.json.nickname, 'Contract CRUD User Updated')
  assert.deepEqual(updatePayload.json.roleCodes, ['editor'])
  assert.equal(updatePayload.json.username, `crud_updated_${userSuffix}`)

  const deleteResponse = await app.request(
    `http://localhost/api/v1/system/users/${createPayload.json.id}`,
    {
      headers: authHeaders,
      method: 'DELETE',
    },
  )
  const deletePayload = (await deleteResponse.json()) as {
    json: {
      deleted: boolean
      id: string
    }
  }

  assert.equal(deleteResponse.status, 200)
  assert.equal(deletePayload.json.deleted, true)
  assert.equal(deletePayload.json.id, createPayload.json.id)

  const deletedReadResponse = await app.request(
    `http://localhost/api/v1/system/users/${createPayload.json.id}`,
    {
      headers: authHeaders,
    },
  )
  const deletedReadPayload = (await deletedReadResponse.json()) as {
    code: string
    message: string
  }

  assert.equal(deletedReadResponse.status, 404)
  assert.equal(deletedReadPayload.code, 'NOT_FOUND')
  assert.match(deletedReadPayload.message, /User not found/)

  const systemUserLogs = await listOperationLogsByModule('system_users')
  const targetLogs = systemUserLogs.filter((log) => log.targetId === createPayload.json.id)

  assert.ok(targetLogs.some((log) => log.action === 'create_user'))
  assert.ok(targetLogs.some((log) => log.action === 'update_user'))
  assert.ok(targetLogs.some((log) => log.action === 'delete_user'))
})

test('viewer cannot create users through the contract-first write route', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const response = await app.request('http://localhost/api/v1/system/users', {
    body: JSON.stringify({
      email: `viewer-blocked-${randomUUID().slice(0, 8)}@example.com`,
      nickname: 'Blocked Viewer Mutation',
      password: 'Passw0rd!Passw0rd!',
      roleCodes: ['viewer'],
      status: true,
      username: `viewer_blocked_${randomUUID().replaceAll('-', '').slice(0, 10)}`,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const payload = (await response.json()) as {
    code: string
    message: string
  }

  assert.equal(response.status, 403)
  assert.equal(payload.code, 'FORBIDDEN')
  assert.match(payload.message, /manage:User|manage:all/)
})

test('super_admin can consume the contract-first config and tools skeleton routes', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const [configResponse, genResponse, jobsResponse] = await Promise.all([
    app.request('http://localhost/api/v1/system/config?page=1&pageSize=10', {
      headers: authHeaders,
    }),
    app.request('http://localhost/api/v1/tools/gen?page=1&pageSize=10', {
      headers: authHeaders,
    }),
    app.request('http://localhost/api/v1/tools/jobs?page=1&pageSize=10', {
      headers: authHeaders,
    }),
  ])

  const configPayload = (await configResponse.json()) as {
    json: {
      data: Array<{ key: string; scope: string; value: string }>
      pagination: { total: number }
    }
  }
  const genPayload = (await genResponse.json()) as {
    json: {
      data: Array<{ id: string; routePath: string | null; status: string }>
      summary: {
        availableCount: number
        plannedCount: number
      }
    }
  }
  const jobsPayload = (await jobsResponse.json()) as {
    json: {
      data: Array<{ id: string; mode: string; workflowId: string | null }>
      summary: {
        registeredCount: number
        scheduledCount: number
        workflowLinkedCount: number
      }
    }
  }

  assert.equal(configResponse.status, 200)
  assert.equal(genResponse.status, 200)
  assert.equal(jobsResponse.status, 200)
  assert.ok(configPayload.json.pagination.total >= 1)
  assert.ok(
    configPayload.json.data.some(
      (item) =>
        item.key === 'security.rate_limit' && item.scope === 'security' && item.value.length > 0,
    ),
  )
  assert.ok(
    genPayload.json.data.some(
      (item) =>
        item.id === 'admin-copilot' &&
        item.status === 'available' &&
        item.routePath === '/mastra/agents/admin-copilot',
    ),
  )
  assert.ok(genPayload.json.summary.availableCount >= 1)
  assert.equal(genPayload.json.summary.plannedCount, 0)
  assert.ok(
    jobsPayload.json.data.some(
      (item) =>
        item.id === 'report-schedule-trigger' &&
        item.mode === 'scheduled' &&
        item.workflowId === 'report-schedule',
    ),
  )
  assert.ok(jobsPayload.json.summary.registeredCount >= 3)
  assert.ok(jobsPayload.json.summary.scheduledCount >= 2)
  assert.ok(jobsPayload.json.summary.workflowLinkedCount >= 1)
})

test('AI contract routes expose knowledge, evals, and audit logs for administrators', async () => {
  const authHeaders = await createSessionForRole('admin')
  await runMastraEvalSuite({
    actorAuthUserId: 'system:test-suite',
    actorRbacUserId: null,
    evalId: 'report-schedule',
    requestId: `contract-evals-${randomUUID()}`,
    triggerSource: 'test',
  })
  const [knowledgeResponse, evalsResponse, auditResponse, feedbackResponse, promptsResponse] =
    await Promise.all([
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
      app.request('http://localhost/api/v1/ai/prompts?page=1&pageSize=5', {
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
      data: Array<{
        id: string
        lastRunAverageScore: number | null
        lastRunStatus: string | null
        status: string
      }>
      summary: { configured: boolean; totalExperiments: number; totalDatasets: number }
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
  const promptsPayload = (await promptsResponse.json()) as {
    json: {
      data: Array<{
        id: string
        isActive: boolean
        promptKey: string
        releaseReady: boolean
      }>
      summary: {
        activeCount: number
        draftCount: number
        releaseReadyCount: number
      }
    }
  }

  assert.equal(knowledgeResponse.status, 200)
  assert.equal(evalsResponse.status, 200)
  assert.equal(auditResponse.status, 200)
  assert.equal(feedbackResponse.status, 200)
  assert.equal(promptsResponse.status, 200)
  assert.ok(knowledgePayload.json.pagination.total >= 0)
  assert.equal(evalsPayload.json.summary.configured, true)
  assert.ok(evalsPayload.json.summary.totalExperiments >= 1)
  assert.ok(evalsPayload.json.summary.totalDatasets >= 1)
  assert.ok(
    evalsPayload.json.data.some(
      (row) =>
        row.id === 'report-schedule' &&
        row.status === 'registered' &&
        row.lastRunStatus === 'completed' &&
        row.lastRunAverageScore !== null,
    ),
  )
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
  assert.ok(Array.isArray(promptsPayload.json.data))
  assert.ok(promptsPayload.json.summary.activeCount >= 0)
  assert.ok(promptsPayload.json.summary.draftCount >= 0)
  assert.ok(promptsPayload.json.summary.releaseReadyCount >= 0)
})

test('prompt governance activation requires eval evidence before release', async () => {
  const authHeaders = await createSessionForRole('admin')
  const promptKey = `admin-copilot-${randomUUID().slice(0, 8)}`
  const createResponse = await app.request('http://localhost/api/v1/ai/prompts', {
    body: JSON.stringify({
      notes: 'contract-first prompt governance smoke',
      promptKey,
      promptText: '你是后台管理 Copilot，优先遵循 RBAC 与审计边界。',
      releasePolicy: {
        minAverageScore: 0.5,
        scorerThresholds: {},
      },
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const createPayload = (await createResponse.json()) as {
    json: {
      id: string
      promptKey: string
      releaseReady: boolean
      status: string
      version: number
    }
  }

  assert.equal(createResponse.status, 200)
  assert.equal(createPayload.json.promptKey, promptKey)
  assert.equal(createPayload.json.status, 'draft')
  assert.equal(createPayload.json.releaseReady, false)
  assert.equal(createPayload.json.version, 1)

  const blockedActivateResponse = await app.request('http://localhost/api/v1/ai/prompts/activate', {
    body: JSON.stringify({
      promptVersionId: createPayload.json.id,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const blockedActivatePayload = (await blockedActivateResponse.json()) as {
    code: string
    message: string
  }

  assert.equal(blockedActivateResponse.status, 400)
  assert.equal(blockedActivatePayload.code, 'BAD_REQUEST')
  assert.match(blockedActivatePayload.message, /missing eval evidence/)

  await runMastraEvalSuite({
    actorAuthUserId: 'system:prompt-governance-test',
    actorRbacUserId: null,
    evalId: 'report-schedule',
    requestId: `prompt-gov-${randomUUID()}`,
    triggerSource: 'test',
  })
  const latestEvalRuns = await listAiEvalRunsByEvalKey('report-schedule')
  const latestEvalRun = latestEvalRuns[0]

  assert.ok(latestEvalRun, 'Expected a persisted eval run for report-schedule')

  const attachResponse = await app.request('http://localhost/api/v1/ai/prompts/attach-evidence', {
    body: JSON.stringify({
      evalRunId: latestEvalRun.id,
      promptVersionId: createPayload.json.id,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const attachPayload = (await attachResponse.json()) as {
    json: {
      evalEvidence: {
        evalRunId: string
      } | null
      id: string
      releaseReady: boolean
    }
  }

  assert.equal(attachResponse.status, 200)
  assert.equal(attachPayload.json.id, createPayload.json.id)
  assert.equal(attachPayload.json.evalEvidence?.evalRunId, latestEvalRun.id)
  assert.equal(attachPayload.json.releaseReady, true)

  const activateResponse = await app.request('http://localhost/api/v1/ai/prompts/activate', {
    body: JSON.stringify({
      promptVersionId: createPayload.json.id,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const activatePayload = (await activateResponse.json()) as {
    json: {
      id: string
      isActive: boolean
      status: string
    }
  }

  assert.equal(activateResponse.status, 200)
  assert.equal(activatePayload.json.id, createPayload.json.id)
  assert.equal(activatePayload.json.status, 'active')
  assert.equal(activatePayload.json.isActive, true)
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
