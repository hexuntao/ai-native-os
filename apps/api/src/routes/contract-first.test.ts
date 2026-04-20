import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import {
  account,
  anonymousOperationActorId,
  user as authUsers,
  db,
  defaultMenus,
  hashCredentialPassword,
  listAiAuditLogsByToolId,
  listAiEvalRunsByEvalKey,
  listOperationLogsByModule,
  menus,
  permissions,
  repairPrincipalBindings,
  rolePermissions,
  roles,
  userRoles,
  users,
  writeAiAuditLog,
  writeOperationLog,
} from '@ai-native-os/db'
import type { MenuEntry } from '@ai-native-os/shared'
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

  // 显式对齐测试主体绑定，避免继续依赖已移除的运行态 email 回填。
  await repairPrincipalBindings([userId])

  const authHeaders = convertSetCookieToCookie(signInResponse.headers)

  authHeaders.set('origin', origin)

  return authHeaders
}

// 为主体修复与权限硬化合同测试创建最小 Better Auth 主体。
async function createAuthIdentity(authUserId: string, email: string, name: string): Promise<void> {
  const now = new Date()

  await db.insert(authUsers).values({
    createdAt: now,
    email,
    emailVerified: true,
    id: authUserId,
    image: null,
    name,
    updatedAt: now,
  })

  await db.insert(account).values({
    accessToken: null,
    accessTokenExpiresAt: null,
    accountId: authUserId,
    createdAt: now,
    id: randomUUID(),
    idToken: null,
    password: await hashCredentialPassword('Passw0rd!Passw0rd!'),
    providerId: 'credential',
    refreshToken: null,
    refreshTokenExpiresAt: null,
    scope: null,
    updatedAt: now,
    userId: authUserId,
  })
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
  assert.ok(
    '/api/v1/system/menus/{id}' in payload.paths || '/api/v1/system/menus/:id' in payload.paths,
  )
  assert.ok('/api/v1/system/dicts' in payload.paths)
  assert.ok(
    '/api/v1/system/dicts/{id}' in payload.paths || '/api/v1/system/dicts/:id' in payload.paths,
  )
  assert.ok('/api/v1/system/config' in payload.paths)
  assert.ok(
    '/api/v1/system/config/{id}' in payload.paths || '/api/v1/system/config/:id' in payload.paths,
  )
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

test('OpenAPI document exposes standardized error components for contract-first operations', async () => {
  const response = await app.request('http://localhost/api/openapi.json')
  const payload = (await response.json()) as OpenApiDocument
  const components = payload.components as {
    responses?: Record<string, unknown>
    schemas?: Record<string, unknown>
  }

  assert.ok(components && isRecord(components), 'Expected OpenAPI components to exist')
  assert.ok(isRecord(components.responses), 'Expected standardized OpenAPI responses to exist')
  assert.ok(isRecord(components.schemas), 'Expected standardized OpenAPI schemas to exist')
  assert.ok('BadRequestError' in components.responses)
  assert.ok('UnauthorizedError' in components.responses)
  assert.ok('ForbiddenError' in components.responses)
  assert.ok('NotFoundError' in components.responses)
  assert.ok('RateLimitedError' in components.responses)
  assert.ok('ApiError' in components.schemas)
  assert.ok('ValidationError' in components.schemas)
  assert.ok('RateLimitError' in components.schemas)

  const configPath = payload.paths['/api/v1/system/config']

  assert.ok(configPath && isRecord(configPath), 'Expected /api/v1/system/config path to exist')

  const postOperation = configPath.post

  assert.ok(postOperation && isRecord(postOperation), 'Expected POST operation for system config')
  assert.ok(isRecord(postOperation.responses), 'Expected standardized responses on config POST')
  assert.ok('400' in postOperation.responses)
  assert.ok('401' in postOperation.responses)
  assert.ok('403' in postOperation.responses)
  assert.ok('404' in postOperation.responses)
  assert.ok('429' in postOperation.responses)
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

test('OpenAPI document exposes rich schema metadata for system menu write contracts', async () => {
  const response = await app.request('http://localhost/api/openapi.json')
  const payload = (await response.json()) as OpenApiDocument
  const menusPath = payload.paths['/api/v1/system/menus']

  assert.ok(menusPath && isRecord(menusPath), 'Expected /api/v1/system/menus path to exist')

  const postOperation = menusPath.post

  assert.ok(postOperation && isRecord(postOperation), 'Expected POST operation for system menus')
  assert.equal(postOperation.summary, '创建菜单')
  assert.equal(
    postOperation.description,
    '创建自定义菜单节点并写入路径、层级和权限绑定元数据；服务端会校验父级存在、路径唯一和权限绑定完整性，并记录审计日志。',
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

  assert.equal(inputSchema.title, 'CreateMenuInput')
  assert.equal(
    inputSchema.description,
    '创建自定义菜单节点；系统会校验父子关系、路径与权限绑定完整性，并拒绝与现有路径冲突的菜单。',
  )
  assert.ok(
    isRecord(inputSchema.properties) &&
      isRecord(inputSchema.properties.path) &&
      inputSchema.properties.path.description ===
        '新菜单路径；目录节点可为空，页面菜单建议填写站内绝对路径。',
  )
  assert.ok(
    isRecord(inputSchema.properties) &&
      isRecord(inputSchema.properties.parentId) &&
      inputSchema.properties.parentId.description === '父级菜单 UUID；创建顶级菜单时传 `null`。',
  )
  assert.ok(
    isRecord(inputSchema.properties) &&
      isRecord(inputSchema.properties.permissionAction) &&
      inputSchema.properties.permissionAction.description ===
        '菜单访问所需动作；若配置权限，必须与资源主体成对出现。',
  )

  const responses = postOperation.responses

  assert.ok(responses && isRecord(responses), 'Expected response metadata to exist')

  const responseJson =
    isRecord(responses['200']) && isRecord(responses['200'].content)
      ? responses['200'].content['application/json']
      : undefined

  assert.ok(responseJson && isRecord(responseJson), 'Expected JSON response schema to exist')

  const outputSchema = resolveOpenApiSchema(payload, responseJson.schema)

  assert.equal(outputSchema.title, 'MenuEntry')
  assert.equal(
    outputSchema.description,
    '菜单条目，描述后台导航节点、其层级关系以及绑定的权限元数据。',
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

test('OpenAPI document exposes rich schema metadata for AI contract surfaces', async () => {
  const response = await app.request('http://localhost/api/openapi.json')
  const payload = (await response.json()) as OpenApiDocument

  const knowledgePath = payload.paths['/api/v1/ai/knowledge']
  assert.ok(knowledgePath && isRecord(knowledgePath), 'Expected /api/v1/ai/knowledge path to exist')

  const knowledgeGet = knowledgePath.get
  assert.ok(knowledgeGet && isRecord(knowledgeGet), 'Expected GET operation for ai knowledge')
  assert.equal(knowledgeGet.summary, '分页查询知识库文档')
  assert.equal(
    knowledgeGet.description,
    '按文档维度聚合 pgvector chunk 记录，返回 AI 知识库管理页使用的知识摘要列表。',
  )

  const knowledgeResponses = knowledgeGet.responses
  assert.ok(knowledgeResponses && isRecord(knowledgeResponses), 'Expected AI knowledge responses')
  const knowledgeJson =
    isRecord(knowledgeResponses['200']) && isRecord(knowledgeResponses['200'].content)
      ? knowledgeResponses['200'].content['application/json']
      : undefined
  assert.ok(knowledgeJson && isRecord(knowledgeJson), 'Expected AI knowledge JSON response schema')
  const knowledgeOutputSchema = resolveOpenApiSchema(payload, knowledgeJson.schema)
  assert.equal(knowledgeOutputSchema.title, 'KnowledgeListResponse')
  assert.equal(
    knowledgeOutputSchema.description,
    '知识库分页响应，返回文档级摘要列表与标准分页信息。',
  )

  const knowledgePost = knowledgePath.post
  assert.ok(knowledgePost && isRecord(knowledgePost), 'Expected POST operation for ai knowledge')
  assert.equal(knowledgePost.summary, '创建知识文档并建立索引')
  const knowledgePostRequestBody = knowledgePost.requestBody
  assert.ok(
    knowledgePostRequestBody && isRecord(knowledgePostRequestBody),
    'Expected AI knowledge create request body metadata',
  )
  const knowledgePostContent = knowledgePostRequestBody.content
  assert.ok(
    knowledgePostContent && isRecord(knowledgePostContent),
    'Expected AI knowledge create request content map',
  )
  const knowledgePostJson = knowledgePostContent['application/json']
  assert.ok(
    knowledgePostJson && isRecord(knowledgePostJson),
    'Expected AI knowledge create JSON request body',
  )
  const knowledgeCreateInputSchema = resolveOpenApiSchema(payload, knowledgePostJson.schema)
  assert.equal(knowledgeCreateInputSchema.title, 'CreateKnowledgeInput')

  const knowledgeByIdPath =
    payload.paths['/api/v1/ai/knowledge/:id'] ?? payload.paths['/api/v1/ai/knowledge/{id}']
  assert.ok(
    knowledgeByIdPath && isRecord(knowledgeByIdPath),
    'Expected /api/v1/ai/knowledge/:id path to exist',
  )
  const knowledgeByIdGet = knowledgeByIdPath.get
  assert.ok(
    knowledgeByIdGet && isRecord(knowledgeByIdGet),
    'Expected GET operation for ai knowledge detail',
  )
  assert.equal(knowledgeByIdGet.summary, '读取单个知识文档详情')
  const knowledgeByIdResponses = knowledgeByIdGet.responses
  const knowledgeByIdJson =
    knowledgeByIdResponses &&
    isRecord(knowledgeByIdResponses) &&
    isRecord(knowledgeByIdResponses['200']) &&
    isRecord(knowledgeByIdResponses['200'].content)
      ? knowledgeByIdResponses['200'].content['application/json']
      : undefined
  assert.ok(
    knowledgeByIdJson && isRecord(knowledgeByIdJson),
    'Expected AI knowledge detail JSON response schema',
  )
  const knowledgeEntryOutputSchema = resolveOpenApiSchema(payload, knowledgeByIdJson.schema)
  assert.equal(knowledgeEntryOutputSchema.title, 'KnowledgeEntry')

  const knowledgeByIdPut = knowledgeByIdPath.put
  assert.ok(
    knowledgeByIdPut && isRecord(knowledgeByIdPut),
    'Expected PUT operation for ai knowledge detail',
  )
  assert.equal(knowledgeByIdPut.summary, '重建单个知识文档索引')
  const knowledgePutRequestBody = knowledgeByIdPut.requestBody
  assert.ok(
    knowledgePutRequestBody && isRecord(knowledgePutRequestBody),
    'Expected AI knowledge update request body metadata',
  )
  const knowledgePutContent = knowledgePutRequestBody.content
  assert.ok(
    knowledgePutContent && isRecord(knowledgePutContent),
    'Expected AI knowledge update request content map',
  )
  const knowledgePutJson = knowledgePutContent['application/json']
  assert.ok(
    knowledgePutJson && isRecord(knowledgePutJson),
    'Expected AI knowledge update JSON request body',
  )
  const knowledgeUpdateInputSchema = resolveOpenApiSchema(payload, knowledgePutJson.schema)
  assert.equal(knowledgeUpdateInputSchema.title, 'UpdateKnowledgeInput')

  const knowledgeByIdDelete = knowledgeByIdPath.delete
  assert.ok(
    knowledgeByIdDelete && isRecord(knowledgeByIdDelete),
    'Expected DELETE operation for ai knowledge detail',
  )
  assert.equal(knowledgeByIdDelete.summary, '删除单个知识文档')

  const feedbackPath = payload.paths['/api/v1/ai/feedback']
  assert.ok(feedbackPath && isRecord(feedbackPath), 'Expected /api/v1/ai/feedback path to exist')

  const feedbackPost = feedbackPath.post
  assert.ok(feedbackPost && isRecord(feedbackPost), 'Expected POST operation for ai feedback')
  assert.equal(feedbackPost.summary, '提交 AI 反馈记录')
  assert.equal(
    feedbackPost.description,
    '向指定 AI 审计日志写入反馈或人工接管结果，并同步记录操作审计日志。',
  )

  const feedbackRequestBody = feedbackPost.requestBody
  assert.ok(
    feedbackRequestBody && isRecord(feedbackRequestBody),
    'Expected AI feedback request body metadata',
  )
  const feedbackRequestContent = feedbackRequestBody.content
  assert.ok(
    feedbackRequestContent && isRecord(feedbackRequestContent),
    'Expected AI feedback request content map',
  )
  const feedbackJson = feedbackRequestContent['application/json']
  assert.ok(feedbackJson && isRecord(feedbackJson), 'Expected AI feedback JSON request body')
  const feedbackInputSchema = resolveOpenApiSchema(payload, feedbackJson.schema)
  assert.equal(feedbackInputSchema.title, 'CreateAiFeedbackInput')
  assert.equal(
    feedbackInputSchema.description,
    '提交一次 AI 反馈或人工接管结果，并绑定到指定 AI 审计日志。',
  )
  assert.ok(
    isRecord(feedbackInputSchema.properties) &&
      isRecord(feedbackInputSchema.properties.correction) &&
      feedbackInputSchema.properties.correction.description ===
        '人工修正文案；当 `userAction` 为 `edited` 或 `overridden` 时必填，用于记录人工替代结果。',
  )

  const promptsPath = payload.paths['/api/v1/ai/prompts']
  assert.ok(promptsPath && isRecord(promptsPath), 'Expected /api/v1/ai/prompts path to exist')

  const promptsPost = promptsPath.post
  assert.ok(promptsPost && isRecord(promptsPost), 'Expected POST operation for ai prompts')
  assert.equal(promptsPost.summary, '创建 Prompt 草稿版本')
  assert.equal(
    promptsPost.description,
    '创建新的 Prompt 治理草稿版本，供后续评测、激活和回滚流程使用。',
  )

  const promptsRequestBody = promptsPost.requestBody
  assert.ok(
    promptsRequestBody && isRecord(promptsRequestBody),
    'Expected AI prompts request body metadata',
  )
  const promptsRequestContent = promptsRequestBody.content
  assert.ok(
    promptsRequestContent && isRecord(promptsRequestContent),
    'Expected AI prompts request content map',
  )
  const promptsJson = promptsRequestContent['application/json']
  assert.ok(promptsJson && isRecord(promptsJson), 'Expected AI prompts JSON request body')
  const promptsInputSchema = resolveOpenApiSchema(payload, promptsJson.schema)
  assert.equal(promptsInputSchema.title, 'CreatePromptVersionInput')
  assert.equal(
    promptsInputSchema.description,
    '创建新的 Prompt 草稿版本，供后续评测、激活或回滚治理流程使用。',
  )
  assert.ok(
    isRecord(promptsInputSchema.properties) &&
      isRecord(promptsInputSchema.properties.releasePolicy) &&
      promptsInputSchema.properties.releasePolicy.description ===
        '新版本发布门禁策略；未传时使用默认阈值。',
  )

  const promptsDetailPath =
    payload.paths['/api/v1/ai/prompts/:id'] ?? payload.paths['/api/v1/ai/prompts/{id}']
  assert.ok(
    promptsDetailPath && isRecord(promptsDetailPath),
    'Expected /api/v1/ai/prompts/:id path to exist',
  )
  const promptsDetailGet = promptsDetailPath.get
  assert.ok(
    promptsDetailGet && isRecord(promptsDetailGet),
    'Expected GET operation for ai prompt detail',
  )
  assert.equal(promptsDetailGet.summary, '读取单个 Prompt 版本详情')
  const promptsDetailResponses = promptsDetailGet.responses
  const promptsDetailJson =
    promptsDetailResponses &&
    isRecord(promptsDetailResponses) &&
    isRecord(promptsDetailResponses['200']) &&
    isRecord(promptsDetailResponses['200'].content)
      ? promptsDetailResponses['200'].content['application/json']
      : undefined
  assert.ok(
    promptsDetailJson && isRecord(promptsDetailJson),
    'Expected AI prompt detail JSON response schema',
  )
  const promptDetailSchema = resolveOpenApiSchema(payload, promptsDetailJson.schema)
  assert.equal(promptDetailSchema.title, 'PromptVersionDetail')

  const promptsComparePath =
    payload.paths['/api/v1/ai/prompts/:id/compare/:baselineId'] ??
    payload.paths['/api/v1/ai/prompts/{id}/compare/{baselineId}']
  assert.ok(
    promptsComparePath && isRecord(promptsComparePath),
    'Expected /api/v1/ai/prompts/:id/compare/:baselineId path to exist',
  )
  const promptsCompareGet = promptsComparePath.get
  assert.ok(
    promptsCompareGet && isRecord(promptsCompareGet),
    'Expected GET operation for ai prompt compare',
  )
  assert.equal(promptsCompareGet.summary, '对比两个 Prompt 版本')
  const promptsCompareResponses = promptsCompareGet.responses
  const promptsCompareJson =
    promptsCompareResponses &&
    isRecord(promptsCompareResponses) &&
    isRecord(promptsCompareResponses['200']) &&
    isRecord(promptsCompareResponses['200'].content)
      ? promptsCompareResponses['200'].content['application/json']
      : undefined
  assert.ok(
    promptsCompareJson && isRecord(promptsCompareJson),
    'Expected AI prompt compare JSON response schema',
  )
  const promptCompareSchema = resolveOpenApiSchema(payload, promptsCompareJson.schema)
  assert.equal(promptCompareSchema.title, 'PromptVersionCompare')

  const promptsHistoryPath =
    payload.paths['/api/v1/ai/prompts/history/:promptKey'] ??
    payload.paths['/api/v1/ai/prompts/history/{promptKey}']
  assert.ok(
    promptsHistoryPath && isRecord(promptsHistoryPath),
    'Expected /api/v1/ai/prompts/history/:promptKey path to exist',
  )
  const promptsHistoryGet = promptsHistoryPath.get
  assert.ok(
    promptsHistoryGet && isRecord(promptsHistoryGet),
    'Expected GET operation for ai prompt history',
  )
  assert.equal(promptsHistoryGet.summary, '读取 Prompt 发布历史')
  const promptsHistoryResponses = promptsHistoryGet.responses
  const promptsHistoryJson =
    promptsHistoryResponses &&
    isRecord(promptsHistoryResponses) &&
    isRecord(promptsHistoryResponses['200']) &&
    isRecord(promptsHistoryResponses['200'].content)
      ? promptsHistoryResponses['200'].content['application/json']
      : undefined
  assert.ok(
    promptsHistoryJson && isRecord(promptsHistoryJson),
    'Expected AI prompt history JSON response schema',
  )
  const promptHistorySchema = resolveOpenApiSchema(payload, promptsHistoryJson.schema)
  assert.equal(promptHistorySchema.title, 'PromptVersionHistory')

  const promptsReleaseAuditPath =
    payload.paths['/api/v1/ai/prompts/:id/release-audit'] ??
    payload.paths['/api/v1/ai/prompts/{id}/release-audit']
  assert.ok(
    promptsReleaseAuditPath && isRecord(promptsReleaseAuditPath),
    'Expected /api/v1/ai/prompts/:id/release-audit path to exist',
  )
  const promptsReleaseAuditGet = promptsReleaseAuditPath.get
  assert.ok(
    promptsReleaseAuditGet && isRecord(promptsReleaseAuditGet),
    'Expected GET operation for ai prompt release audit',
  )
  assert.equal(promptsReleaseAuditGet.summary, '读取 Prompt 发布审批审计')
  const promptsReleaseAuditResponses = promptsReleaseAuditGet.responses
  const promptsReleaseAuditJson =
    promptsReleaseAuditResponses &&
    isRecord(promptsReleaseAuditResponses) &&
    isRecord(promptsReleaseAuditResponses['200']) &&
    isRecord(promptsReleaseAuditResponses['200'].content)
      ? promptsReleaseAuditResponses['200'].content['application/json']
      : undefined
  assert.ok(
    promptsReleaseAuditJson && isRecord(promptsReleaseAuditJson),
    'Expected AI prompt release audit JSON response schema',
  )
  const promptReleaseAuditSchema = resolveOpenApiSchema(payload, promptsReleaseAuditJson.schema)
  assert.equal(promptReleaseAuditSchema.title, 'PromptReleaseAudit')

  const promptsFailureAuditPath =
    payload.paths['/api/v1/ai/prompts/failure-audit/:promptKey'] ??
    payload.paths['/api/v1/ai/prompts/failure-audit/{promptKey}']
  assert.ok(
    promptsFailureAuditPath && isRecord(promptsFailureAuditPath),
    'Expected /api/v1/ai/prompts/failure-audit/:promptKey path to exist',
  )
  const promptsFailureAuditGet = promptsFailureAuditPath.get
  assert.ok(
    promptsFailureAuditGet && isRecord(promptsFailureAuditGet),
    'Expected GET operation for ai prompt failure audit',
  )
  assert.equal(promptsFailureAuditGet.summary, '读取 Prompt 治理失败审计')
  const promptsFailureAuditResponses = promptsFailureAuditGet.responses
  const promptsFailureAuditJson =
    promptsFailureAuditResponses &&
    isRecord(promptsFailureAuditResponses) &&
    isRecord(promptsFailureAuditResponses['200']) &&
    isRecord(promptsFailureAuditResponses['200'].content)
      ? promptsFailureAuditResponses['200'].content['application/json']
      : undefined
  assert.ok(
    promptsFailureAuditJson && isRecord(promptsFailureAuditJson),
    'Expected AI prompt failure audit JSON response schema',
  )
  const promptFailureAuditSchema = resolveOpenApiSchema(payload, promptsFailureAuditJson.schema)
  assert.equal(promptFailureAuditSchema.title, 'PromptGovernanceFailureAudit')

  const promptsRollbackChainPath =
    payload.paths['/api/v1/ai/prompts/rollback-chain/:promptKey'] ??
    payload.paths['/api/v1/ai/prompts/rollback-chain/{promptKey}']
  assert.ok(
    promptsRollbackChainPath && isRecord(promptsRollbackChainPath),
    'Expected /api/v1/ai/prompts/rollback-chain/:promptKey path to exist',
  )
  const promptsRollbackChainGet = promptsRollbackChainPath.get
  assert.ok(
    promptsRollbackChainGet && isRecord(promptsRollbackChainGet),
    'Expected GET operation for ai prompt rollback chain',
  )
  assert.equal(promptsRollbackChainGet.summary, '读取 Prompt 回滚链路')
  const promptsRollbackChainResponses = promptsRollbackChainGet.responses
  const promptsRollbackChainJson =
    promptsRollbackChainResponses &&
    isRecord(promptsRollbackChainResponses) &&
    isRecord(promptsRollbackChainResponses['200']) &&
    isRecord(promptsRollbackChainResponses['200'].content)
      ? promptsRollbackChainResponses['200'].content['application/json']
      : undefined
  assert.ok(
    promptsRollbackChainJson && isRecord(promptsRollbackChainJson),
    'Expected AI prompt rollback chain JSON response schema',
  )
  const promptRollbackChainSchema = resolveOpenApiSchema(payload, promptsRollbackChainJson.schema)
  assert.equal(promptRollbackChainSchema.title, 'PromptRollbackChain')

  const governanceOverviewPath = payload.paths['/api/v1/ai/governance/overview']
  assert.ok(
    governanceOverviewPath && isRecord(governanceOverviewPath),
    'Expected /api/v1/ai/governance/overview path to exist',
  )
  const governanceOverviewGet = governanceOverviewPath.get
  assert.ok(
    governanceOverviewGet && isRecord(governanceOverviewGet),
    'Expected GET operation for ai governance overview',
  )
  assert.equal(governanceOverviewGet.summary, '读取 AI 治理总览')
  const governanceOverviewResponses = governanceOverviewGet.responses
  const governanceOverviewJson =
    governanceOverviewResponses &&
    isRecord(governanceOverviewResponses) &&
    isRecord(governanceOverviewResponses['200']) &&
    isRecord(governanceOverviewResponses['200'].content)
      ? governanceOverviewResponses['200'].content['application/json']
      : undefined
  assert.ok(
    governanceOverviewJson && isRecord(governanceOverviewJson),
    'Expected AI governance overview JSON response schema',
  )
  const governanceOverviewSchema = resolveOpenApiSchema(payload, governanceOverviewJson.schema)
  assert.equal(governanceOverviewSchema.title, 'AiGovernanceOverview')

  const governancePromptReviewPath =
    payload.paths['/api/v1/ai/governance/prompts/:promptKey'] ??
    payload.paths['/api/v1/ai/governance/prompts/{promptKey}']
  assert.ok(
    governancePromptReviewPath && isRecord(governancePromptReviewPath),
    'Expected /api/v1/ai/governance/prompts/:promptKey path to exist',
  )
  const governancePromptReviewGet = governancePromptReviewPath.get
  assert.ok(
    governancePromptReviewGet && isRecord(governancePromptReviewGet),
    'Expected GET operation for ai prompt governance review',
  )
  assert.equal(governancePromptReviewGet.summary, '读取单个 Prompt 治理读模型')
  const governancePromptReviewResponses = governancePromptReviewGet.responses
  const governancePromptReviewJson =
    governancePromptReviewResponses &&
    isRecord(governancePromptReviewResponses) &&
    isRecord(governancePromptReviewResponses['200']) &&
    isRecord(governancePromptReviewResponses['200'].content)
      ? governancePromptReviewResponses['200'].content['application/json']
      : undefined
  assert.ok(
    governancePromptReviewJson && isRecord(governancePromptReviewJson),
    'Expected AI prompt governance review JSON response schema',
  )
  const governancePromptReviewSchema = resolveOpenApiSchema(
    payload,
    governancePromptReviewJson.schema,
  )
  assert.equal(governancePromptReviewSchema.title, 'PromptGovernanceReview')

  const auditPath = payload.paths['/api/v1/ai/audit']
  assert.ok(auditPath && isRecord(auditPath), 'Expected /api/v1/ai/audit path to exist')

  const auditGet = auditPath.get
  assert.ok(auditGet && isRecord(auditGet), 'Expected GET operation for ai audit')
  assert.equal(auditGet.summary, '分页查询 AI 审计日志')
  assert.equal(auditGet.description, '返回 AI Tool 调用审计轨迹、反馈汇总和主体权限上下文。')

  const auditDetailPath =
    payload.paths['/api/v1/ai/audit/:id'] ?? payload.paths['/api/v1/ai/audit/{id}']
  assert.ok(
    auditDetailPath && isRecord(auditDetailPath),
    'Expected /api/v1/ai/audit/:id path to exist',
  )
  const auditDetailGet = auditDetailPath.get
  assert.ok(
    auditDetailGet && isRecord(auditDetailGet),
    'Expected GET operation for ai audit detail',
  )
  assert.equal(auditDetailGet.summary, '读取单条 AI 审计日志详情')
  const auditDetailResponses = auditDetailGet.responses
  const auditDetailJson =
    auditDetailResponses &&
    isRecord(auditDetailResponses) &&
    isRecord(auditDetailResponses['200']) &&
    isRecord(auditDetailResponses['200'].content)
      ? auditDetailResponses['200'].content['application/json']
      : undefined
  assert.ok(
    auditDetailJson && isRecord(auditDetailJson),
    'Expected AI audit detail JSON response schema',
  )
  const auditDetailSchema = resolveOpenApiSchema(payload, auditDetailJson.schema)
  assert.equal(auditDetailSchema.title, 'AiAuditDetail')

  const feedbackDetailPath =
    payload.paths['/api/v1/ai/feedback/:id'] ?? payload.paths['/api/v1/ai/feedback/{id}']
  assert.ok(
    feedbackDetailPath && isRecord(feedbackDetailPath),
    'Expected /api/v1/ai/feedback/:id path to exist',
  )
  const feedbackDetailGet = feedbackDetailPath.get
  assert.ok(
    feedbackDetailGet && isRecord(feedbackDetailGet),
    'Expected GET operation for ai feedback detail',
  )
  assert.equal(feedbackDetailGet.summary, '读取单条 AI 反馈详情')
  const feedbackDetailResponses = feedbackDetailGet.responses
  const feedbackDetailJson =
    feedbackDetailResponses &&
    isRecord(feedbackDetailResponses) &&
    isRecord(feedbackDetailResponses['200']) &&
    isRecord(feedbackDetailResponses['200'].content)
      ? feedbackDetailResponses['200'].content['application/json']
      : undefined
  assert.ok(
    feedbackDetailJson && isRecord(feedbackDetailJson),
    'Expected AI feedback detail JSON response schema',
  )
  const feedbackDetailSchema = resolveOpenApiSchema(payload, feedbackDetailJson.schema)
  assert.equal(feedbackDetailSchema.title, 'AiFeedbackDetail')

  const evalsPath = payload.paths['/api/v1/ai/evals']
  assert.ok(evalsPath && isRecord(evalsPath), 'Expected /api/v1/ai/evals path to exist')

  const evalsGet = evalsPath.get
  assert.ok(evalsGet && isRecord(evalsGet), 'Expected GET operation for ai evals')
  assert.equal(evalsGet.summary, '分页查询 AI 评测目录')
  assert.equal(evalsGet.description, '返回已注册的评测套件、最近实验结果和当前评测运行环境汇总。')

  const evalsResponses = evalsGet.responses
  assert.ok(evalsResponses && isRecord(evalsResponses), 'Expected AI evals responses')
  const evalsJson =
    isRecord(evalsResponses['200']) && isRecord(evalsResponses['200'].content)
      ? evalsResponses['200'].content['application/json']
      : undefined
  assert.ok(evalsJson && isRecord(evalsJson), 'Expected AI evals JSON response schema')
  const evalsOutputSchema = resolveOpenApiSchema(payload, evalsJson.schema)
  assert.equal(evalsOutputSchema.title, 'AiEvalListResponse')
  assert.equal(
    evalsOutputSchema.description,
    'AI 评测目录分页响应，返回评测条目、分页信息和环境汇总。',
  )

  const evalsDetailPath =
    payload.paths['/api/v1/ai/evals/:id'] ?? payload.paths['/api/v1/ai/evals/{id}']
  assert.ok(
    evalsDetailPath && isRecord(evalsDetailPath),
    'Expected /api/v1/ai/evals/:id path to exist',
  )
  const evalsDetailGet = evalsDetailPath.get
  assert.ok(evalsDetailGet && isRecord(evalsDetailGet), 'Expected GET operation for ai eval detail')
  assert.equal(evalsDetailGet.summary, '读取单个 AI 评测详情')
  const evalsDetailResponses = evalsDetailGet.responses
  const evalsDetailJson =
    evalsDetailResponses &&
    isRecord(evalsDetailResponses) &&
    isRecord(evalsDetailResponses['200']) &&
    isRecord(evalsDetailResponses['200'].content)
      ? evalsDetailResponses['200'].content['application/json']
      : undefined
  assert.ok(
    evalsDetailJson && isRecord(evalsDetailJson),
    'Expected AI eval detail JSON response schema',
  )
  const evalDetailSchema = resolveOpenApiSchema(payload, evalsDetailJson.schema)
  assert.equal(evalDetailSchema.title, 'AiEvalDetail')

  const evalsRunDetailPath =
    payload.paths['/api/v1/ai/evals/:id/runs/:runId'] ??
    payload.paths['/api/v1/ai/evals/{id}/runs/{runId}']
  assert.ok(
    evalsRunDetailPath && isRecord(evalsRunDetailPath),
    'Expected /api/v1/ai/evals/:id/runs/:runId path to exist',
  )
  const evalsRunDetailGet = evalsRunDetailPath.get
  assert.ok(
    evalsRunDetailGet && isRecord(evalsRunDetailGet),
    'Expected GET operation for ai eval run detail',
  )
  assert.equal(evalsRunDetailGet.summary, '读取单次 AI 评测运行详情')
  const evalsRunDetailResponses = evalsRunDetailGet.responses
  const evalsRunDetailJson =
    evalsRunDetailResponses &&
    isRecord(evalsRunDetailResponses) &&
    isRecord(evalsRunDetailResponses['200']) &&
    isRecord(evalsRunDetailResponses['200'].content)
      ? evalsRunDetailResponses['200'].content['application/json']
      : undefined
  assert.ok(
    evalsRunDetailJson && isRecord(evalsRunDetailJson),
    'Expected AI eval run detail JSON response schema',
  )
  const evalRunDetailSchema = resolveOpenApiSchema(payload, evalsRunDetailJson.schema)
  assert.equal(evalRunDetailSchema.title, 'AiEvalRunDetail')

  const evalsRunPath =
    payload.paths['/api/v1/ai/evals/:id/run'] ?? payload.paths['/api/v1/ai/evals/{id}/run']
  assert.ok(
    evalsRunPath && isRecord(evalsRunPath),
    'Expected /api/v1/ai/evals/:id/run path to exist',
  )
  const evalsRunPost = evalsRunPath.post
  assert.ok(evalsRunPost && isRecord(evalsRunPost), 'Expected POST operation for ai eval run')
  assert.equal(evalsRunPost.summary, '手动执行 AI 评测')
  const evalsRunResponses = evalsRunPost.responses
  const evalsRunJson =
    evalsRunResponses &&
    isRecord(evalsRunResponses) &&
    isRecord(evalsRunResponses['200']) &&
    isRecord(evalsRunResponses['200'].content)
      ? evalsRunResponses['200'].content['application/json']
      : undefined
  assert.ok(evalsRunJson && isRecord(evalsRunJson), 'Expected AI eval run JSON response schema')
  const evalRunSchema = resolveOpenApiSchema(payload, evalsRunJson.schema)
  assert.equal(evalRunSchema.title, 'AiEvalRunResult')
})

test('OpenAPI document exposes rich schema metadata for monitor, tools, and system helper surfaces', async () => {
  const response = await app.request('http://localhost/api/openapi.json')
  const payload = (await response.json()) as OpenApiDocument

  const logsPath = payload.paths['/api/v1/monitor/logs']
  assert.ok(logsPath && isRecord(logsPath), 'Expected /api/v1/monitor/logs path to exist')
  const logsGet = logsPath.get
  assert.ok(logsGet && isRecord(logsGet), 'Expected GET operation for monitor logs')
  assert.equal(logsGet.summary, '分页查询操作日志')
  assert.equal(
    logsGet.description,
    '返回监控与审计页面使用的操作日志分页结果，支持按模块、状态和关键词筛选。',
  )
  const logsResponses = logsGet.responses
  const logsJson =
    logsResponses &&
    isRecord(logsResponses) &&
    isRecord(logsResponses['200']) &&
    isRecord(logsResponses['200'].content)
      ? logsResponses['200'].content['application/json']
      : undefined
  assert.ok(logsJson && isRecord(logsJson), 'Expected monitor logs JSON response schema')
  const logsOutputSchema = resolveOpenApiSchema(payload, logsJson.schema)
  assert.equal(logsOutputSchema.title, 'OperationLogListResponse')

  const onlinePath = payload.paths['/api/v1/monitor/online']
  assert.ok(onlinePath && isRecord(onlinePath), 'Expected /api/v1/monitor/online path to exist')
  const onlineGet = onlinePath.get
  assert.ok(onlineGet && isRecord(onlineGet), 'Expected GET operation for monitor online')
  assert.equal(onlineGet.summary, '分页查询在线会话')

  const serverPath = payload.paths['/api/v1/monitor/server']
  assert.ok(serverPath && isRecord(serverPath), 'Expected /api/v1/monitor/server path to exist')
  const serverGet = serverPath.get
  assert.ok(serverGet && isRecord(serverGet), 'Expected GET operation for monitor server')
  assert.equal(serverGet.summary, '读取服务端运行时摘要')
  const serverResponses = serverGet.responses
  const serverJson =
    serverResponses &&
    isRecord(serverResponses) &&
    isRecord(serverResponses['200']) &&
    isRecord(serverResponses['200'].content)
      ? serverResponses['200'].content['application/json']
      : undefined
  assert.ok(serverJson && isRecord(serverJson), 'Expected monitor server JSON response schema')
  const serverOutputSchema = resolveOpenApiSchema(payload, serverJson.schema)
  assert.equal(serverOutputSchema.title, 'ServerSummary')

  const genPath = payload.paths['/api/v1/tools/gen']
  assert.ok(genPath && isRecord(genPath), 'Expected /api/v1/tools/gen path to exist')
  const genGet = genPath.get
  assert.ok(genGet && isRecord(genGet), 'Expected GET operation for tools gen')
  assert.equal(genGet.summary, '分页查询生成能力入口')
  const genResponses = genGet.responses
  const genJson =
    genResponses &&
    isRecord(genResponses) &&
    isRecord(genResponses['200']) &&
    isRecord(genResponses['200'].content)
      ? genResponses['200'].content['application/json']
      : undefined
  assert.ok(genJson && isRecord(genJson), 'Expected tools gen JSON response schema')
  const genOutputSchema = resolveOpenApiSchema(payload, genJson.schema)
  assert.equal(genOutputSchema.title, 'ToolGenListResponse')

  const jobsPath = payload.paths['/api/v1/tools/jobs']
  assert.ok(jobsPath && isRecord(jobsPath), 'Expected /api/v1/tools/jobs path to exist')
  const jobsGet = jobsPath.get
  assert.ok(jobsGet && isRecord(jobsGet), 'Expected GET operation for tools jobs')
  assert.equal(jobsGet.summary, '分页查询任务调度目录')
  const jobsResponses = jobsGet.responses
  const jobsJson =
    jobsResponses &&
    isRecord(jobsResponses) &&
    isRecord(jobsResponses['200']) &&
    isRecord(jobsResponses['200'].content)
      ? jobsResponses['200'].content['application/json']
      : undefined
  assert.ok(jobsJson && isRecord(jobsJson), 'Expected tools jobs JSON response schema')
  const jobsOutputSchema = resolveOpenApiSchema(payload, jobsJson.schema)
  assert.equal(jobsOutputSchema.title, 'ToolJobsListResponse')

  const sessionPath = payload.paths['/api/v1/system/session']
  assert.ok(sessionPath && isRecord(sessionPath), 'Expected /api/v1/system/session path to exist')
  const sessionGet = sessionPath.get
  assert.ok(sessionGet && isRecord(sessionGet), 'Expected GET operation for system session')
  assert.equal(sessionGet.summary, '读取当前认证会话')
  const sessionResponses = sessionGet.responses
  const sessionJson =
    sessionResponses &&
    isRecord(sessionResponses) &&
    isRecord(sessionResponses['200']) &&
    isRecord(sessionResponses['200'].content)
      ? sessionResponses['200'].content['application/json']
      : undefined
  assert.ok(sessionJson && isRecord(sessionJson), 'Expected system session JSON response schema')
  const sessionOutputSchema = resolveOpenApiSchema(payload, sessionJson.schema)
  assert.equal(sessionOutputSchema.title, 'SessionResponse')

  const aiToolCatalogPath = payload.paths['/api/v1/system/ai/tools/catalog']
  assert.ok(
    aiToolCatalogPath && isRecord(aiToolCatalogPath),
    'Expected /api/v1/system/ai/tools/catalog path to exist',
  )
  const aiToolCatalogGet = aiToolCatalogPath.get
  assert.ok(
    aiToolCatalogGet && isRecord(aiToolCatalogGet),
    'Expected GET operation for ai tool catalog',
  )
  assert.equal(aiToolCatalogGet.summary, '读取 AI Tool 目录')
  const aiToolCatalogResponses = aiToolCatalogGet.responses
  const aiToolCatalogJson =
    aiToolCatalogResponses &&
    isRecord(aiToolCatalogResponses) &&
    isRecord(aiToolCatalogResponses['200']) &&
    isRecord(aiToolCatalogResponses['200'].content)
      ? aiToolCatalogResponses['200'].content['application/json']
      : undefined
  assert.ok(
    aiToolCatalogJson && isRecord(aiToolCatalogJson),
    'Expected ai tool catalog JSON response schema',
  )
  const aiToolCatalogOutputSchema = resolveOpenApiSchema(payload, aiToolCatalogJson.schema)
  assert.equal(aiToolCatalogOutputSchema.title, 'AiToolCatalogResponse')
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
  assert.deepEqual([...createPayload.json.permissionIds].sort(), [userReadPermissionId].sort())
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
  assert.deepEqual([...readPayload.json.permissionIds].sort(), [userReadPermissionId].sort())
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
  assert.deepEqual(
    [...updatePayload.json.permissionIds].sort(),
    [roleReadPermissionId, userReadPermissionId].sort(),
  )
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

test('super_admin can perform full contract-first CRUD on custom system menus', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const systemDirectoryId =
    defaultMenus.find((menuDefinition) => menuDefinition.path === '/system')?.id ?? null

  assert.ok(systemDirectoryId, 'Expected seeded /system directory to exist')

  const createResponse = await app.request('http://localhost/api/v1/system/menus', {
    body: JSON.stringify({
      component: 'system/menu-ops/page',
      icon: 'layout-grid',
      name: '菜单编排',
      parentId: systemDirectoryId,
      path: `/system/menu-ops-${randomUUID()}`,
      permissionAction: 'read',
      permissionResource: 'Menu',
      sortOrder: 77,
      status: true,
      type: 'menu',
      visible: true,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const createPayload = (await createResponse.json()) as {
    json: MenuEntry
  }

  assert.equal(createResponse.status, 200)
  assert.equal(createPayload.json.name, '菜单编排')
  assert.equal(createPayload.json.permissionAction, 'read')
  assert.equal(createPayload.json.permissionResource, 'Menu')

  const readResponse = await app.request(
    `http://localhost/api/v1/system/menus/${createPayload.json.id}`,
    {
      headers: authHeaders,
    },
  )
  const readPayload = (await readResponse.json()) as {
    json: MenuEntry
  }

  assert.equal(readResponse.status, 200)
  assert.equal(readPayload.json.id, createPayload.json.id)

  const updateResponse = await app.request(
    `http://localhost/api/v1/system/menus/${createPayload.json.id}`,
    {
      body: JSON.stringify({
        component: 'system/menu-ops/page',
        icon: 'layout-grid',
        id: createPayload.json.id,
        name: '菜单编排已更新',
        parentId: systemDirectoryId,
        path: `${createPayload.json.path}-updated`,
        permissionAction: 'manage',
        permissionResource: 'Menu',
        sortOrder: 78,
        status: false,
        type: 'menu',
        visible: false,
      }),
      headers: {
        ...Object.fromEntries(authHeaders.entries()),
        'content-type': 'application/json',
      },
      method: 'PUT',
    },
  )
  const updatePayload = (await updateResponse.json()) as {
    json: MenuEntry
  }

  assert.equal(updateResponse.status, 200)
  assert.equal(updatePayload.json.name, '菜单编排已更新')
  assert.equal(updatePayload.json.permissionAction, 'manage')
  assert.equal(updatePayload.json.visible, false)
  assert.equal(updatePayload.json.status, false)

  const deleteResponse = await app.request(
    `http://localhost/api/v1/system/menus/${createPayload.json.id}`,
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
    `http://localhost/api/v1/system/menus/${createPayload.json.id}`,
    {
      headers: authHeaders,
    },
  )

  assert.equal(deletedReadResponse.status, 404)

  const systemMenuLogs = await listOperationLogsByModule('system_menus')
  const targetLogs = systemMenuLogs.filter((log) => log.targetId === createPayload.json.id)

  assert.ok(targetLogs.some((log) => log.action === 'create_menu'))
  assert.ok(targetLogs.some((log) => log.action === 'update_menu'))
  assert.ok(targetLogs.some((log) => log.action === 'delete_menu'))
})

test('viewer cannot create menus through the contract-first write route', async () => {
  const authHeaders = await createSessionForRole('viewer')
  const response = await app.request('http://localhost/api/v1/system/menus', {
    body: JSON.stringify({
      component: 'system/restricted-menu/page',
      icon: 'shield',
      name: '受限菜单',
      parentId: null,
      path: `/system/restricted-menu-${randomUUID()}`,
      permissionAction: 'read',
      permissionResource: 'Menu',
      sortOrder: 12,
      status: true,
      type: 'menu',
      visible: true,
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
  assert.match(payload.message, /manage:Menu|manage:all/)
})

test('seeded menus remain read-only through the contract-first write route', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const seededMenuId =
    defaultMenus.find((menuDefinition) => menuDefinition.path === '/system/menus')?.id ?? null

  assert.ok(seededMenuId, 'Expected seeded /system/menus menu to exist')

  const response = await app.request(`http://localhost/api/v1/system/menus/${seededMenuId}`, {
    headers: authHeaders,
    method: 'DELETE',
  })
  const payload = (await response.json()) as {
    code: string
    message: string
  }

  assert.equal(response.status, 400)
  assert.equal(payload.code, 'BAD_REQUEST')
  assert.match(payload.message, /Seeded menus are read-only/)
})

test('menus with child nodes cannot be deleted until descendants are removed', async () => {
  const authHeaders = await createSessionForRole('super_admin')

  const createDirectoryResponse = await app.request('http://localhost/api/v1/system/menus', {
    body: JSON.stringify({
      component: null,
      icon: 'folder',
      name: '测试目录',
      parentId: null,
      path: null,
      permissionAction: null,
      permissionResource: null,
      sortOrder: 88,
      status: true,
      type: 'directory',
      visible: true,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const createDirectoryPayload = (await createDirectoryResponse.json()) as {
    json: MenuEntry
  }

  assert.equal(createDirectoryResponse.status, 200)

  const createChildResponse = await app.request('http://localhost/api/v1/system/menus', {
    body: JSON.stringify({
      component: 'system/testing-child/page',
      icon: 'dot',
      name: '测试子菜单',
      parentId: createDirectoryPayload.json.id,
      path: `/system/testing-child-${randomUUID()}`,
      permissionAction: 'read',
      permissionResource: 'Menu',
      sortOrder: 1,
      status: true,
      type: 'menu',
      visible: true,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const createChildPayload = (await createChildResponse.json()) as {
    json: MenuEntry
  }

  assert.equal(createChildResponse.status, 200)

  const rejectedDeleteResponse = await app.request(
    `http://localhost/api/v1/system/menus/${createDirectoryPayload.json.id}`,
    {
      headers: authHeaders,
      method: 'DELETE',
    },
  )
  const rejectedDeletePayload = (await rejectedDeleteResponse.json()) as {
    code: string
    message: string
  }

  assert.equal(rejectedDeleteResponse.status, 400)
  assert.equal(rejectedDeletePayload.code, 'BAD_REQUEST')
  assert.match(
    rejectedDeletePayload.message,
    /Child menus must be removed before deleting this menu/,
  )

  await db.delete(menus).where(eq(menus.id, createChildPayload.json.id))
  await db.delete(menus).where(eq(menus.id, createDirectoryPayload.json.id))
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

test('super_admin can perform full contract-first CRUD on custom system config entries', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const configSuffix = randomUUID().slice(0, 8)
  const createResponse = await app.request('http://localhost/api/v1/system/config', {
    body: JSON.stringify({
      description: 'Contract CRUD Config',
      key: `custom.dashboard_notice.${configSuffix}`,
      scope: 'application',
      status: true,
      value: '公告：本周五 22:00 进入升级窗口。',
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
      key: string
      mutable: boolean
      source: string
      status: boolean
    }
  }

  assert.equal(createResponse.status, 200)
  assert.equal(createPayload.json.source, 'custom')
  assert.equal(createPayload.json.mutable, true)
  assert.equal(createPayload.json.status, true)

  const readResponse = await app.request(
    `http://localhost/api/v1/system/config/${createPayload.json.id}`,
    {
      headers: authHeaders,
    },
  )
  const readPayload = (await readResponse.json()) as {
    json: {
      id: string
      key: string
      value: string
    }
  }

  assert.equal(readResponse.status, 200)
  assert.equal(readPayload.json.id, createPayload.json.id)
  assert.equal(readPayload.json.key, `custom.dashboard_notice.${configSuffix}`)

  const updateResponse = await app.request(
    `http://localhost/api/v1/system/config/${createPayload.json.id}`,
    {
      body: JSON.stringify({
        description: 'Contract CRUD Config Updated',
        key: `custom.dashboard_notice.updated.${configSuffix}`,
        scope: 'application',
        status: false,
        value: '公告：升级窗口已经调整到周六 01:00。',
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
      id: string
      key: string
      status: boolean
      value: string
    }
  }

  assert.equal(updateResponse.status, 200)
  assert.equal(updatePayload.json.id, createPayload.json.id)
  assert.equal(updatePayload.json.key, `custom.dashboard_notice.updated.${configSuffix}`)
  assert.equal(updatePayload.json.status, false)
  assert.equal(updatePayload.json.value, '公告：升级窗口已经调整到周六 01:00。')

  const deleteResponse = await app.request(
    `http://localhost/api/v1/system/config/${createPayload.json.id}`,
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
    `http://localhost/api/v1/system/config/${createPayload.json.id}`,
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
  assert.match(deletedReadPayload.message, /Config/)

  const configLogs = await listOperationLogsByModule('system_configs')
  const targetLogs = configLogs.filter((log) => log.targetId === createPayload.json.id)

  assert.ok(targetLogs.some((log) => log.action === 'create'))
  assert.ok(targetLogs.some((log) => log.action === 'update'))
  assert.ok(targetLogs.some((log) => log.action === 'delete'))
})

test('runtime config entries remain read-only through the contract-first write route', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const response = await app.request(
    'http://localhost/api/v1/system/config/config:security-rate-limit',
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
  assert.match(payload.message, /read-only|cannot be deleted/)
})

test('super_admin can perform full contract-first CRUD on custom system dictionaries', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const dictSuffix = randomUUID().slice(0, 8)
  const createResponse = await app.request('http://localhost/api/v1/system/dicts', {
    body: JSON.stringify({
      code: `custom_operator_states_${dictSuffix}`,
      description: 'Contract CRUD Dict',
      entries: [
        { label: '处理中', sortOrder: 10, value: 'processing' },
        { label: '已关闭', sortOrder: 20, value: 'closed' },
      ],
      name: '运营状态',
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
      entryCount: number
      id: string
      mutable: boolean
      source: string
    }
  }

  assert.equal(createResponse.status, 200)
  assert.equal(createPayload.json.code, `custom_operator_states_${dictSuffix}`)
  assert.equal(createPayload.json.entryCount, 2)
  assert.equal(createPayload.json.mutable, true)
  assert.equal(createPayload.json.source, 'custom')

  const readResponse = await app.request(
    `http://localhost/api/v1/system/dicts/${createPayload.json.id}`,
    {
      headers: authHeaders,
    },
  )
  const readPayload = (await readResponse.json()) as {
    json: {
      entries: Array<{ value: string }>
      id: string
    }
  }

  assert.equal(readResponse.status, 200)
  assert.equal(readPayload.json.id, createPayload.json.id)
  assert.deepEqual(
    readPayload.json.entries.map((entry) => entry.value),
    ['processing', 'closed'],
  )

  const updateResponse = await app.request(
    `http://localhost/api/v1/system/dicts/${createPayload.json.id}`,
    {
      body: JSON.stringify({
        code: `custom_operator_states_updated_${dictSuffix}`,
        description: 'Contract CRUD Dict Updated',
        entries: [
          { label: '处理中', sortOrder: 10, value: 'processing' },
          { label: '待复核', sortOrder: 15, value: 'review' },
          { label: '已关闭', sortOrder: 20, value: 'closed' },
        ],
        name: '运营状态升级版',
        status: false,
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
      entryCount: number
      id: string
      name: string
      status: boolean
    }
  }

  assert.equal(updateResponse.status, 200)
  assert.equal(updatePayload.json.id, createPayload.json.id)
  assert.equal(updatePayload.json.code, `custom_operator_states_updated_${dictSuffix}`)
  assert.equal(updatePayload.json.name, '运营状态升级版')
  assert.equal(updatePayload.json.entryCount, 3)
  assert.equal(updatePayload.json.status, false)

  const deleteResponse = await app.request(
    `http://localhost/api/v1/system/dicts/${createPayload.json.id}`,
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
    `http://localhost/api/v1/system/dicts/${createPayload.json.id}`,
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
  assert.match(deletedReadPayload.message, /Dictionary/)

  const dictLogs = await listOperationLogsByModule('system_dicts')
  const targetLogs = dictLogs.filter((log) => log.targetId === createPayload.json.id)

  assert.ok(targetLogs.some((log) => log.action === 'create'))
  assert.ok(targetLogs.some((log) => log.action === 'update'))
  assert.ok(targetLogs.some((log) => log.action === 'delete'))
})

test('built-in dictionaries remain read-only through the contract-first write route', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const response = await app.request('http://localhost/api/v1/system/dicts/dict:ability-actions', {
    headers: authHeaders,
    method: 'DELETE',
  })
  const payload = (await response.json()) as {
    code: string
    message: string
  }

  assert.equal(response.status, 400)
  assert.equal(payload.code, 'BAD_REQUEST')
  assert.match(payload.message, /read-only|cannot be deleted/)
})

test('super_admin can consume the contract-first config, dict, and tools routes', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const [configResponse, dictsResponse, genResponse, jobsResponse] = await Promise.all([
    app.request('http://localhost/api/v1/system/config?page=1&pageSize=10', {
      headers: authHeaders,
    }),
    app.request('http://localhost/api/v1/system/dicts?page=1&pageSize=10', {
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
  const dictPayload = (await dictsResponse.json()) as {
    json: {
      data: Array<{ code: string; entryCount: number }>
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
  assert.equal(dictsResponse.status, 200)
  assert.equal(genResponse.status, 200)
  assert.equal(jobsResponse.status, 200)
  assert.ok(configPayload.json.pagination.total >= 1)
  assert.ok(dictPayload.json.pagination.total >= 1)
  assert.ok(
    configPayload.json.data.some(
      (item) =>
        item.key === 'security.rate_limit' && item.scope === 'security' && item.value.length > 0,
    ),
  )
  assert.ok(
    dictPayload.json.data.some((item) => item.code === 'role_codes' && item.entryCount >= 1),
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

test('AI detail contract routes expose audit and feedback linkage for administrators', async () => {
  const authHeaders = await createSessionForRole('admin')
  const requestId = `contract-ai-detail-${randomUUID()}`
  const auditLog = await writeAiAuditLog({
    action: 'read',
    actorAuthUserId: 'system:contract-ai-detail',
    actorRbacUserId: null,
    input: {
      query: 'finance approver',
    },
    output: {
      rows: 1,
    },
    requestInfo: {
      requestId,
      route: '/api/v1/ai/knowledge',
    },
    roleCodes: ['admin'],
    status: 'success',
    subject: 'AiKnowledge',
    toolId: 'knowledge_semantic_search',
  })

  const createFeedbackHeaders = new Headers(authHeaders)
  createFeedbackHeaders.set('content-type', 'application/json')

  const createFeedbackResponse = await app.request('http://localhost/api/v1/ai/feedback', {
    body: JSON.stringify({
      accepted: false,
      auditLogId: auditLog.id,
      correction: '请限定为财务审批制度相关知识片段。',
      feedbackText: '原始检索范围过宽。',
      userAction: 'overridden',
    }),
    headers: createFeedbackHeaders,
    method: 'POST',
  })

  const createdFeedbackPayload = (await createFeedbackResponse.json()) as {
    json: {
      auditLogId: string
      id: string
      userAction: string
    }
  }

  const [auditDetailResponse, feedbackDetailResponse] = await Promise.all([
    app.request(`http://localhost/api/v1/ai/audit/${auditLog.id}`, {
      headers: authHeaders,
    }),
    app.request(`http://localhost/api/v1/ai/feedback/${createdFeedbackPayload.json.id}`, {
      headers: authHeaders,
    }),
  ])

  const auditDetailPayload = (await auditDetailResponse.json()) as {
    json: {
      feedback: Array<{
        auditLogId: string
        id: string
        userAction: string
      }>
      feedbackCount: number
      id: string
      requestInfo: {
        requestId: string
        route: string
      } | null
      toolId: string
    }
  }
  const feedbackDetailPayload = (await feedbackDetailResponse.json()) as {
    json: {
      accepted: boolean
      auditLog: {
        id: string
        requestId: string | null
        toolId: string
      }
      auditLogId: string
      id: string
      userAction: string
    }
  }

  assert.equal(createFeedbackResponse.status, 200)
  assert.equal(createdFeedbackPayload.json.auditLogId, auditLog.id)
  assert.equal(createdFeedbackPayload.json.userAction, 'overridden')
  assert.equal(auditDetailResponse.status, 200)
  assert.equal(feedbackDetailResponse.status, 200)
  assert.equal(auditDetailPayload.json.id, auditLog.id)
  assert.equal(auditDetailPayload.json.toolId, 'knowledge_semantic_search')
  assert.equal(auditDetailPayload.json.feedbackCount, 1)
  assert.equal(auditDetailPayload.json.requestInfo?.requestId, requestId)
  assert.equal(auditDetailPayload.json.requestInfo?.route, '/api/v1/ai/knowledge')
  assert.equal(auditDetailPayload.json.feedback[0]?.id, createdFeedbackPayload.json.id)
  assert.equal(auditDetailPayload.json.feedback[0]?.auditLogId, auditLog.id)
  assert.equal(auditDetailPayload.json.feedback[0]?.userAction, 'overridden')
  assert.equal(feedbackDetailPayload.json.id, createdFeedbackPayload.json.id)
  assert.equal(feedbackDetailPayload.json.auditLogId, auditLog.id)
  assert.equal(feedbackDetailPayload.json.accepted, false)
  assert.equal(feedbackDetailPayload.json.userAction, 'overridden')
  assert.equal(feedbackDetailPayload.json.auditLog.id, auditLog.id)
  assert.equal(feedbackDetailPayload.json.auditLog.toolId, 'knowledge_semantic_search')
  assert.equal(feedbackDetailPayload.json.auditLog.requestId, requestId)
})

test('AI eval detail and run contract routes expose recent runs for administrators', async () => {
  const authHeaders = await createSessionForRole('admin')
  const evalOperationLogsBefore = await listOperationLogsByModule('ai_evals')
  const runResponse = await app.request('http://localhost/api/v1/ai/evals/report-schedule/run', {
    headers: authHeaders,
    method: 'POST',
  })
  const runPayload = (await runResponse.json()) as {
    json: {
      evalId: string
      experimentId: string
      status: string
    }
  }
  const detailResponse = await app.request('http://localhost/api/v1/ai/evals/report-schedule', {
    headers: authHeaders,
  })
  const detailPayload = (await detailResponse.json()) as {
    json: {
      environment: {
        configured: boolean
      }
      id: string
      recentRuns: Array<{
        id: string
        experimentId: string
        evalKey: string
        triggerSource: string
      }>
      status: string
    }
  }

  assert.equal(runResponse.status, 200)
  assert.equal(runPayload.json.evalId, 'report-schedule')
  assert.equal(runPayload.json.status, 'completed')
  assert.equal(detailResponse.status, 200)
  assert.equal(detailPayload.json.id, 'report-schedule')
  assert.equal(detailPayload.json.status, 'registered')
  assert.equal(detailPayload.json.environment.configured, true)
  assert.ok(
    detailPayload.json.recentRuns.some(
      (run) =>
        run.experimentId === runPayload.json.experimentId &&
        run.evalKey === 'report-schedule' &&
        run.triggerSource === 'manual',
    ),
  )
  const matchingRun = detailPayload.json.recentRuns.find(
    (run) => run.experimentId === runPayload.json.experimentId,
  )
  assert.ok(matchingRun, 'Expected matching eval run in recent runs')

  const runDetailResponse = await app.request(
    `http://localhost/api/v1/ai/evals/report-schedule/runs/${matchingRun.id}`,
    {
      headers: authHeaders,
    },
  )
  const runDetailPayload = (await runDetailResponse.json()) as {
    json: {
      environment: {
        configured: boolean
      }
      evalKey: string
      id: string
      items: Array<{
        datasetItemId: string
        itemIndex: number
        scores: Record<string, unknown>
      }>
      triggerSource: string
    }
  }

  const evalOperationLogsAfter = await listOperationLogsByModule('ai_evals')

  assert.equal(runDetailResponse.status, 200)
  assert.equal(runDetailPayload.json.id, matchingRun.id)
  assert.equal(runDetailPayload.json.evalKey, 'report-schedule')
  assert.equal(runDetailPayload.json.triggerSource, 'manual')
  assert.equal(runDetailPayload.json.environment.configured, true)
  assert.ok(runDetailPayload.json.items.length > 0)
  assert.equal(runDetailPayload.json.items[0]?.itemIndex, 0)
  assert.ok(typeof runDetailPayload.json.items[0]?.datasetItemId === 'string')
  assert.ok(Object.keys(runDetailPayload.json.items[0]?.scores ?? {}).length > 0)
  assert.ok(evalOperationLogsAfter.length > evalOperationLogsBefore.length)
  assert.ok(
    evalOperationLogsAfter.some(
      (log) =>
        log.action === 'run_ai_eval' &&
        log.targetId === runPayload.json.experimentId &&
        log.requestInfo?.evalId === 'report-schedule',
    ),
  )
})

test('admin can perform full contract-first CRUD on ai knowledge documents', async () => {
  const authHeaders = await createSessionForRole('admin')
  const knowledgeSuffix = randomUUID().slice(0, 8)
  const createResponse = await app.request('http://localhost/api/v1/ai/knowledge', {
    body: JSON.stringify({
      chunkOverlap: 32,
      chunkSize: 256,
      content:
        '第一条：财务审批需由部门负责人初审。第二条：金额超过十万元时进入复核流程。第三条：报销单需附原始票据。',
      metadata: {
        category: 'finance',
        version: 'draft',
      },
      sourceType: 'manual',
      sourceUri: null,
      title: `知识合同文档 ${knowledgeSuffix}`,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const createPayload = (await createResponse.json()) as {
    json: {
      chunkCount: number
      chunks: Array<{ chunkIndex: number }>
      documentId: string
      metadata: { category: string; version: string }
      title: string
    }
  }

  assert.equal(createResponse.status, 200)
  assert.equal(createPayload.json.title, `知识合同文档 ${knowledgeSuffix}`)
  assert.equal(createPayload.json.metadata.category, 'finance')
  assert.ok(createPayload.json.chunkCount >= 1)
  assert.ok(createPayload.json.chunks.length >= 1)

  const getResponse = await app.request(
    `http://localhost/api/v1/ai/knowledge/${createPayload.json.documentId}`,
    {
      headers: authHeaders,
    },
  )
  const getPayload = (await getResponse.json()) as {
    json: {
      chunkCount: number
      chunks: Array<{ contentPreview: string }>
      documentId: string
      title: string
    }
  }

  assert.equal(getResponse.status, 200)
  assert.equal(getPayload.json.documentId, createPayload.json.documentId)
  assert.equal(getPayload.json.title, `知识合同文档 ${knowledgeSuffix}`)
  assert.ok(getPayload.json.chunkCount >= 1)
  assert.ok(getPayload.json.chunks[0]?.contentPreview.includes('财务审批'))

  const updateResponse = await app.request(
    `http://localhost/api/v1/ai/knowledge/${createPayload.json.documentId}`,
    {
      body: JSON.stringify({
        chunkOverlap: 48,
        chunkSize: 384,
        content:
          '第一条：财务审批需由部门负责人初审。第二条：金额超过十五万元时进入复核流程。第三条：报销单需附原始票据和审批邮件。',
        metadata: {
          category: 'finance',
          version: 'v2',
        },
        sourceType: 'manual',
        sourceUri: 'https://internal.example.com/wiki/finance-v2',
        title: `知识合同文档 ${knowledgeSuffix}（修订）`,
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
      chunkCount: number
      documentId: string
      metadata: { category: string; version: string }
      sourceUri: string | null
      title: string
    }
  }

  assert.equal(updateResponse.status, 200)
  assert.equal(updatePayload.json.documentId, createPayload.json.documentId)
  assert.equal(updatePayload.json.title, `知识合同文档 ${knowledgeSuffix}（修订）`)
  assert.equal(updatePayload.json.metadata.version, 'v2')
  assert.equal(updatePayload.json.sourceUri, 'https://internal.example.com/wiki/finance-v2')
  assert.ok(updatePayload.json.chunkCount >= 1)

  const deleteResponse = await app.request(
    `http://localhost/api/v1/ai/knowledge/${createPayload.json.documentId}`,
    {
      headers: authHeaders,
      method: 'DELETE',
    },
  )
  const deletePayload = (await deleteResponse.json()) as {
    json: {
      deleted: boolean
      id: string
      removedChunkCount: number
    }
  }

  assert.equal(deleteResponse.status, 200)
  assert.equal(deletePayload.json.deleted, true)
  assert.equal(deletePayload.json.id, createPayload.json.documentId)
  assert.ok(deletePayload.json.removedChunkCount >= 1)

  const deletedReadResponse = await app.request(
    `http://localhost/api/v1/ai/knowledge/${createPayload.json.documentId}`,
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
  assert.match(deletedReadPayload.message, /Knowledge document not found/)

  const knowledgeOperationLogs = await listOperationLogsByModule('ai_knowledge')
  const targetKnowledgeLogs = knowledgeOperationLogs.filter(
    (log) => log.targetId === createPayload.json.documentId,
  )

  assert.ok(targetKnowledgeLogs.some((log) => log.action === 'update_document_index'))
  assert.ok(targetKnowledgeLogs.some((log) => log.action === 'delete_document_index'))

  const indexingAuditLogs = await listAiAuditLogsByToolId('task:rag-indexing')
  const deleteAuditLogs = await listAiAuditLogsByToolId('contract:ai-knowledge')

  assert.ok(
    indexingAuditLogs.some(
      (log) =>
        isRecord(log.output) &&
        log.output.documentId === createPayload.json.documentId &&
        log.status === 'success',
    ),
  )
  assert.ok(
    deleteAuditLogs.some(
      (log) =>
        isRecord(log.output) &&
        log.output.documentId === createPayload.json.documentId &&
        log.status === 'success',
    ),
  )
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

  const detailResponse = await app.request(
    `http://localhost/api/v1/ai/prompts/${createPayload.json.id}`,
    {
      headers: authHeaders,
    },
  )
  const detailPayload = (await detailResponse.json()) as {
    json: {
      evalEvidence: {
        evalRunId: string
      } | null
      id: string
      isActive: boolean
      promptKey: string
      status: string
    }
  }

  assert.equal(detailResponse.status, 200)
  assert.equal(detailPayload.json.id, createPayload.json.id)
  assert.equal(detailPayload.json.promptKey, promptKey)
  assert.equal(detailPayload.json.status, 'active')
  assert.equal(detailPayload.json.isActive, true)
  assert.equal(detailPayload.json.evalEvidence?.evalRunId, latestEvalRun.id)
})

test('prompt governance compare route exposes text and release-policy diffs', async () => {
  const authHeaders = await createSessionForRole('admin')
  const promptKey = `admin.compare.${randomUUID().slice(0, 8)}`

  const baselineResponse = await app.request('http://localhost/api/v1/ai/prompts', {
    body: JSON.stringify({
      notes: '第一版提示词，强调结构化回答。',
      promptKey,
      promptText: ['你是后台管理 Copilot，请优先返回结构化结论。', '先给摘要，再给行动建议。'].join(
        '\n',
      ),
      releasePolicy: {
        minAverageScore: 0.8,
        scorerThresholds: {},
      },
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const baselinePayload = (await baselineResponse.json()) as {
    json: {
      id: string
      version: number
    }
  }

  const targetResponse = await app.request('http://localhost/api/v1/ai/prompts', {
    body: JSON.stringify({
      notes: '第二版提示词，新增风险摘要和更严格门禁。',
      promptKey,
      promptText: [
        '你是后台管理 Copilot，请优先返回结构化结论。',
        '先给摘要，再给行动建议。',
        '输出前必须补充风险摘要。',
      ].join('\n'),
      releasePolicy: {
        minAverageScore: 0.92,
        scorerThresholds: {
          factuality: 0.95,
        },
      },
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const targetPayload = (await targetResponse.json()) as {
    json: {
      id: string
      version: number
    }
  }

  const compareResponse = await app.request(
    `http://localhost/api/v1/ai/prompts/${targetPayload.json.id}/compare/${baselinePayload.json.id}`,
    {
      headers: authHeaders,
    },
  )
  const comparePayload = (await compareResponse.json()) as {
    json: {
      baseline: {
        id: string
        version: number
      }
      diff: {
        notes: {
          changed: boolean
        }
        promptText: {
          addedLines: string[]
          changed: boolean
          unchangedLineCount: number
        }
        releasePolicy: {
          changed: boolean
          current: {
            minAverageScore: number
            scorerThresholds: Record<string, number>
          }
        }
        status: {
          changed: boolean
          currentStatus: string
          previousStatus: string
        }
      }
      summary: {
        changedFields: string[]
        promptKey: string
        totalChangedFields: number
        versionDelta: number
      }
      target: {
        id: string
        version: number
      }
    }
  }

  assert.equal(baselineResponse.status, 200)
  assert.equal(targetResponse.status, 200)
  assert.equal(compareResponse.status, 200)
  assert.equal(comparePayload.json.baseline.id, baselinePayload.json.id)
  assert.equal(comparePayload.json.target.id, targetPayload.json.id)
  assert.equal(comparePayload.json.baseline.version, baselinePayload.json.version)
  assert.equal(comparePayload.json.target.version, targetPayload.json.version)
  assert.equal(comparePayload.json.summary.promptKey, promptKey)
  assert.equal(comparePayload.json.summary.versionDelta, 1)
  assert.ok(comparePayload.json.summary.totalChangedFields >= 3)
  assert.ok(comparePayload.json.summary.changedFields.includes('promptText'))
  assert.ok(comparePayload.json.summary.changedFields.includes('notes'))
  assert.ok(comparePayload.json.summary.changedFields.includes('releasePolicy'))
  assert.equal(comparePayload.json.diff.promptText.changed, true)
  assert.ok(comparePayload.json.diff.promptText.unchangedLineCount >= 2)
  assert.ok(comparePayload.json.diff.promptText.addedLines.includes('输出前必须补充风险摘要。'))
  assert.equal(comparePayload.json.diff.notes.changed, true)
  assert.equal(comparePayload.json.diff.releasePolicy.changed, true)
  assert.equal(comparePayload.json.diff.releasePolicy.current.minAverageScore, 0.92)
  assert.equal(comparePayload.json.diff.releasePolicy.current.scorerThresholds.factuality, 0.95)
  assert.equal(comparePayload.json.diff.status.changed, false)
  assert.equal(comparePayload.json.diff.status.previousStatus, 'draft')
  assert.equal(comparePayload.json.diff.status.currentStatus, 'draft')
})

test('prompt governance history route exposes ordered release timeline and active version summary', async () => {
  const authHeaders = await createSessionForRole('admin')
  const promptKey = `admin.history.${randomUUID().slice(0, 8)}`

  const baselineResponse = await app.request('http://localhost/api/v1/ai/prompts', {
    body: JSON.stringify({
      notes: '历史基线版本。',
      promptKey,
      promptText: '你是后台管理 Copilot，请输出结构化结论。',
      releasePolicy: {
        minAverageScore: 0.8,
        scorerThresholds: {},
      },
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const baselinePayload = (await baselineResponse.json()) as {
    json: {
      id: string
      version: number
    }
  }

  const targetResponse = await app.request('http://localhost/api/v1/ai/prompts', {
    body: JSON.stringify({
      notes: '历史目标版本。',
      promptKey,
      promptText: '你是后台管理 Copilot，请输出结构化结论，并补充风险摘要。',
      releasePolicy: {
        minAverageScore: 0.8,
        scorerThresholds: {},
      },
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const targetPayload = (await targetResponse.json()) as {
    json: {
      id: string
      version: number
    }
  }

  await runMastraEvalSuite({
    actorAuthUserId: 'system:prompt-history-test',
    actorRbacUserId: null,
    evalId: 'report-schedule',
    requestId: `prompt-history-${randomUUID()}`,
    triggerSource: 'test',
  })
  const latestEvalRuns = await listAiEvalRunsByEvalKey('report-schedule')
  const latestEvalRun = latestEvalRuns[0]

  assert.ok(latestEvalRun, 'Expected a persisted eval run for prompt history route')

  const attachResponse = await app.request('http://localhost/api/v1/ai/prompts/attach-evidence', {
    body: JSON.stringify({
      evalRunId: latestEvalRun.id,
      promptVersionId: targetPayload.json.id,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  const activateResponse = await app.request('http://localhost/api/v1/ai/prompts/activate', {
    body: JSON.stringify({
      promptVersionId: targetPayload.json.id,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  const historyResponse = await app.request(
    `http://localhost/api/v1/ai/prompts/history/${promptKey}`,
    {
      headers: authHeaders,
    },
  )
  const historyPayload = (await historyResponse.json()) as {
    json: {
      promptKey: string
      summary: {
        activeVersionId: string | null
        latestVersionId: string | null
        latestVersionNumber: number | null
        releaseReadyCount: number
        totalVersions: number
      }
      versions: Array<{
        id: string
        isActive: boolean
        releaseReady: boolean
        status: string
        version: number
      }>
    }
  }

  assert.equal(baselineResponse.status, 200)
  assert.equal(targetResponse.status, 200)
  assert.equal(attachResponse.status, 200)
  assert.equal(activateResponse.status, 200)
  assert.equal(historyResponse.status, 200)
  assert.equal(historyPayload.json.promptKey, promptKey)
  assert.equal(historyPayload.json.summary.totalVersions, 2)
  assert.equal(historyPayload.json.summary.activeVersionId, targetPayload.json.id)
  assert.equal(historyPayload.json.summary.latestVersionId, targetPayload.json.id)
  assert.equal(historyPayload.json.summary.latestVersionNumber, targetPayload.json.version)
  assert.ok(historyPayload.json.summary.releaseReadyCount >= 1)
  assert.equal(historyPayload.json.versions.length, 2)
  assert.equal(historyPayload.json.versions[0]?.id, targetPayload.json.id)
  assert.equal(historyPayload.json.versions[0]?.version, targetPayload.json.version)
  assert.equal(historyPayload.json.versions[0]?.isActive, true)
  assert.equal(historyPayload.json.versions[0]?.status, 'active')
  assert.equal(historyPayload.json.versions[0]?.releaseReady, true)
  assert.equal(historyPayload.json.versions[1]?.id, baselinePayload.json.id)
  assert.equal(historyPayload.json.versions[1]?.version, baselinePayload.json.version)
})

test('prompt governance release-audit route exposes approval audit trail for a prompt version', async () => {
  const authHeaders = await createSessionForRole('admin')
  const promptKey = `admin.release-audit.${randomUUID().slice(0, 8)}`

  const createResponse = await app.request('http://localhost/api/v1/ai/prompts', {
    body: JSON.stringify({
      notes: '发布审批审计目标版本。',
      promptKey,
      promptText: '你是后台管理 Copilot，请输出结构化结论，并附带审批摘要。',
      releasePolicy: {
        minAverageScore: 0.8,
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
    }
  }

  await runMastraEvalSuite({
    actorAuthUserId: 'system:prompt-release-audit-test',
    actorRbacUserId: null,
    evalId: 'report-schedule',
    requestId: `prompt-release-audit-${randomUUID()}`,
    triggerSource: 'test',
  })
  const latestEvalRuns = await listAiEvalRunsByEvalKey('report-schedule')
  const latestEvalRun = latestEvalRuns[0]

  assert.ok(latestEvalRun, 'Expected a persisted eval run for prompt release audit route')

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

  const releaseAuditResponse = await app.request(
    `http://localhost/api/v1/ai/prompts/${createPayload.json.id}/release-audit`,
    {
      headers: authHeaders,
    },
  )
  const releaseAuditPayload = (await releaseAuditResponse.json()) as {
    json: {
      auditTrail: Array<{
        action: string
        requestInfo: Record<string, string> | null
        targetId: string | null
      }>
      promptVersion: {
        id: string
        isActive: boolean
        releaseReady: boolean
        status: string
      }
      summary: {
        approvalEventCount: number
        hasActivation: boolean
        hasEvalEvidenceAttachment: boolean
        hasRollbackTargeted: boolean
        latestAction: string | null
        latestRequestId: string | null
      }
    }
  }

  assert.equal(createResponse.status, 200)
  assert.equal(attachResponse.status, 200)
  assert.equal(activateResponse.status, 200)
  assert.equal(releaseAuditResponse.status, 200)
  assert.equal(releaseAuditPayload.json.promptVersion.id, createPayload.json.id)
  assert.equal(releaseAuditPayload.json.promptVersion.isActive, true)
  assert.equal(releaseAuditPayload.json.promptVersion.status, 'active')
  assert.equal(releaseAuditPayload.json.promptVersion.releaseReady, true)
  assert.ok(releaseAuditPayload.json.summary.approvalEventCount >= 3)
  assert.equal(releaseAuditPayload.json.summary.hasActivation, true)
  assert.equal(releaseAuditPayload.json.summary.hasEvalEvidenceAttachment, true)
  assert.equal(releaseAuditPayload.json.summary.hasRollbackTargeted, false)
  assert.ok(releaseAuditPayload.json.summary.latestAction)
  assert.ok(releaseAuditPayload.json.auditTrail.length >= 3)
  assert.ok(
    releaseAuditPayload.json.auditTrail.some((entry) => entry.action === 'create_prompt_version'),
  )
  assert.ok(
    releaseAuditPayload.json.auditTrail.some(
      (entry) => entry.action === 'attach_prompt_eval_evidence',
    ),
  )
  assert.ok(
    releaseAuditPayload.json.auditTrail.some((entry) => entry.action === 'activate_prompt_version'),
  )
  assert.ok(
    releaseAuditPayload.json.auditTrail.every((entry) => entry.targetId === createPayload.json.id),
  )
  assert.ok(
    releaseAuditPayload.json.auditTrail.some(
      (entry) => entry.requestInfo?.promptVersionId === createPayload.json.id,
    ),
  )
  assert.ok(
    releaseAuditPayload.json.auditTrail.some(
      (entry) => entry.requestInfo?.evalRunId === latestEvalRun.id,
    ),
  )
})

test('prompt governance failure-audit route exposes rejection and exception audit trail for a prompt key', async () => {
  const authHeaders = await createSessionForRole('admin')
  const promptKey = `admin.failure-audit.${randomUUID().slice(0, 8)}`

  const createResponse = await app.request('http://localhost/api/v1/ai/prompts', {
    body: JSON.stringify({
      notes: '失败审计目标版本。',
      promptKey,
      promptText: '你是后台管理 Copilot，请返回结构化结论。',
      releasePolicy: {
        minAverageScore: 0.95,
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
    }
  }

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
    code: string
    message: string
  }

  await writeOperationLog({
    action: 'activate_prompt_version_exception',
    detail: `Prompt governance action activate_prompt_version threw an unexpected exception for ${promptKey}.`,
    errorMessage: 'Synthetic governance exception for audit coverage',
    fallbackActorKind: 'system',
    module: 'ai_prompts',
    requestInfo: {
      failureCode: 'SyntheticPromptGovernanceException',
      failureKind: 'exception',
      originalAction: 'activate_prompt_version',
      promptKey,
      promptVersionId: createPayload.json.id,
      requestId: `prompt-failure-audit-exception-${randomUUID()}`,
    },
    status: 'error',
    targetId: createPayload.json.id,
  })

  const failureAuditResponse = await app.request(
    `http://localhost/api/v1/ai/prompts/failure-audit/${promptKey}`,
    {
      headers: authHeaders,
    },
  )
  const failureAuditPayload = (await failureAuditResponse.json()) as {
    json: {
      auditTrail: Array<{
        action: string
        errorMessage: string | null
        failureKind: 'exception' | 'rejection'
        originalAction: string
        requestInfo: Record<string, string> | null
      }>
      promptKey: string
      summary: {
        exceptionEventCount: number
        hasReleaseGateRejection: boolean
        hasUnexpectedException: boolean
        latestFailureAction: string | null
        latestFailureKind: 'exception' | 'rejection' | null
        latestFailureRequestId: string | null
        rejectionEventCount: number
        totalFailureEventCount: number
      }
    }
  }

  assert.equal(createResponse.status, 200)
  assert.equal(activateResponse.status, 400)
  assert.equal(activatePayload.code, 'BAD_REQUEST')
  assert.match(activatePayload.message, /missing eval evidence/i)
  assert.equal(failureAuditResponse.status, 200)
  assert.equal(failureAuditPayload.json.promptKey, promptKey)
  assert.ok(failureAuditPayload.json.summary.totalFailureEventCount >= 2)
  assert.ok(failureAuditPayload.json.summary.rejectionEventCount >= 1)
  assert.ok(failureAuditPayload.json.summary.exceptionEventCount >= 1)
  assert.equal(failureAuditPayload.json.summary.hasReleaseGateRejection, true)
  assert.equal(failureAuditPayload.json.summary.hasUnexpectedException, true)
  assert.ok(failureAuditPayload.json.summary.latestFailureAction)
  assert.ok(failureAuditPayload.json.auditTrail.length >= 2)
  assert.ok(
    failureAuditPayload.json.auditTrail.some(
      (entry) =>
        entry.action === 'activate_prompt_version_rejected' &&
        entry.failureKind === 'rejection' &&
        entry.requestInfo?.failureCode === 'PromptReleaseGateError',
    ),
  )
  assert.ok(
    failureAuditPayload.json.auditTrail.some(
      (entry) =>
        entry.action === 'activate_prompt_version_exception' &&
        entry.failureKind === 'exception' &&
        entry.requestInfo?.failureCode === 'SyntheticPromptGovernanceException',
    ),
  )
  assert.ok(
    failureAuditPayload.json.auditTrail.every(
      (entry) => entry.originalAction === 'activate_prompt_version',
    ),
  )
})

test('ai governance routes expose prompt review queue and linked governance detail', async () => {
  const authHeaders = await createSessionForRole('admin')
  const promptKey = `admin.governance.${randomUUID().slice(0, 8)}`

  const createFirstResponse = await app.request('http://localhost/api/v1/ai/prompts', {
    body: JSON.stringify({
      notes: '治理工作台基线版本。',
      promptKey,
      promptText: '你是后台管理 Copilot，请优先输出结构化结论。',
      releasePolicy: {
        minAverageScore: 0.8,
        scorerThresholds: {},
      },
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const firstPayload = (await createFirstResponse.json()) as {
    json: {
      id: string
    }
  }

  await runMastraEvalSuite({
    actorAuthUserId: 'auth_user_governance_contract',
    actorRbacUserId: null,
    evalId: 'report-schedule',
    requestId: `prompt-governance-${randomUUID()}`,
    triggerSource: 'test',
  })

  const latestEvalRuns = await listAiEvalRunsByEvalKey('report-schedule')
  const latestEvalRun = latestEvalRuns[0]

  assert.ok(latestEvalRun, 'Expected an eval run for governance routes')

  const attachFirstResponse = await app.request(
    'http://localhost/api/v1/ai/prompts/attach-evidence',
    {
      body: JSON.stringify({
        evalRunId: latestEvalRun.id,
        promptVersionId: firstPayload.json.id,
      }),
      headers: {
        ...Object.fromEntries(authHeaders.entries()),
        'content-type': 'application/json',
      },
      method: 'POST',
    },
  )

  const activateFirstResponse = await app.request('http://localhost/api/v1/ai/prompts/activate', {
    body: JSON.stringify({
      promptVersionId: firstPayload.json.id,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  const createSecondResponse = await app.request('http://localhost/api/v1/ai/prompts', {
    body: JSON.stringify({
      notes: '治理工作台待发布版本。',
      promptKey,
      promptText: '你是后台管理 Copilot，请优先输出结构化结论，并附带风险摘要。',
      releasePolicy: {
        minAverageScore: 0.8,
        scorerThresholds: {},
      },
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const secondPayload = (await createSecondResponse.json()) as {
    json: {
      id: string
    }
  }

  const rejectedActivateResponse = await app.request(
    'http://localhost/api/v1/ai/prompts/activate',
    {
      body: JSON.stringify({
        promptVersionId: secondPayload.json.id,
      }),
      headers: {
        ...Object.fromEntries(authHeaders.entries()),
        'content-type': 'application/json',
      },
      method: 'POST',
    },
  )

  const attachSecondResponse = await app.request(
    'http://localhost/api/v1/ai/prompts/attach-evidence',
    {
      body: JSON.stringify({
        evalRunId: latestEvalRun.id,
        promptVersionId: secondPayload.json.id,
      }),
      headers: {
        ...Object.fromEntries(authHeaders.entries()),
        'content-type': 'application/json',
      },
      method: 'POST',
    },
  )

  const activateSecondResponse = await app.request('http://localhost/api/v1/ai/prompts/activate', {
    body: JSON.stringify({
      promptVersionId: secondPayload.json.id,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  const overviewResponse = await app.request(
    `http://localhost/api/v1/ai/governance/overview?page=1&pageSize=10&search=${encodeURIComponent(promptKey)}`,
    {
      headers: authHeaders,
    },
  )
  const overviewPayload = (await overviewResponse.json()) as {
    json: {
      pagination: {
        total: number
      }
      reviewQueue: Array<{
        promptKey: string
        reviewAction: string
      }>
      summary: {
        promptFailureEvents: number
        releaseReadyPromptVersions: number
        totalPromptKeys: number
      }
    }
  }

  const reviewResponse = await app.request(
    `http://localhost/api/v1/ai/governance/prompts/${promptKey}`,
    {
      headers: authHeaders,
    },
  )
  const reviewPayload = (await reviewResponse.json()) as {
    json: {
      compareToPrevious: {
        baseline: {
          id: string
        }
        summary: {
          changedFields: string[]
        }
        target: {
          id: string
        }
      } | null
      failureAudit: {
        promptKey: string
        summary: {
          totalFailureEventCount: number
        }
      }
      history: {
        promptKey: string
        versions: Array<{
          id: string
        }>
      }
      latestReleaseAudit: {
        promptVersion: {
          id: string
        }
        summary: {
          hasEvalEvidenceAttachment: boolean
        }
      } | null
      linkedEval: {
        configured: boolean
        evalKey: string | null
      }
      promptKey: string
      reviewItem: {
        promptKey: string
      }
      rollbackChain: {
        promptKey: string
      }
    }
  }

  assert.equal(createFirstResponse.status, 200)
  assert.equal(attachFirstResponse.status, 200)
  assert.equal(activateFirstResponse.status, 200)
  assert.equal(createSecondResponse.status, 200)
  assert.equal(rejectedActivateResponse.status, 400)
  assert.equal(attachSecondResponse.status, 200)
  assert.equal(activateSecondResponse.status, 200)
  assert.equal(overviewResponse.status, 200)
  assert.equal(reviewResponse.status, 200)
  assert.equal(overviewPayload.json.pagination.total, 1)
  assert.equal(overviewPayload.json.reviewQueue.length, 1)
  assert.ok(overviewPayload.json.summary.totalPromptKeys >= 1)
  assert.ok(overviewPayload.json.summary.releaseReadyPromptVersions >= 1)
  assert.ok(overviewPayload.json.summary.promptFailureEvents >= 1)
  assert.equal(overviewPayload.json.reviewQueue[0]?.promptKey, promptKey)
  assert.ok(overviewPayload.json.reviewQueue[0]?.reviewAction)
  assert.equal(reviewPayload.json.promptKey, promptKey)
  assert.equal(reviewPayload.json.reviewItem.promptKey, promptKey)
  assert.equal(reviewPayload.json.history.promptKey, promptKey)
  assert.ok(reviewPayload.json.history.versions.length >= 2)
  assert.equal(reviewPayload.json.failureAudit.promptKey, promptKey)
  assert.ok(reviewPayload.json.failureAudit.summary.totalFailureEventCount >= 1)
  assert.equal(reviewPayload.json.rollbackChain.promptKey, promptKey)
  assert.ok(reviewPayload.json.latestReleaseAudit)
  assert.equal(reviewPayload.json.latestReleaseAudit?.promptVersion.id, secondPayload.json.id)
  assert.equal(reviewPayload.json.latestReleaseAudit?.summary.hasEvalEvidenceAttachment, true)
  assert.ok(reviewPayload.json.compareToPrevious)
  assert.equal(reviewPayload.json.compareToPrevious?.target.id, secondPayload.json.id)
  assert.equal(reviewPayload.json.compareToPrevious?.baseline.id, firstPayload.json.id)
  assert.ok(reviewPayload.json.compareToPrevious?.summary.changedFields.length)
  assert.equal(reviewPayload.json.linkedEval.configured, true)
  assert.ok(reviewPayload.json.linkedEval.evalKey)
})

test('prompt governance rollback-chain route exposes rollback source and target lineage', async () => {
  const authHeaders = await createSessionForRole('admin')
  const promptKey = `admin.rollback.${randomUUID().slice(0, 8)}`

  const baselineResponse = await app.request('http://localhost/api/v1/ai/prompts', {
    body: JSON.stringify({
      notes: '回滚基线版本。',
      promptKey,
      promptText: '你是后台管理 Copilot，请输出结构化结论。',
      releasePolicy: {
        minAverageScore: 0.8,
        scorerThresholds: {},
      },
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const baselinePayload = (await baselineResponse.json()) as {
    json: {
      id: string
      version: number
    }
  }

  const targetResponse = await app.request('http://localhost/api/v1/ai/prompts', {
    body: JSON.stringify({
      notes: '回滚来源版本。',
      promptKey,
      promptText: '你是后台管理 Copilot，请输出结构化结论，并补充风险摘要。',
      releasePolicy: {
        minAverageScore: 0.8,
        scorerThresholds: {},
      },
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })
  const targetPayload = (await targetResponse.json()) as {
    json: {
      id: string
      version: number
    }
  }

  await runMastraEvalSuite({
    actorAuthUserId: 'system:prompt-rollback-chain-test',
    actorRbacUserId: null,
    evalId: 'report-schedule',
    requestId: `prompt-rollback-chain-${randomUUID()}`,
    triggerSource: 'test',
  })
  const latestEvalRuns = await listAiEvalRunsByEvalKey('report-schedule')
  const latestEvalRun = latestEvalRuns[0]

  assert.ok(latestEvalRun, 'Expected a persisted eval run for prompt rollback chain route')

  const attachBaselineResponse = await app.request(
    'http://localhost/api/v1/ai/prompts/attach-evidence',
    {
      body: JSON.stringify({
        evalRunId: latestEvalRun.id,
        promptVersionId: baselinePayload.json.id,
      }),
      headers: {
        ...Object.fromEntries(authHeaders.entries()),
        'content-type': 'application/json',
      },
      method: 'POST',
    },
  )

  const activateBaselineResponse = await app.request(
    'http://localhost/api/v1/ai/prompts/activate',
    {
      body: JSON.stringify({
        promptVersionId: baselinePayload.json.id,
      }),
      headers: {
        ...Object.fromEntries(authHeaders.entries()),
        'content-type': 'application/json',
      },
      method: 'POST',
    },
  )

  const attachTargetResponse = await app.request(
    'http://localhost/api/v1/ai/prompts/attach-evidence',
    {
      body: JSON.stringify({
        evalRunId: latestEvalRun.id,
        promptVersionId: targetPayload.json.id,
      }),
      headers: {
        ...Object.fromEntries(authHeaders.entries()),
        'content-type': 'application/json',
      },
      method: 'POST',
    },
  )

  const activateTargetResponse = await app.request('http://localhost/api/v1/ai/prompts/activate', {
    body: JSON.stringify({
      promptVersionId: targetPayload.json.id,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  const rollbackResponse = await app.request('http://localhost/api/v1/ai/prompts/rollback', {
    body: JSON.stringify({
      promptKey,
      targetVersionId: baselinePayload.json.id,
    }),
    headers: {
      ...Object.fromEntries(authHeaders.entries()),
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  const rollbackChainResponse = await app.request(
    `http://localhost/api/v1/ai/prompts/rollback-chain/${promptKey}`,
    {
      headers: authHeaders,
    },
  )
  const rollbackChainPayload = (await rollbackChainResponse.json()) as {
    json: {
      events: Array<{
        rolledBackAt: string | null
        source: {
          id: string
          status: string
          version: number
        }
        target: {
          id: string
          isActive: boolean
          rolledBackFromVersionId: string | null
          status: string
          version: number
        }
      }>
      promptKey: string
      summary: {
        activeVersionId: string | null
        latestRollbackTargetVersionId: string | null
        latestRollbackTargetVersionNumber: number | null
        totalRollbackEvents: number
      }
    }
  }

  assert.equal(baselineResponse.status, 200)
  assert.equal(targetResponse.status, 200)
  assert.equal(attachBaselineResponse.status, 200)
  assert.equal(activateBaselineResponse.status, 200)
  assert.equal(attachTargetResponse.status, 200)
  assert.equal(activateTargetResponse.status, 200)
  assert.equal(rollbackResponse.status, 200)
  assert.equal(rollbackChainResponse.status, 200)
  assert.equal(rollbackChainPayload.json.promptKey, promptKey)
  assert.equal(rollbackChainPayload.json.summary.totalRollbackEvents, 1)
  assert.equal(rollbackChainPayload.json.summary.activeVersionId, baselinePayload.json.id)
  assert.equal(
    rollbackChainPayload.json.summary.latestRollbackTargetVersionId,
    baselinePayload.json.id,
  )
  assert.equal(
    rollbackChainPayload.json.summary.latestRollbackTargetVersionNumber,
    baselinePayload.json.version,
  )
  assert.equal(rollbackChainPayload.json.events.length, 1)
  assert.equal(rollbackChainPayload.json.events[0]?.source.id, targetPayload.json.id)
  assert.equal(rollbackChainPayload.json.events[0]?.source.version, targetPayload.json.version)
  assert.equal(rollbackChainPayload.json.events[0]?.source.status, 'archived')
  assert.equal(rollbackChainPayload.json.events[0]?.target.id, baselinePayload.json.id)
  assert.equal(rollbackChainPayload.json.events[0]?.target.version, baselinePayload.json.version)
  assert.equal(rollbackChainPayload.json.events[0]?.target.isActive, true)
  assert.equal(rollbackChainPayload.json.events[0]?.target.status, 'active')
  assert.equal(
    rollbackChainPayload.json.events[0]?.target.rolledBackFromVersionId,
    targetPayload.json.id,
  )
  assert.ok(rollbackChainPayload.json.events[0]?.rolledBackAt)
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

test('OpenAPI document exposes principal repair and permission governance inspection paths', async () => {
  const response = await app.request('http://localhost/api/openapi.json')
  const payload = (await response.json()) as OpenApiDocument

  assert.equal(response.status, 200)
  assert.ok('/api/v1/system/users/principal-repair-candidates' in payload.paths)
  assert.ok('/api/v1/system/users/principal-repair' in payload.paths)
  assert.ok(
    '/api/v1/system/permissions/:id/impact' in payload.paths ||
      '/api/v1/system/permissions/{id}/impact' in payload.paths,
  )
  assert.ok(
    '/api/v1/system/permissions/:id/audit' in payload.paths ||
      '/api/v1/system/permissions/{id}/audit' in payload.paths,
  )
})

test('principal repair routes expose repair candidates and bind legacy users explicitly', async () => {
  const authHeaders = await createSessionForRole('admin')
  const suffix = randomUUID().slice(0, 8)
  const email = `principal-repair-${suffix}@example.com`
  const authUserId = `principal-repair-auth-${suffix}`
  const [legacyUser] = await db
    .insert(users)
    .values({
      authUserId: null,
      email,
      nickname: 'Principal Repair Candidate',
      passwordHash: 'principal-repair-placeholder',
      status: true,
      updatedAt: new Date(),
      username: `principal_repair_${suffix}`,
    })
    .returning({
      id: users.id,
    })

  assert.ok(legacyUser, 'Expected legacy principal repair user to be created')

  await createAuthIdentity(authUserId, email, 'Principal Repair Candidate')

  const candidateListResponse = await app.request(
    `http://localhost/api/v1/system/users/principal-repair-candidates?page=1&pageSize=10&search=${suffix}`,
    {
      headers: authHeaders,
    },
  )
  const repairResponse = await app.request(
    'http://localhost/api/v1/system/users/principal-repair',
    {
      body: JSON.stringify({
        userIds: [legacyUser.id],
      }),
      headers: {
        ...Object.fromEntries(authHeaders.entries()),
        'content-type': 'application/json',
      },
      method: 'POST',
    },
  )
  const candidatePayload = (await candidateListResponse.json()) as {
    json: {
      data: Array<{
        authUserId: string
        email: string
        userId: string
        username: string
      }>
    }
  }
  const repairPayload = (await repairResponse.json()) as {
    json: {
      repaired: Array<{
        authUserId: string | null
        reason: string | null
        status: string
        userId: string
      }>
      repairedCount: number
      skippedCount: number
    }
  }
  const [reloadedUser] = await db
    .select({
      authUserId: users.authUserId,
      id: users.id,
    })
    .from(users)
    .where(eq(users.id, legacyUser.id))
    .limit(1)

  assert.equal(candidateListResponse.status, 200)
  assert.ok(candidatePayload.json.data.some((candidate) => candidate.userId === legacyUser.id))
  assert.equal(repairResponse.status, 200)
  assert.equal(repairPayload.json.repairedCount, 1)
  assert.equal(repairPayload.json.skippedCount, 0)
  assert.equal(repairPayload.json.repaired[0]?.status, 'repaired')
  assert.equal(repairPayload.json.repaired[0]?.reason, null)
  assert.equal(reloadedUser?.authUserId, authUserId)
})

test('permission impact and audit routes expose affected roles and audit trail', async () => {
  const authHeaders = await createSessionForRole('super_admin')
  const suffix = randomUUID().slice(0, 8)
  const [createdRole] = await db
    .insert(roles)
    .values({
      code: `impact_role_${suffix}`,
      description: '权限影响面测试角色',
      name: `Impact Role ${suffix}`,
      sortOrder: 900,
      status: true,
      updatedAt: new Date(),
    })
    .returning({
      id: roles.id,
    })
  const [createdUser] = await db
    .insert(users)
    .values({
      authUserId: null,
      email: `impact-user-${suffix}@example.com`,
      nickname: 'Impact User',
      passwordHash: 'impact-user-placeholder',
      status: true,
      updatedAt: new Date(),
      username: `impact_user_${suffix}`,
    })
    .returning({
      id: users.id,
    })
  const [createdPermission] = await db
    .insert(permissions)
    .values({
      action: 'read',
      conditions: { region: 'apac' },
      description: '用于权限影响面与审计视图测试。',
      fields: ['email'],
      inverted: false,
      resource: 'User',
    })
    .returning({
      id: permissions.id,
    })

  assert.ok(createdRole)
  assert.ok(createdUser)
  assert.ok(createdPermission)

  await db.insert(userRoles).values({
    roleId: createdRole.id,
    userId: createdUser.id,
  })
  await db.insert(rolePermissions).values({
    permissionId: createdPermission.id,
    roleId: createdRole.id,
  })
  await writeOperationLog({
    action: 'update_permission',
    detail: 'Updated permission for IAM audit route test.',
    module: 'system_permissions',
    operatorId: anonymousOperationActorId,
    requestInfo: {
      requestId: `permission-impact-${suffix}`,
      roleCount: 1,
    },
    targetId: createdPermission.id,
  })

  const [impactResponse, auditResponse] = await Promise.all([
    app.request(`http://localhost/api/v1/system/permissions/${createdPermission.id}/impact`, {
      headers: authHeaders,
    }),
    app.request(`http://localhost/api/v1/system/permissions/${createdPermission.id}/audit`, {
      headers: authHeaders,
    }),
  ])
  const impactPayload = (await impactResponse.json()) as {
    json: {
      assignedRoles: Array<{ code: string; userCount: number }>
      totalAssignedRoles: number
      totalAssignedUsers: number
    }
  }
  const auditPayload = (await auditResponse.json()) as {
    json: {
      auditTrail: Array<{
        action: string
        requestInfo: Record<string, string> | null
        targetId: string | null
      }>
      permission: { id: string }
    }
  }

  assert.equal(impactResponse.status, 200)
  assert.equal(impactPayload.json.totalAssignedRoles, 1)
  assert.equal(impactPayload.json.totalAssignedUsers, 1)
  assert.equal(impactPayload.json.assignedRoles[0]?.code, `impact_role_${suffix}`)
  assert.equal(impactPayload.json.assignedRoles[0]?.userCount, 1)
  assert.equal(auditResponse.status, 200)
  assert.equal(auditPayload.json.permission.id, createdPermission.id)
  assert.equal(auditPayload.json.auditTrail[0]?.action, 'update_permission')
  assert.equal(auditPayload.json.auditTrail[0]?.targetId, createdPermission.id)
  assert.equal(
    auditPayload.json.auditTrail[0]?.requestInfo?.requestId,
    `permission-impact-${suffix}`,
  )
})
