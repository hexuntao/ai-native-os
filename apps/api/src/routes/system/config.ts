import { type Database, db, systemConfigs, writeOperationLog } from '@ai-native-os/db'
import {
  type ConfigEntry,
  type ConfigListResponse,
  type CreateConfigInput,
  configListItemSchema,
  configListResponseSchema,
  createConfigInputSchema,
  type DeleteConfigInput,
  type DeleteConfigResult,
  deleteConfigInputSchema,
  deleteConfigResultSchema,
  type GetConfigByIdInput,
  getConfigByIdInputSchema,
  type ListConfigsInput,
  listConfigsInputSchema,
  type UpdateConfigInput,
  updateConfigInputSchema,
} from '@ai-native-os/shared'
import { ORPCError } from '@orpc/server'
import { and, eq, ne } from 'drizzle-orm'

import { resolveRedisProbeConfig } from '@/lib/health'
import { resolveApiTelemetryConfig } from '@/lib/telemetry'
import { resolveMastraEnvironment } from '@/mastra/env'
import { resolveApiRateLimitEnvironment } from '@/middleware/rate-limit'
import { requireAnyPermission } from '@/orpc/procedures'
import {
  matchesCatalogSearch,
  normalizeCatalogSearchTerm,
  paginateCatalog,
  sortCatalogByString,
} from '@/routes/lib/catalog-query'

type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type DatabaseExecutor = Database | DatabaseTransaction

interface ConfigMutationContext {
  actorRbacUserId: string | null
  requestId: string
}

const configReadPermissions = [
  { action: 'read', subject: 'Config' },
  { action: 'manage', subject: 'Config' },
  { action: 'manage', subject: 'all' },
] as const

const configWritePermissions = [
  { action: 'manage', subject: 'Config' },
  { action: 'manage', subject: 'all' },
] as const

/**
 * 将配置键名压缩为稳定的内置资源标识，便于运行时摘要也能走统一详情入口。
 */
function createVirtualConfigId(key: string): string {
  return `config:${key.replaceAll(/[._:]/g, '-')}`
}

/**
 * 汇总内置只读配置摘要，保留当前 runtime 可见性，不把 helper 资源退化成纯静态表。
 */
function buildVirtualConfigCatalog(): ConfigEntry[] {
  const telemetryConfig = resolveApiTelemetryConfig(process.env)
  const rateLimitEnvironment = resolveApiRateLimitEnvironment(process.env)
  const redisProbeConfig = resolveRedisProbeConfig(process.env)
  const mastraEnvironment = resolveMastraEnvironment(process.env)
  const updatedAt = new Date().toISOString()

  return [
    {
      description: '当前 API 进程运行环境。',
      id: createVirtualConfigId('app.node_env'),
      key: 'app.node_env',
      mutable: false,
      scope: 'application',
      source: 'env',
      status: true,
      updatedAt,
      value: process.env.NODE_ENV ?? 'development',
    },
    {
      description: '当前 API 进程监听端口。',
      id: createVirtualConfigId('app.port'),
      key: 'app.port',
      mutable: false,
      scope: 'application',
      source: 'env',
      status: true,
      updatedAt,
      value: process.env.PORT ?? '3001',
    },
    {
      description: '认证后端实现类型。',
      id: createVirtualConfigId('security.auth_provider'),
      key: 'security.auth_provider',
      mutable: false,
      scope: 'security',
      source: 'static',
      status: true,
      updatedAt,
      value: 'better-auth',
    },
    {
      description: 'API 基础限流模式与通用配额。',
      id: createVirtualConfigId('security.rate_limit'),
      key: 'security.rate_limit',
      mutable: false,
      scope: 'security',
      source: 'runtime',
      status: true,
      updatedAt,
      value: `${rateLimitEnvironment.enabled ? 'enabled' : 'disabled'}:${rateLimitEnvironment.generalMaxRequests}/${rateLimitEnvironment.generalWindowMs}ms`,
    },
    {
      description: '遥测提供方接线状态摘要。',
      id: createVirtualConfigId('observability.telemetry'),
      key: 'observability.telemetry',
      mutable: false,
      scope: 'deploy',
      source: 'runtime',
      status: true,
      updatedAt,
      value: `sentry=${telemetryConfig.sentryDsn ? 'configured' : 'not-configured'};otlp=${telemetryConfig.otlpEndpoint ? 'configured' : 'not-configured'}`,
    },
    {
      description: 'AI runtime 默认模型。',
      id: createVirtualConfigId('ai.default_model'),
      key: 'ai.default_model',
      mutable: false,
      scope: 'ai',
      source: 'runtime',
      status: true,
      updatedAt,
      value: mastraEnvironment.defaultModel,
    },
    {
      description: 'Redis 健康探针配置状态。',
      id: createVirtualConfigId('deploy.redis_probe'),
      key: 'deploy.redis_probe',
      mutable: false,
      scope: 'deploy',
      source: 'runtime',
      status: true,
      updatedAt,
      value: redisProbeConfig ? 'configured' : 'not-configured',
    },
  ]
}

/**
 * 把数据库自定义配置映射成统一对外 contract，和内置运行时配置共用同一结构。
 */
function mapCustomConfigRow(row: typeof systemConfigs.$inferSelect): ConfigEntry {
  return configListItemSchema.parse({
    description: row.description,
    id: row.id,
    key: row.key,
    mutable: row.source === 'custom',
    scope: row.scope,
    source: row.source,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    value: row.value,
  })
}

/**
 * 读取自定义配置列表，供 list 和详情读路径复用。
 */
async function loadCustomConfigs(database: DatabaseExecutor = db): Promise<ConfigEntry[]> {
  const rows = await database.select().from(systemConfigs)

  return rows.map(mapCustomConfigRow)
}

/**
 * 统一收敛配置列表过滤逻辑，避免内置目录和自定义目录出现两套匹配规则。
 */
function filterConfigCatalog(
  catalog: readonly ConfigEntry[],
  input: ListConfigsInput,
): ConfigEntry[] {
  const normalizedSearch = normalizeCatalogSearchTerm(input.search)

  return catalog.filter((item) => {
    if (input.scope && item.scope !== input.scope) {
      return false
    }

    if (input.status !== undefined && item.status !== input.status) {
      return false
    }

    if (input.source && item.source !== input.source) {
      return false
    }

    return matchesCatalogSearch([item.key, item.description, item.value], normalizedSearch)
  })
}

/**
 * 校验配置键名不会和内置目录或其他自定义配置冲突。
 */
async function assertConfigKeyIsAvailable(
  key: string,
  currentConfigId: string | null,
  database: DatabaseExecutor = db,
): Promise<void> {
  if (buildVirtualConfigCatalog().some((item) => item.key === key)) {
    throw new ORPCError('BAD_REQUEST', {
      message: `Config key ${key} is reserved by a runtime config`,
    })
  }

  const duplicateRows = await database
    .select({ id: systemConfigs.id })
    .from(systemConfigs)
    .where(
      currentConfigId
        ? and(eq(systemConfigs.key, key), ne(systemConfigs.id, currentConfigId))
        : eq(systemConfigs.key, key),
    )
    .limit(1)

  if (duplicateRows.length > 0) {
    throw new ORPCError('BAD_REQUEST', {
      message: `Config key ${key} already exists`,
    })
  }
}

/**
 * 写入配置资源级审计日志，确保 helper 资源写路径也能被后续治理面追踪。
 */
async function writeConfigOperationLog(
  action: 'create' | 'delete' | 'update',
  entry: ConfigEntry,
  context: ConfigMutationContext,
): Promise<void> {
  await writeOperationLog({
    action,
    detail: `system config ${entry.key}`,
    module: 'system_configs',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      configId: entry.id,
      configKey: entry.key,
      requestId: context.requestId,
      scope: entry.scope,
      source: entry.source,
    },
    targetId: entry.id,
  })
}

/**
 * 读取配置详情；支持只读内置配置和自定义配置。
 */
export async function getConfigById(input: GetConfigByIdInput): Promise<ConfigEntry> {
  const resolvedInput = getConfigByIdInputSchema.parse(input)
  const virtualEntry = buildVirtualConfigCatalog().find((item) => item.id === resolvedInput.id)

  if (virtualEntry) {
    return virtualEntry
  }

  const [row] = await db
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.id, resolvedInput.id))
    .limit(1)

  if (!row) {
    throw new ORPCError('NOT_FOUND', {
      message: `Config ${resolvedInput.id} was not found`,
    })
  }

  return mapCustomConfigRow(row)
}

/**
 * 分页查询配置目录；结果同时包含内置运行时配置和自定义配置。
 */
export async function listConfigs(
  input: ListConfigsInput | undefined,
): Promise<ConfigListResponse> {
  const resolvedInput = listConfigsInputSchema.parse(input)
  const catalog = sortCatalogByString(
    filterConfigCatalog(
      [...buildVirtualConfigCatalog(), ...(await loadCustomConfigs())],
      resolvedInput,
    ),
    (item) => item.key,
  )
  const paged = paginateCatalog(catalog, resolvedInput.page, resolvedInput.pageSize)

  return {
    data: paged.data,
    pagination: paged.pagination,
  }
}

/**
 * 创建自定义配置摘要；不允许写入任何保留运行时键名。
 */
export async function createConfigEntry(
  input: CreateConfigInput,
  context: ConfigMutationContext,
): Promise<ConfigEntry> {
  const resolvedInput = createConfigInputSchema.parse(input)

  return db.transaction(async (transaction) => {
    await assertConfigKeyIsAvailable(resolvedInput.key, null, transaction)

    const [row] = await transaction
      .insert(systemConfigs)
      .values({
        description: resolvedInput.description,
        key: resolvedInput.key,
        scope: resolvedInput.scope,
        source: 'custom',
        status: resolvedInput.status,
        value: resolvedInput.value,
      })
      .returning()

    if (!row) {
      throw new Error(`Failed to create config ${resolvedInput.key}`)
    }

    const entry = mapCustomConfigRow(row)
    await writeConfigOperationLog('create', entry, context)

    return entry
  })
}

/**
 * 更新自定义配置；内置运行时配置固定为只读，不允许走写路径。
 */
export async function updateConfigEntry(
  input: UpdateConfigInput,
  context: ConfigMutationContext,
): Promise<ConfigEntry> {
  const resolvedInput = updateConfigInputSchema.parse(input)

  if (buildVirtualConfigCatalog().some((item) => item.id === resolvedInput.id)) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Runtime config entries are read-only',
    })
  }

  return db.transaction(async (transaction) => {
    const [existingRow] = await transaction
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.id, resolvedInput.id))
      .limit(1)

    if (!existingRow) {
      throw new ORPCError('NOT_FOUND', {
        message: `Config ${resolvedInput.id} was not found`,
      })
    }

    await assertConfigKeyIsAvailable(resolvedInput.key, resolvedInput.id, transaction)

    const [updatedRow] = await transaction
      .update(systemConfigs)
      .set({
        description: resolvedInput.description,
        key: resolvedInput.key,
        scope: resolvedInput.scope,
        status: resolvedInput.status,
        updatedAt: new Date(),
        value: resolvedInput.value,
      })
      .where(eq(systemConfigs.id, resolvedInput.id))
      .returning()

    if (!updatedRow) {
      throw new Error(`Failed to update config ${resolvedInput.id}`)
    }

    const entry = mapCustomConfigRow(updatedRow)
    await writeConfigOperationLog('update', entry, context)

    return entry
  })
}

/**
 * 删除自定义配置；内置运行时配置固定为只读，不允许删除。
 */
export async function deleteConfigEntry(
  input: DeleteConfigInput,
  context: ConfigMutationContext,
): Promise<DeleteConfigResult> {
  const resolvedInput = deleteConfigInputSchema.parse(input)

  if (buildVirtualConfigCatalog().some((item) => item.id === resolvedInput.id)) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Runtime config entries cannot be deleted',
    })
  }

  return db.transaction(async (transaction) => {
    const [existingRow] = await transaction
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.id, resolvedInput.id))
      .limit(1)

    if (!existingRow) {
      throw new ORPCError('NOT_FOUND', {
        message: `Config ${resolvedInput.id} was not found`,
      })
    }

    await transaction.delete(systemConfigs).where(eq(systemConfigs.id, resolvedInput.id))

    await writeConfigOperationLog('delete', mapCustomConfigRow(existingRow), context)

    return deleteConfigResultSchema.parse({
      deleted: true,
      id: resolvedInput.id,
    })
  })
}

/**
 * 提供系统配置目录的分页查询。
 */
export const configListProcedure = requireAnyPermission(configReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/config',
    tags: ['System:Config'],
    summary: '查询配置列表',
    description: '分页返回系统配置目录，结果同时包含只读运行时配置和可审计的自定义配置摘要。',
  })
  .input(listConfigsInputSchema)
  .output(configListResponseSchema)
  .handler(async ({ input }) => listConfigs(input))

/**
 * 提供系统配置详情读取。
 */
export const configGetByIdProcedure = requireAnyPermission(configReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/config/{id}',
    tags: ['System:Config'],
    summary: '读取配置详情',
    description: '按资源标识读取单个配置详情；支持只读运行时配置和自定义配置。',
  })
  .input(getConfigByIdInputSchema)
  .output(configListItemSchema)
  .handler(async ({ input }) => getConfigById(input))

/**
 * 提供自定义配置创建。
 */
export const configCreateProcedure = requireAnyPermission(configWritePermissions)
  .route({
    method: 'POST',
    path: '/api/v1/system/config',
    tags: ['System:Config'],
    summary: '创建自定义配置',
    description: '创建自定义配置摘要；系统会拒绝保留键名并写入资源级审计日志。',
  })
  .input(createConfigInputSchema)
  .output(configListItemSchema)
  .handler(async ({ context, input }) =>
    createConfigEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

/**
 * 提供自定义配置更新。
 */
export const configUpdateProcedure = requireAnyPermission(configWritePermissions)
  .route({
    method: 'PUT',
    path: '/api/v1/system/config/{id}',
    tags: ['System:Config'],
    summary: '更新自定义配置',
    description: '更新自定义配置摘要；内置运行时配置为只读，不允许通过该接口修改。',
  })
  .input(updateConfigInputSchema)
  .output(configListItemSchema)
  .handler(async ({ context, input }) =>
    updateConfigEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

/**
 * 提供自定义配置删除。
 */
export const configDeleteProcedure = requireAnyPermission(configWritePermissions)
  .route({
    method: 'DELETE',
    path: '/api/v1/system/config/{id}',
    tags: ['System:Config'],
    summary: '删除自定义配置',
    description: '删除自定义配置摘要；内置运行时配置固定为只读，不允许通过该接口删除。',
  })
  .input(deleteConfigInputSchema)
  .output(deleteConfigResultSchema)
  .handler(async ({ context, input }) =>
    deleteConfigEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )
