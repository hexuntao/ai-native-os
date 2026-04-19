import {
  type Database,
  db,
  defaultRoles,
  systemDictEntries,
  systemDicts,
  writeOperationLog,
} from '@ai-native-os/db'
import {
  appActions,
  appSubjects,
  type CreateDictInput,
  createDictInputSchema,
  type DeleteDictInput,
  type DeleteDictResult,
  type DictEntry,
  type DictListResponse,
  deleteDictInputSchema,
  deleteDictResultSchema,
  dictListItemSchema,
  dictListResponseSchema,
  type GetDictByIdInput,
  getDictByIdInputSchema,
  type ListDictsInput,
  listDictsInputSchema,
  type UpdateDictInput,
  updateDictInputSchema,
} from '@ai-native-os/shared'
import { ORPCError } from '@orpc/server'
import { and, asc, eq, ne, or } from 'drizzle-orm'

import { requireAnyPermission } from '@/orpc/procedures'
import {
  matchesCatalogSearch,
  normalizeCatalogSearchTerm,
  paginateCatalog,
  sortCatalogByString,
} from '@/routes/lib/catalog-query'

type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type DatabaseExecutor = Database | DatabaseTransaction

interface DictMutationContext {
  actorRbacUserId: string | null
  requestId: string
}

const seedDictionaryTimestamp = '2026-04-02T00:00:00.000Z'

const dictReadPermissions = [
  { action: 'read', subject: 'Dict' },
  { action: 'manage', subject: 'Dict' },
  { action: 'manage', subject: 'all' },
] as const

const dictWritePermissions = [
  { action: 'manage', subject: 'Dict' },
  { action: 'manage', subject: 'all' },
] as const

/**
 * 构建系统内置字典目录，保留当前 contract-first 已依赖的真实种子与运行时字典。
 */
function buildVirtualDictCatalog(): DictEntry[] {
  return [
    {
      code: 'ability_actions',
      createdAt: seedDictionaryTimestamp,
      description: '系统内置 CASL 动作集合。',
      entries: appActions.map((value, index) => ({
        label: value,
        sortOrder: index + 1,
        value,
      })),
      entryCount: appActions.length,
      id: 'dict:ability-actions',
      mutable: false,
      name: '权限动作',
      source: 'seed',
      status: true,
      updatedAt: seedDictionaryTimestamp,
    },
    {
      code: 'ability_subjects',
      createdAt: seedDictionaryTimestamp,
      description: '系统内置 CASL 资源集合。',
      entries: appSubjects.map((value, index) => ({
        label: value,
        sortOrder: index + 1,
        value,
      })),
      entryCount: appSubjects.length,
      id: 'dict:ability-subjects',
      mutable: false,
      name: '权限资源',
      source: 'seed',
      status: true,
      updatedAt: seedDictionaryTimestamp,
    },
    {
      code: 'role_codes',
      createdAt: seedDictionaryTimestamp,
      description: 'RBAC 默认角色编码集合。',
      entries: defaultRoles.map((role, index) => ({
        label: role.name,
        sortOrder: index + 1,
        value: role.code,
      })),
      entryCount: defaultRoles.length,
      id: 'dict:role-codes',
      mutable: false,
      name: '角色编码',
      source: 'seed',
      status: true,
      updatedAt: seedDictionaryTimestamp,
    },
    {
      code: 'mastra_runtime_stage',
      createdAt: seedDictionaryTimestamp,
      description: 'Mastra runtime 当前支持的阶段枚举。',
      entries: ['tools_only', 'agents_ready', 'workflows_ready'].map((value, index) => ({
        label: value,
        sortOrder: index + 1,
        value,
      })),
      entryCount: 3,
      id: 'dict:mastra-runtime-stage',
      mutable: false,
      name: 'AI 运行时阶段',
      source: 'runtime',
      status: true,
      updatedAt: seedDictionaryTimestamp,
    },
  ]
}

/**
 * 加载自定义字典行及其条目，并聚合成统一对外结构。
 */
async function loadCustomDictCatalog(database: DatabaseExecutor = db): Promise<DictEntry[]> {
  const dictRows = await database.select().from(systemDicts)

  if (dictRows.length === 0) {
    return []
  }

  const entryRows = await database
    .select()
    .from(systemDictEntries)
    .where(or(...dictRows.map((row) => eq(systemDictEntries.dictId, row.id))))
    .orderBy(asc(systemDictEntries.sortOrder), asc(systemDictEntries.value))

  const entryMap = new Map<string, Array<{ label: string; sortOrder: number; value: string }>>()

  for (const entryRow of entryRows) {
    const existingEntries = entryMap.get(entryRow.dictId) ?? []
    existingEntries.push({
      label: entryRow.label,
      sortOrder: entryRow.sortOrder,
      value: entryRow.value,
    })
    entryMap.set(entryRow.dictId, existingEntries)
  }

  return dictRows.map((row) =>
    dictListItemSchema.parse({
      code: row.code,
      createdAt: row.createdAt.toISOString(),
      description: row.description,
      entries: entryMap.get(row.id) ?? [],
      entryCount: (entryMap.get(row.id) ?? []).length,
      id: row.id,
      mutable: row.source === 'custom',
      name: row.name,
      source: row.source,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
    }),
  )
}

/**
 * 统一收敛字典列表过滤逻辑，确保内置字典和自定义字典遵循同一查询规则。
 */
function filterDictCatalog(catalog: readonly DictEntry[], input: ListDictsInput): DictEntry[] {
  const normalizedSearch = normalizeCatalogSearchTerm(input.search)

  return catalog.filter((dictionary) => {
    if (input.source && dictionary.source !== input.source) {
      return false
    }

    if (input.status !== undefined && dictionary.status !== input.status) {
      return false
    }

    return matchesCatalogSearch(
      [dictionary.code, dictionary.name, dictionary.description ?? ''],
      normalizedSearch,
    )
  })
}

/**
 * 校验字典编码不会和内置目录或其他自定义字典冲突。
 */
async function assertDictCodeIsAvailable(
  code: string,
  currentDictId: string | null,
  database: DatabaseExecutor = db,
): Promise<void> {
  if (buildVirtualDictCatalog().some((item) => item.code === code)) {
    throw new ORPCError('BAD_REQUEST', {
      message: `Dictionary code ${code} is reserved by a built-in dictionary`,
    })
  }

  const duplicateRows = await database
    .select({ id: systemDicts.id })
    .from(systemDicts)
    .where(
      currentDictId
        ? and(eq(systemDicts.code, code), ne(systemDicts.id, currentDictId))
        : eq(systemDicts.code, code),
    )
    .limit(1)

  if (duplicateRows.length > 0) {
    throw new ORPCError('BAD_REQUEST', {
      message: `Dictionary code ${code} already exists`,
    })
  }
}

/**
 * 校验字典项值在同一字典内唯一，避免条目值冲突导致前端枚举不可判定。
 */
function assertUniqueDictEntryValues(entries: CreateDictInput['entries']): void {
  const normalizedValues = entries.map((entry) => entry.value.trim())

  if (new Set(normalizedValues).size !== normalizedValues.length) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Dictionary entries must use unique values',
    })
  }
}

/**
 * 资源级审计日志写入辅助，确保 helper 资源写路径也能被治理面追踪。
 */
async function writeDictOperationLog(
  action: 'create' | 'delete' | 'update',
  entry: DictEntry,
  context: DictMutationContext,
): Promise<void> {
  await writeOperationLog({
    action,
    detail: `system dict ${entry.code}`,
    module: 'system_dicts',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      dictCode: entry.code,
      dictId: entry.id,
      requestId: context.requestId,
      source: entry.source,
    },
    targetId: entry.id,
  })
}

/**
 * 按字典标识读取详情；支持内置字典和自定义字典。
 */
export async function getDictById(
  input: GetDictByIdInput,
  database: DatabaseExecutor = db,
): Promise<DictEntry> {
  const resolvedInput = getDictByIdInputSchema.parse(input)
  const virtualEntry = buildVirtualDictCatalog().find((item) => item.id === resolvedInput.id)

  if (virtualEntry) {
    return virtualEntry
  }

  const [entry] = (await loadCustomDictCatalog(database)).filter(
    (item) => item.id === resolvedInput.id,
  )

  if (!entry) {
    throw new ORPCError('NOT_FOUND', {
      message: `Dictionary ${resolvedInput.id} was not found`,
    })
  }

  return entry
}

/**
 * 分页查询字典目录；结果同时包含内置字典和自定义字典。
 */
export async function listDicts(input: ListDictsInput | undefined): Promise<DictListResponse> {
  const resolvedInput = listDictsInputSchema.parse(input)
  const catalog = sortCatalogByString(
    filterDictCatalog(
      [...buildVirtualDictCatalog(), ...(await loadCustomDictCatalog())],
      resolvedInput,
    ),
    (item) => item.code,
  )
  const paged = paginateCatalog(catalog, resolvedInput.page, resolvedInput.pageSize)

  return {
    data: paged.data,
    pagination: paged.pagination,
  }
}

/**
 * 创建自定义字典并写入全部条目。
 */
export async function createDictEntry(
  input: CreateDictInput,
  context: DictMutationContext,
): Promise<DictEntry> {
  const resolvedInput = createDictInputSchema.parse(input)
  assertUniqueDictEntryValues(resolvedInput.entries)

  return db.transaction(async (transaction) => {
    await assertDictCodeIsAvailable(resolvedInput.code, null, transaction)

    const [dictRow] = await transaction
      .insert(systemDicts)
      .values({
        code: resolvedInput.code,
        description: resolvedInput.description,
        name: resolvedInput.name,
        source: 'custom',
        status: resolvedInput.status,
      })
      .returning()

    if (!dictRow) {
      throw new Error(`Failed to create dictionary ${resolvedInput.code}`)
    }

    await transaction.insert(systemDictEntries).values(
      resolvedInput.entries.map((entry) => ({
        dictId: dictRow.id,
        label: entry.label,
        sortOrder: entry.sortOrder,
        value: entry.value,
      })),
    )

    const entry = await getDictById({ id: dictRow.id }, transaction)
    await writeDictOperationLog('create', entry, context)

    return entry
  })
}

/**
 * 更新自定义字典和其条目；内置字典固定为只读。
 */
export async function updateDictEntry(
  input: UpdateDictInput,
  context: DictMutationContext,
): Promise<DictEntry> {
  const resolvedInput = updateDictInputSchema.parse(input)
  assertUniqueDictEntryValues(resolvedInput.entries)

  if (buildVirtualDictCatalog().some((item) => item.id === resolvedInput.id)) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Built-in dictionaries are read-only',
    })
  }

  return db.transaction(async (transaction) => {
    const [existingRow] = await transaction
      .select()
      .from(systemDicts)
      .where(eq(systemDicts.id, resolvedInput.id))
      .limit(1)

    if (!existingRow) {
      throw new ORPCError('NOT_FOUND', {
        message: `Dictionary ${resolvedInput.id} was not found`,
      })
    }

    await assertDictCodeIsAvailable(resolvedInput.code, resolvedInput.id, transaction)

    const [updatedRow] = await transaction
      .update(systemDicts)
      .set({
        code: resolvedInput.code,
        description: resolvedInput.description,
        name: resolvedInput.name,
        status: resolvedInput.status,
        updatedAt: new Date(),
      })
      .where(eq(systemDicts.id, resolvedInput.id))
      .returning()

    if (!updatedRow) {
      throw new Error(`Failed to update dictionary ${resolvedInput.id}`)
    }

    await transaction
      .delete(systemDictEntries)
      .where(eq(systemDictEntries.dictId, resolvedInput.id))
    await transaction.insert(systemDictEntries).values(
      resolvedInput.entries.map((entry) => ({
        dictId: resolvedInput.id,
        label: entry.label,
        sortOrder: entry.sortOrder,
        value: entry.value,
      })),
    )

    const entry = await getDictById({ id: updatedRow.id }, transaction)
    await writeDictOperationLog('update', entry, context)

    return entry
  })
}

/**
 * 删除自定义字典；内置字典固定为只读，不允许删除。
 */
export async function deleteDictEntry(
  input: DeleteDictInput,
  context: DictMutationContext,
): Promise<DeleteDictResult> {
  const resolvedInput = deleteDictInputSchema.parse(input)

  if (buildVirtualDictCatalog().some((item) => item.id === resolvedInput.id)) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Built-in dictionaries cannot be deleted',
    })
  }

  return db.transaction(async (transaction) => {
    const [existingRow] = await transaction
      .select()
      .from(systemDicts)
      .where(eq(systemDicts.id, resolvedInput.id))
      .limit(1)

    if (!existingRow) {
      throw new ORPCError('NOT_FOUND', {
        message: `Dictionary ${resolvedInput.id} was not found`,
      })
    }

    await transaction.delete(systemDicts).where(eq(systemDicts.id, resolvedInput.id))

    await writeDictOperationLog(
      'delete',
      dictListItemSchema.parse({
        code: existingRow.code,
        createdAt: existingRow.createdAt.toISOString(),
        description: existingRow.description,
        entries: [],
        entryCount: 0,
        id: existingRow.id,
        mutable: true,
        name: existingRow.name,
        source: existingRow.source,
        status: existingRow.status,
        updatedAt: existingRow.updatedAt.toISOString(),
      }),
      context,
    )

    return deleteDictResultSchema.parse({
      deleted: true,
      id: resolvedInput.id,
    })
  })
}

/**
 * 提供系统字典分页查询。
 */
export const dictsListProcedure = requireAnyPermission(dictReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/dicts',
    tags: ['System:Dicts'],
    summary: '查询字典列表',
    description: '分页返回系统字典目录，结果同时包含内置字典和可审计的自定义字典。',
  })
  .input(listDictsInputSchema)
  .output(dictListResponseSchema)
  .handler(async ({ input }) => listDicts(input))

/**
 * 提供系统字典详情读取。
 */
export const dictsGetByIdProcedure = requireAnyPermission(dictReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/dicts/{id}',
    tags: ['System:Dicts'],
    summary: '读取字典详情',
    description: '按字典标识读取单个字典详情；支持读取内置字典和自定义字典。',
  })
  .input(getDictByIdInputSchema)
  .output(dictListItemSchema)
  .handler(async ({ input }) => getDictById(input))

/**
 * 提供自定义字典创建。
 */
export const dictsCreateProcedure = requireAnyPermission(dictWritePermissions)
  .route({
    method: 'POST',
    path: '/api/v1/system/dicts',
    tags: ['System:Dicts'],
    summary: '创建自定义字典',
    description: '创建自定义系统字典；系统会校验编码与条目值唯一性，并写入资源级审计日志。',
  })
  .input(createDictInputSchema)
  .output(dictListItemSchema)
  .handler(async ({ context, input }) =>
    createDictEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

/**
 * 提供自定义字典更新。
 */
export const dictsUpdateProcedure = requireAnyPermission(dictWritePermissions)
  .route({
    method: 'PUT',
    path: '/api/v1/system/dicts/{id}',
    tags: ['System:Dicts'],
    summary: '更新自定义字典',
    description: '更新自定义系统字典；内置种子和运行时字典固定为只读。',
  })
  .input(updateDictInputSchema)
  .output(dictListItemSchema)
  .handler(async ({ context, input }) =>
    updateDictEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

/**
 * 提供自定义字典删除。
 */
export const dictsDeleteProcedure = requireAnyPermission(dictWritePermissions)
  .route({
    method: 'DELETE',
    path: '/api/v1/system/dicts/{id}',
    tags: ['System:Dicts'],
    summary: '删除自定义字典',
    description: '删除自定义系统字典；内置种子和运行时字典固定为只读，不允许删除。',
  })
  .input(deleteDictInputSchema)
  .output(deleteDictResultSchema)
  .handler(async ({ context, input }) =>
    deleteDictEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )
