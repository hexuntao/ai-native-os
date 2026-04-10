import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import {
  db,
  listAiEvalRunsByEvalKey,
  listOperationLogsByModule,
  permissions,
  roles,
  userRoles,
  users,
} from '@ai-native-os/db'
import { and, eq, inArray } from 'drizzle-orm'

import { app } from '@/index'
import { runMastraEvalSuite } from '@/mastra/evals/runner'

interface OpenApiDocument {
  components?: {
    schemas?: Record<string, unknown>
  }
  paths: Record<string, unknown>
}

interface OpenApiParameter {
  description?: string
  in?: string
  name?: string
  schema?: unknown
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

// 从 operation parameter 列表里按名称定位 query 参数。
function findOperationParameter(
  operation: Record<string, unknown>,
  parameterName: string,
): OpenApiParameter {
  const parameters = operation.parameters

  assert.ok(Array.isArray(parameters), 'Expected operation parameters to exist')

  const parameter = parameters.find(
    (candidate) =>
      isRecord(candidate) && candidate.name === parameterName && candidate.in === 'query',
  )

  assert.ok(parameter && isRecord(parameter), `Expected query parameter ${parameterName} to exist`)

  return parameter
}

// 兼容不同 OpenAPI 生成器把 query 参数文档挂在 parameter 或 schema 上的差异。
function resolveParameterDescription(
  document: OpenApiDocument,
  parameter: OpenApiParameter,
): string | undefined {
  if (typeof parameter.description === 'string') {
    return parameter.description
  }

  if (!parameter.schema) {
    return undefined
  }

  const resolvedSchema = resolveOpenApiSchema(document, parameter.schema)

  return typeof resolvedSchema.description === 'string' ? resolvedSchema.description : undefined
}

// 从分页响应 schema 中提取 `data.items` 对应的列表条目 schema。
function resolvePaginatedItemSchema(
  document: OpenApiDocument,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  assert.ok(isRecord(schema.properties), 'Expected paginated schema properties to exist')

  const dataSchema = schema.properties.data

  assert.ok(isRecord(dataSchema), 'Expected paginated data schema to exist')

  const resolvedDataSchema = resolveOpenApiSchema(document, dataSchema)
  const itemSchema = resolvedDataSchema.items

  assert.ok(itemSchema, 'Expected paginated data schema to expose array items')

  return resolveOpenApiSchema(document, itemSchema)
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

// 读取角色 CRUD 测试所需的权限主键，避免在测试里硬编码权限 UUID。
async function loadRoleCrudPermissionIds(): Promise<{
  roleReadPermissionId: string
  userReadPermissionId: string
}> {
  const permissionRows = await db
    .select({
      action: permissions.action,
      id: permissions.id,
      resource: permissions.resource,
    })
    .from(permissions)
    .where(inArray(permissions.resource, ['Role', 'User']))

  const userReadPermissionId = permissionRows.find(
    (permission) => permission.resource === 'User' && permission.action === 'read',
  )?.id
  const roleReadPermissionId = permissionRows.find(
    (permission) => permission.resource === 'Role' && permission.action === 'read',
  )?.id

  assert.ok(userReadPermissionId, 'Expected read:User permission to exist')
  assert.ok(roleReadPermissionId, 'Expected read:Role permission to exist')

  return {
    roleReadPermissionId,
    userReadPermissionId,
  }
}

test('OpenAPI document exposes the contract-first business skeleton paths', async () => {
  const response = await app.request('http://localhost/api/openapi.json')
  const payload = (await response.json()) as OpenApiDocument

  assert.equal(response.status, 200)
  assert.ok('/api/v1/system/users' in payload.paths)
  assert.ok('/api/v1/system/roles' in payload.paths)
  assert.ok(
    '/api/v1/system/roles/{id}' in payload.paths || '/api/v1/system/roles/:id' in payload.paths,
  )
  assert.ok('/api/v1/system/permissions' in payload.paths)
  assert.ok(
    '/api/v1/system/permissions/{id}' in payload.paths ||
      '/api/v1/system/permissions/:id' in payload.paths,
  )
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

test('OpenAPI document exposes rich schema metadata for system roles and permissions contracts', async () => {
  const response = await app.request('http://localhost/api/openapi.json')
  const payload = (await response.json()) as OpenApiDocument
  const rolesPath = payload.paths['/api/v1/system/roles']
  const permissionsPath = payload.paths['/api/v1/system/permissions']

  assert.ok(rolesPath && isRecord(rolesPath), 'Expected /api/v1/system/roles path to exist')
  assert.ok(
    permissionsPath && isRecord(permissionsPath),
    'Expected /api/v1/system/permissions path to exist',
  )

  const rolesOperation = rolesPath.get
  const permissionsOperation = permissionsPath.get

  assert.ok(rolesOperation && isRecord(rolesOperation), 'Expected GET operation for roles')
  assert.ok(
    permissionsOperation && isRecord(permissionsOperation),
    'Expected GET operation for permissions',
  )

  assert.equal(rolesOperation.summary, '查询角色列表')
  assert.equal(
    rolesOperation.description,
    '分页返回系统角色目录，并附带每个角色当前绑定的用户数量、权限数量和权限主键列表，供角色管理界面直接展示与回填。',
  )
  assert.equal(permissionsOperation.summary, '查询权限规则列表')
  assert.equal(
    permissionsOperation.description,
    '分页返回权限规则目录，包含资源、动作、条件、字段约束、角色引用数量和是否为禁止规则等信息，供权限中心直接消费。',
  )

  const rolesStatusParameter = findOperationParameter(rolesOperation, 'status')
  const permissionActionParameter = findOperationParameter(permissionsOperation, 'action')
  const permissionResourceParameter = findOperationParameter(permissionsOperation, 'resource')

  assert.equal(
    resolveParameterDescription(payload, rolesStatusParameter),
    '按角色启用状态过滤；省略时返回全部角色。',
  )
  assert.equal(
    resolveParameterDescription(payload, permissionActionParameter),
    '按 CASL 动作过滤权限规则；省略时返回所有动作。',
  )
  assert.equal(
    resolveParameterDescription(payload, permissionResourceParameter),
    '按资源主体过滤权限规则；省略时返回所有资源。',
  )

  const roleResponses = rolesOperation.responses
  const permissionResponses = permissionsOperation.responses

  assert.ok(roleResponses && isRecord(roleResponses), 'Expected role response metadata to exist')
  assert.ok(
    permissionResponses && isRecord(permissionResponses),
    'Expected permission response metadata to exist',
  )

  const roleJsonResponse =
    isRecord(roleResponses['200']) && isRecord(roleResponses['200'].content)
      ? roleResponses['200'].content['application/json']
      : undefined
  const permissionJsonResponse =
    isRecord(permissionResponses['200']) && isRecord(permissionResponses['200'].content)
      ? permissionResponses['200'].content['application/json']
      : undefined

  assert.ok(roleJsonResponse && isRecord(roleJsonResponse), 'Expected roles JSON response schema')
  assert.ok(
    permissionJsonResponse && isRecord(permissionJsonResponse),
    'Expected permissions JSON response schema',
  )

  const roleOutputSchema = resolveOpenApiSchema(payload, roleJsonResponse.schema)
  const permissionOutputSchema = resolveOpenApiSchema(payload, permissionJsonResponse.schema)

  assert.equal(roleOutputSchema.title, 'RoleListResponse')
  assert.equal(roleOutputSchema.description, '角色管理分页响应，返回角色列表与标准分页信息。')
  assert.equal(permissionOutputSchema.title, 'PermissionListResponse')
  assert.equal(permissionOutputSchema.description, '权限规则分页响应，返回规则列表与标准分页信息。')

  const roleEntrySchema = resolvePaginatedItemSchema(payload, roleOutputSchema)
  const permissionEntrySchema = resolvePaginatedItemSchema(payload, permissionOutputSchema)

  assert.ok(
    isRecord(roleEntrySchema.properties) &&
      isRecord(roleEntrySchema.properties.permissionCount) &&
      roleEntrySchema.properties.permissionCount.description === '当前角色已绑定的权限规则数量。',
  )
  assert.ok(
    isRecord(roleEntrySchema.properties) &&
      isRecord(roleEntrySchema.properties.permissionIds) &&
      roleEntrySchema.properties.permissionIds.description ===
        '当前角色绑定的权限规则主键列表，供角色编辑表单直接回填；后端会在写入时校验这些权限必须存在。',
  )
  assert.ok(
    isRecord(roleEntrySchema.properties) &&
      isRecord(roleEntrySchema.properties.userCount) &&
      roleEntrySchema.properties.userCount.description === '当前绑定该角色的用户数量。',
  )
  assert.ok(
    isRecord(permissionEntrySchema.properties) &&
      isRecord(permissionEntrySchema.properties.roleCount) &&
      permissionEntrySchema.properties.roleCount.description === '当前引用该权限规则的角色数量。',
  )
  assert.ok(
    isRecord(permissionEntrySchema.properties) &&
      isRecord(permissionEntrySchema.properties.conditions) &&
      permissionEntrySchema.properties.conditions.description ===
        'CASL 条件表达式；为空表示无条件放行。',
  )
  assert.ok(
    isRecord(permissionEntrySchema.properties) &&
      isRecord(permissionEntrySchema.properties.inverted) &&
      permissionEntrySchema.properties.inverted.description ===
        '是否为反向规则；`true` 表示禁止规则，`false` 表示允许规则。',
  )
})

test('OpenAPI document exposes rich schema metadata for system permission write contracts', async () => {
  const response = await app.request('http://localhost/api/openapi.json')
  const payload = (await response.json()) as OpenApiDocument
  const permissionsPath = payload.paths['/api/v1/system/permissions']

  assert.ok(
    permissionsPath && isRecord(permissionsPath),
    'Expected /api/v1/system/permissions path to exist',
  )

  const postOperation = permissionsPath.post

  assert.ok(
    postOperation && isRecord(postOperation),
    'Expected POST operation for system permissions',
  )
  assert.equal(postOperation.summary, '创建权限规则')
  assert.equal(
    postOperation.description,
    '创建自定义权限规则；系统保留权限、`manage:all` 提升和完全重复的规则会在服务端被拒绝，并记录审计日志。',
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

  assert.equal(inputSchema.title, 'CreatePermissionInput')
  assert.equal(
    inputSchema.description,
    '创建自定义权限规则；系统保留权限与 `manage:all` 提升会在服务端被拒绝，且完全重复的权限规则不会重复创建。',
  )
  assert.ok(
    isRecord(inputSchema.properties) &&
      isRecord(inputSchema.properties.conditions) &&
      inputSchema.properties.conditions.description ===
        '创建时的 CASL 条件表达式；未填写时默认 `null`。',
  )
  assert.ok(
    isRecord(inputSchema.properties) &&
      isRecord(inputSchema.properties.fields) &&
      inputSchema.properties.fields.description ===
        '可选字段范围；未填写时默认 `null`，表示不限制字段维度。',
  )

  const responses = postOperation.responses

  assert.ok(responses && isRecord(responses), 'Expected response metadata to exist')

  const responseJson =
    isRecord(responses['200']) && isRecord(responses['200'].content)
      ? responses['200'].content['application/json']
      : undefined

  assert.ok(responseJson && isRecord(responseJson), 'Expected JSON response schema to exist')

  const outputSchema = resolveOpenApiSchema(payload, responseJson.schema)

  assert.equal(outputSchema.title, 'PermissionEntry')
  assert.equal(
    outputSchema.description,
    '权限规则条目，表示一条 CASL 资源动作规则及其条件约束，并附带角色引用数量摘要。',
  )
})

test('OpenAPI document exposes rich schema metadata for system role write contracts', async () => {
  const response = await app.request('http://localhost/api/openapi.json')
  const payload = (await response.json()) as OpenApiDocument
  const rolesPath = payload.paths['/api/v1/system/roles']

  assert.ok(rolesPath && isRecord(rolesPath), 'Expected /api/v1/system/roles path to exist')

  const postOperation = rolesPath.post

  assert.ok(postOperation && isRecord(postOperation), 'Expected POST operation for system roles')
  assert.equal(postOperation.summary, '创建角色')
  assert.equal(
    postOperation.description,
    '创建自定义 RBAC 角色并同步绑定权限规则；系统保留角色编码与 `manage:all` 权限会在服务端被拒绝，且该操作会记录审计日志。',
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

  assert.equal(inputSchema.title, 'CreateRoleInput')
  assert.equal(
    inputSchema.description,
    '创建一个自定义 RBAC 角色，并同步绑定权限规则；系统保留角色编码不可通过该接口复用。',
  )
  assert.ok(
    isRecord(inputSchema.properties) &&
      isRecord(inputSchema.properties.code) &&
      inputSchema.properties.code.description ===
        '新角色编码，作为稳定 RBAC 标识使用；不得复用系统保留编码，例如 `super_admin`、`admin`、`editor`、`viewer`。',
  )
  assert.ok(
    isRecord(inputSchema.properties) &&
      isRecord(inputSchema.properties.permissionIds) &&
      inputSchema.properties.permissionIds.description ===
        '当前角色绑定的权限规则主键列表，供角色编辑表单直接回填；后端会在写入时校验这些权限必须存在。',
  )

  const responses = postOperation.responses

  assert.ok(responses && isRecord(responses), 'Expected response metadata to exist')

  const responseJson =
    isRecord(responses['200']) && isRecord(responses['200'].content)
      ? responses['200'].content['application/json']
      : undefined

  assert.ok(responseJson && isRecord(responseJson), 'Expected JSON response schema to exist')

  const outputSchema = resolveOpenApiSchema(payload, responseJson.schema)

  assert.equal(outputSchema.title, 'RoleEntry')
  assert.equal(
    outputSchema.description,
    '角色目录条目，包含角色基础信息、权限绑定主键列表以及用户数/权限数两个管理摘要，可直接用于角色编辑表单回填。',
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
        ai: {
          status: string
        }
        redis: string
        telemetry: {
          openTelemetry: string
          sentry: string
        }
      }
      runtime: { enabledAgentCount: number; toolCount: number }
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
  assert.ok(['enabled', 'degraded'].includes(serverPayload.json.health.ai.status))
  assert.ok(['ok', 'error', 'unknown'].includes(serverPayload.json.health.redis))
  assert.ok(['ok', 'error', 'unknown'].includes(serverPayload.json.health.telemetry.openTelemetry))
  assert.ok(['ok', 'error', 'unknown'].includes(serverPayload.json.health.telemetry.sentry))
  assert.ok(serverPayload.json.runtime.enabledAgentCount >= 0)
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

test('super_admin can perform full contract-first CRUD on custom system roles', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const roleSuffix = randomUUID().slice(0, 8)
  const { roleReadPermissionId, userReadPermissionId } = await loadRoleCrudPermissionIds()
  const createResponse = await app.request('http://localhost/api/v1/system/roles', {
    body: JSON.stringify({
      code: `ops_${roleSuffix}`,
      description: 'Contract CRUD Role',
      name: `Contract Role ${roleSuffix}`,
      permissionIds: [userReadPermissionId],
      sortOrder: 40,
      status: true,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const createPayload = (await createResponse.json()) as {
    json: {
      code: string
      id: string
      permissionIds: string[]
      status: boolean
    }
  }

  assert.equal(createResponse.status, 200)
  assert.equal(createPayload.json.code, `ops_${roleSuffix}`)
  assert.deepEqual(createPayload.json.permissionIds, [userReadPermissionId])
  assert.equal(createPayload.json.status, true)

  const readResponse = await app.request(
    `http://localhost/api/v1/system/roles/${createPayload.json.id}`,
    {
      headers: authHeaders,
    },
  )
  const readPayload = (await readResponse.json()) as {
    json: {
      code: string
      id: string
      permissionIds: string[]
      userCount: number
    }
  }

  assert.equal(readResponse.status, 200)
  assert.equal(readPayload.json.id, createPayload.json.id)
  assert.deepEqual(readPayload.json.permissionIds, [userReadPermissionId])
  assert.equal(readPayload.json.userCount, 0)

  const updateResponse = await app.request(
    `http://localhost/api/v1/system/roles/${createPayload.json.id}`,
    {
      body: JSON.stringify({
        code: `ops_updated_${roleSuffix}`,
        description: 'Contract CRUD Role Updated',
        name: `Contract Role Updated ${roleSuffix}`,
        permissionIds: [roleReadPermissionId, userReadPermissionId],
        sortOrder: 50,
        status: true,
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
      code: string
      id: string
      name: string
      permissionIds: string[]
      sortOrder: number
    }
  }

  assert.equal(updateResponse.status, 200)
  assert.equal(updatePayload.json.id, createPayload.json.id)
  assert.equal(updatePayload.json.code, `ops_updated_${roleSuffix}`)
  assert.equal(updatePayload.json.name, `Contract Role Updated ${roleSuffix}`)
  assert.deepEqual(updatePayload.json.permissionIds, [roleReadPermissionId, userReadPermissionId])
  assert.equal(updatePayload.json.sortOrder, 50)

  const deleteResponse = await app.request(
    `http://localhost/api/v1/system/roles/${createPayload.json.id}`,
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
    `http://localhost/api/v1/system/roles/${createPayload.json.id}`,
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
  assert.match(deletedReadPayload.message, /Role not found/)

  const systemRoleLogs = await listOperationLogsByModule('system_roles')
  const targetLogs = systemRoleLogs.filter((log) => log.targetId === createPayload.json.id)

  assert.ok(targetLogs.some((log) => log.action === 'create_role'))
  assert.ok(targetLogs.some((log) => log.action === 'update_role'))
  assert.ok(targetLogs.some((log) => log.action === 'delete_role'))
})

test('viewer cannot create roles through the contract-first write route', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const { userReadPermissionId } = await loadRoleCrudPermissionIds()
  const response = await app.request('http://localhost/api/v1/system/roles', {
    body: JSON.stringify({
      code: `viewer_blocked_${randomUUID().slice(0, 8)}`,
      description: 'Blocked Viewer Role Mutation',
      name: 'Blocked Viewer Role Mutation',
      permissionIds: [userReadPermissionId],
      sortOrder: 20,
      status: true,
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
  assert.match(payload.message, /manage:Role|manage:all/)
})

test('seeded system roles remain read-only through the contract-first write route', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const [viewerRole] = await db
    .select({
      id: roles.id,
    })
    .from(roles)
    .where(eq(roles.code, 'viewer'))
    .limit(1)

  assert.ok(viewerRole, 'Expected seeded viewer role to exist')

  const response = await app.request(`http://localhost/api/v1/system/roles/${viewerRole.id}`, {
    headers: authHeaders,
    method: 'DELETE',
  })
  const payload = (await response.json()) as {
    code: string
    message: string
  }

  assert.equal(response.status, 400)
  assert.equal(payload.code, 'BAD_REQUEST')
  assert.match(payload.message, /Seeded system role viewer is read-only/)
})

test('super_admin can perform full contract-first CRUD on custom system permissions', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const permissionSuffix = randomUUID().slice(0, 8)
  const createResponse = await app.request('http://localhost/api/v1/system/permissions', {
    body: JSON.stringify({
      action: 'approve',
      conditions: { department: 'finance', permissionSuffix },
      description: 'Contract CRUD Permission',
      fields: ['status', 'approverId'],
      inverted: false,
      resource: 'Approval',
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const createPayload = (await createResponse.json()) as {
    json: {
      action: string
      id: string
      resource: string
      roleCount: number
    }
  }

  assert.equal(createResponse.status, 200)
  assert.equal(createPayload.json.action, 'approve')
  assert.equal(createPayload.json.resource, 'Approval')
  assert.equal(createPayload.json.roleCount, 0)

  const readResponse = await app.request(
    `http://localhost/api/v1/system/permissions/${createPayload.json.id}`,
    {
      headers: authHeaders,
    },
  )
  const readPayload = (await readResponse.json()) as {
    json: {
      conditions: Record<string, unknown> | null
      fields: string[] | null
      id: string
      roleCount: number
    }
  }

  assert.equal(readResponse.status, 200)
  assert.equal(readPayload.json.id, createPayload.json.id)
  assert.deepEqual(readPayload.json.fields, ['approverId', 'status'])
  assert.deepEqual(readPayload.json.conditions, {
    department: 'finance',
    permissionSuffix,
  })
  assert.equal(readPayload.json.roleCount, 0)

  const updateResponse = await app.request(
    `http://localhost/api/v1/system/permissions/${createPayload.json.id}`,
    {
      body: JSON.stringify({
        action: 'import',
        conditions: { department: 'finance', permissionSuffix, stage: 'review' },
        description: 'Contract CRUD Permission Updated',
        fields: ['status'],
        inverted: true,
        resource: 'Config',
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
      action: string
      description: string | null
      fields: string[] | null
      id: string
      inverted: boolean
      resource: string
    }
  }

  assert.equal(updateResponse.status, 200)
  assert.equal(updatePayload.json.id, createPayload.json.id)
  assert.equal(updatePayload.json.action, 'import')
  assert.equal(updatePayload.json.resource, 'Config')
  assert.equal(updatePayload.json.description, 'Contract CRUD Permission Updated')
  assert.deepEqual(updatePayload.json.fields, ['status'])
  assert.equal(updatePayload.json.inverted, true)

  const deleteResponse = await app.request(
    `http://localhost/api/v1/system/permissions/${createPayload.json.id}`,
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
    `http://localhost/api/v1/system/permissions/${createPayload.json.id}`,
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
  assert.match(deletedReadPayload.message, /Permission not found/)

  const systemPermissionLogs = await listOperationLogsByModule('system_permissions')
  const targetLogs = systemPermissionLogs.filter((log) => log.targetId === createPayload.json.id)

  assert.ok(targetLogs.some((log) => log.action === 'create_permission'))
  assert.ok(targetLogs.some((log) => log.action === 'update_permission'))
  assert.ok(targetLogs.some((log) => log.action === 'delete_permission'))
})

test('viewer cannot create permissions through the contract-first write route', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const response = await app.request('http://localhost/api/v1/system/permissions', {
    body: JSON.stringify({
      action: 'approve',
      conditions: null,
      description: 'Blocked Viewer Permission Mutation',
      fields: ['status'],
      inverted: false,
      resource: 'Approval',
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
  assert.match(payload.message, /manage:Permission|manage:all/)
})

test('seeded permissions remain read-only through the contract-first write route', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const [viewerPermission] = await db
    .select({
      id: permissions.id,
    })
    .from(permissions)
    .where(and(eq(permissions.action, 'read'), eq(permissions.resource, 'Role')))
    .limit(1)

  assert.ok(viewerPermission, 'Expected seeded read:Role permission to exist')

  const response = await app.request(
    `http://localhost/api/v1/system/permissions/${viewerPermission.id}`,
    {
      headers: authHeaders,
      method: 'DELETE',
    },
  )
  const payload = (await response.json()) as {
    code: string
    message: string
  }

  assert.equal(response.status, 400)
  assert.equal(payload.code, 'BAD_REQUEST')
  assert.match(payload.message, /Seeded permission is read-only/)
})

test('assigned custom permissions cannot change semantics until roles are unbound', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const permissionSuffix = randomUUID().slice(0, 8)
  const permissionResponse = await app.request('http://localhost/api/v1/system/permissions', {
    body: JSON.stringify({
      action: 'approve',
      conditions: { permissionSuffix },
      description: 'Bound Permission Mutation Guard',
      fields: ['status'],
      inverted: false,
      resource: 'Approval',
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const permissionPayload = (await permissionResponse.json()) as {
    json: {
      id: string
    }
  }

  assert.equal(permissionResponse.status, 200)

  const roleResponse = await app.request('http://localhost/api/v1/system/roles', {
    body: JSON.stringify({
      code: `guard_role_${permissionSuffix}`,
      description: 'Permission guard test role',
      name: `Permission Guard ${permissionSuffix}`,
      permissionIds: [permissionPayload.json.id],
      sortOrder: 90,
      status: true,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const rolePayload = (await roleResponse.json()) as {
    json: {
      id: string
    }
  }

  assert.equal(roleResponse.status, 200)

  const blockedUpdateResponse = await app.request(
    `http://localhost/api/v1/system/permissions/${permissionPayload.json.id}`,
    {
      body: JSON.stringify({
        action: 'import',
        conditions: { permissionSuffix, stage: 'changed' },
        description: 'Permission semantics changed while bound',
        fields: ['status'],
        inverted: false,
        resource: 'Config',
      }),
      headers: {
        ...Object.fromEntries(authHeaders.entries()),
        'content-type': 'application/json',
      },
      method: 'PUT',
    },
  )
  const blockedPayload = (await blockedUpdateResponse.json()) as {
    code: string
    message: string
  }

  assert.equal(blockedUpdateResponse.status, 400)
  assert.equal(blockedPayload.code, 'BAD_REQUEST')
  assert.match(blockedPayload.message, /Assigned roles must be removed/)

  const roleDeleteResponse = await app.request(
    `http://localhost/api/v1/system/roles/${rolePayload.json.id}`,
    {
      headers: authHeaders,
      method: 'DELETE',
    },
  )

  assert.equal(roleDeleteResponse.status, 200)

  const permissionDeleteResponse = await app.request(
    `http://localhost/api/v1/system/permissions/${permissionPayload.json.id}`,
    {
      headers: authHeaders,
      method: 'DELETE',
    },
  )

  assert.equal(permissionDeleteResponse.status, 200)
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
