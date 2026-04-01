import {
  type AiAuditListResponse,
  type AiEvalListResponse,
  aiAuditListResponseSchema,
  aiEvalListResponseSchema,
  type KnowledgeListResponse,
  knowledgeListResponseSchema,
  type MenuListResponse,
  menuListResponseSchema,
  type OnlineUserListResponse,
  type OperationLogListResponse,
  onlineUserListResponseSchema,
  operationLogListResponseSchema,
  type PermissionListResponse,
  permissionListResponseSchema,
  type RoleListResponse,
  roleListResponseSchema,
  type ServerSummary,
  serverSummarySchema,
  type UserListResponse,
  userListResponseSchema,
} from '@ai-native-os/shared'

import type { WebEnvironment } from './env'

export interface DashboardListFilters {
  page: number
  pageSize: number
  search: string | undefined
}

export interface ToggleFilterState extends DashboardListFilters {
  status: 'active' | 'all' | 'inactive'
}

export interface MenuFilterState extends ToggleFilterState {
  visible: 'all' | 'hidden' | 'visible'
}

export interface PermissionFilterState extends DashboardListFilters {
  action: string | undefined
  resource: string | undefined
}

export interface LogFilterState extends DashboardListFilters {
  module: string | undefined
  status: 'all' | 'error' | 'success'
}

export interface KnowledgeFilterState extends DashboardListFilters {
  sourceType: string | undefined
}

export interface AiAuditFilterState extends DashboardListFilters {
  status: 'all' | 'error' | 'forbidden' | 'success'
  toolId: string | undefined
}

export type DashboardSearchParams = Record<string, string | string[] | undefined>

function readSearchParam(searchParams: DashboardSearchParams, key: string): string | undefined {
  const value = searchParams[key]

  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsedValue = Number.parseInt(value ?? '', 10)

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback
  }

  return parsedValue
}

function normalizeSearch(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim()

  return trimmedValue ? trimmedValue : undefined
}

function createJsonRequestInit(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
): RequestInit {
  const headers = new Headers({
    accept: 'application/json',
    origin: environment.appUrl,
  })

  if (cookieHeader) {
    headers.set('cookie', cookieHeader)
  }

  return {
    cache: 'no-store',
    headers,
  }
}

function createListFilters(searchParams: DashboardSearchParams): DashboardListFilters {
  return {
    page: parsePositiveInteger(readSearchParam(searchParams, 'page'), 1),
    pageSize: parsePositiveInteger(readSearchParam(searchParams, 'pageSize'), 10),
    search: normalizeSearch(readSearchParam(searchParams, 'search')),
  }
}

/**
 * 把 Dashboard 查询参数规范化为三态启停筛选，避免页面层重复解析布尔值。
 */
export function createToggleFilterState(
  searchParams: DashboardSearchParams,
  statusKey = 'status',
): ToggleFilterState {
  const statusValue = readSearchParam(searchParams, statusKey)

  return {
    ...createListFilters(searchParams),
    status: statusValue === 'active' || statusValue === 'inactive' ? statusValue : 'all',
  }
}

/**
 * 解析菜单页专用筛选状态，保留可见性与启停两个维度。
 */
export function createMenuFilterState(searchParams: DashboardSearchParams): MenuFilterState {
  const visibleValue = readSearchParam(searchParams, 'visible')

  return {
    ...createToggleFilterState(searchParams),
    visible: visibleValue === 'visible' || visibleValue === 'hidden' ? visibleValue : 'all',
  }
}

/**
 * 解析权限页筛选状态，保证资源和动作过滤都是干净字符串。
 */
export function createPermissionFilterState(
  searchParams: DashboardSearchParams,
): PermissionFilterState {
  return {
    ...createListFilters(searchParams),
    action: normalizeSearch(readSearchParam(searchParams, 'action')),
    resource: normalizeSearch(readSearchParam(searchParams, 'resource')),
  }
}

/**
 * 解析日志页筛选状态，统一处理模块名与状态枚举。
 */
export function createLogFilterState(searchParams: DashboardSearchParams): LogFilterState {
  const statusValue = readSearchParam(searchParams, 'status')

  return {
    ...createListFilters(searchParams),
    module: normalizeSearch(readSearchParam(searchParams, 'module')),
    status: statusValue === 'error' || statusValue === 'success' ? statusValue : 'all',
  }
}

/**
 * 解析知识库页筛选状态，保留来源类型查询。
 */
export function createKnowledgeFilterState(
  searchParams: DashboardSearchParams,
): KnowledgeFilterState {
  return {
    ...createListFilters(searchParams),
    sourceType: normalizeSearch(readSearchParam(searchParams, 'sourceType')),
  }
}

/**
 * 解析 AI 审计页筛选状态，保证工具标识与状态查询稳定。
 */
export function createAiAuditFilterState(searchParams: DashboardSearchParams): AiAuditFilterState {
  const statusValue = readSearchParam(searchParams, 'status')

  return {
    ...createListFilters(searchParams),
    status:
      statusValue === 'error' || statusValue === 'forbidden' || statusValue === 'success'
        ? statusValue
        : 'all',
    toolId: normalizeSearch(readSearchParam(searchParams, 'toolId')),
  }
}

function createQueryString(query: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      searchParams.set(key, value)
    }
  }

  return searchParams.toString()
}

/**
 * 构造筛选表单和分页链接，避免页面层重复手写 query string 拼接。
 */
export function createDashboardHref(
  pathname: string,
  searchParams: DashboardSearchParams,
  overrides: Record<string, string | undefined>,
): string {
  const nextQuery = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    const normalizedValue = Array.isArray(value) ? value[0] : value

    if (normalizedValue) {
      nextQuery.set(key, normalizedValue)
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (!value) {
      nextQuery.delete(key)
      continue
    }

    nextQuery.set(key, value)
  }

  const queryString = nextQuery.toString()

  return queryString ? `${pathname}?${queryString}` : pathname
}

async function fetchEnvelope<T>(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  path: string,
  query: Record<string, string | undefined>,
  parse: (payload: unknown) => T,
): Promise<T> {
  const queryString = createQueryString(query)
  const requestUrl = `${environment.apiUrl}${path}${queryString ? `?${queryString}` : ''}`
  const response = await fetch(requestUrl, createJsonRequestInit(cookieHeader, environment))

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`)
  }

  const envelope = (await response.json()) as {
    json: unknown
  }

  return parse(envelope.json)
}

/**
 * 读取用户列表，服务端页面与后续 client enhancement 共用同一数据入口。
 */
export async function fetchUsersList(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  filters: ToggleFilterState,
): Promise<UserListResponse> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/system/users',
    {
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      search: filters.search,
      status: filters.status === 'all' ? undefined : filters.status === 'active' ? 'true' : 'false',
    },
    userListResponseSchema.parse,
  )
}

/**
 * 读取角色列表。
 */
export async function fetchRolesList(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  filters: ToggleFilterState,
): Promise<RoleListResponse> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/system/roles',
    {
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      search: filters.search,
      status: filters.status === 'all' ? undefined : filters.status === 'active' ? 'true' : 'false',
    },
    roleListResponseSchema.parse,
  )
}

/**
 * 读取权限列表。
 */
export async function fetchPermissionsList(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  filters: PermissionFilterState,
): Promise<PermissionListResponse> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/system/permissions',
    {
      action: filters.action,
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      resource: filters.resource,
      search: filters.search,
    },
    permissionListResponseSchema.parse,
  )
}

/**
 * 读取菜单列表。
 */
export async function fetchMenusList(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  filters: MenuFilterState,
): Promise<MenuListResponse> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/system/menus',
    {
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      search: filters.search,
      status: filters.status === 'all' ? undefined : filters.status === 'active' ? 'true' : 'false',
      visible:
        filters.visible === 'all' ? undefined : filters.visible === 'visible' ? 'true' : 'false',
    },
    menuListResponseSchema.parse,
  )
}

/**
 * 读取操作日志列表。
 */
export async function fetchOperationLogsList(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  filters: LogFilterState,
): Promise<OperationLogListResponse> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/monitor/logs',
    {
      module: filters.module,
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      search: filters.search,
      status: filters.status === 'all' ? undefined : filters.status,
    },
    operationLogListResponseSchema.parse,
  )
}

/**
 * 读取在线用户近似列表。
 */
export async function fetchOnlineUsersList(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  filters: DashboardListFilters,
): Promise<OnlineUserListResponse> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/monitor/online',
    {
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      search: filters.search,
    },
    onlineUserListResponseSchema.parse,
  )
}

/**
 * 读取服务端运行时摘要。
 */
export async function fetchServerSummary(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
): Promise<ServerSummary> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/monitor/server',
    {},
    serverSummarySchema.parse,
  )
}

/**
 * 读取知识库文档级摘要列表。
 */
export async function fetchKnowledgeList(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  filters: KnowledgeFilterState,
): Promise<KnowledgeListResponse> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/ai/knowledge',
    {
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      search: filters.search,
      sourceType: filters.sourceType,
    },
    knowledgeListResponseSchema.parse,
  )
}

/**
 * 读取 AI 评估骨架列表。
 */
export async function fetchAiEvalsList(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  filters: DashboardListFilters,
): Promise<AiEvalListResponse> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/ai/evals',
    {
      page: String(filters.page),
      pageSize: String(filters.pageSize),
    },
    aiEvalListResponseSchema.parse,
  )
}

/**
 * 读取 AI 审计日志列表。
 */
export async function fetchAiAuditLogsList(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  filters: AiAuditFilterState,
): Promise<AiAuditListResponse> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/ai/audit',
    {
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      status: filters.status === 'all' ? undefined : filters.status,
      toolId: filters.toolId,
    },
    aiAuditListResponseSchema.parse,
  )
}
