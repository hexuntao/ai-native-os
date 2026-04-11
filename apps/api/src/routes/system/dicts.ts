import { defaultRoles } from '@ai-native-os/db'
import {
  appActions,
  appSubjects,
  type DictListResponse,
  dictListResponseSchema,
  type ListDictsInput,
  listDictsInputSchema,
} from '@ai-native-os/shared'

import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination, paginateArray } from '@/routes/lib/pagination'

const seedDictionaryTimestamp = '2026-04-02T00:00:00.000Z'

type DictListItem = DictListResponse['data'][number]

/**
 * 构建系统字典目录。
 *
 * 当前阶段只提供 contract-first 所需的最小只读字典集合，
 * 让前端与 OpenAPI 可以对接真实结构，而不是依赖前端私有 mock。
 */
function buildSystemDictCatalog(): DictListItem[] {
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
      name: 'AI 运行时阶段',
      source: 'runtime',
      status: true,
      updatedAt: seedDictionaryTimestamp,
    },
  ]
}

/**
 * 提供系统字典管理页的最小只读 skeleton 列表。
 */
export async function listDicts(input: ListDictsInput | undefined): Promise<DictListResponse> {
  const resolvedInput = listDictsInputSchema.parse(input)
  const normalizedSearch = resolvedInput.search?.trim().toLowerCase()
  const catalog = buildSystemDictCatalog().filter((dictionary) => {
    if (resolvedInput.source && dictionary.source !== resolvedInput.source) {
      return false
    }

    if (resolvedInput.status !== undefined && dictionary.status !== resolvedInput.status) {
      return false
    }

    if (!normalizedSearch) {
      return true
    }

    return [dictionary.code, dictionary.name, dictionary.description ?? ''].some((field) =>
      field.toLowerCase().includes(normalizedSearch),
    )
  })
  const pagedData = paginateArray(catalog, resolvedInput.page, resolvedInput.pageSize)

  return {
    data: pagedData,
    pagination: createPagination(resolvedInput.page, resolvedInput.pageSize, catalog.length),
  }
}

/**
 * 提供系统字典管理页的最小只读 skeleton 列表。
 */
export const dictsListProcedure = requireAnyPermission([
  { action: 'read', subject: 'Dict' },
  { action: 'manage', subject: 'Dict' },
])
  .route({
    method: 'GET',
    path: '/api/v1/system/dicts',
    tags: ['System:Dicts'],
    summary: '分页查询系统字典',
    description: '返回系统管理页使用的最小真实字典目录，而不是前端私有 mock 数据。',
  })
  .input(listDictsInputSchema)
  .output(dictListResponseSchema)
  .handler(async ({ input }) => listDicts(input))
