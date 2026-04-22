import {
  type AiAuditDetail,
  type AiAuditListResponse,
  type AiEvalListResponse,
  type AiGovernanceOverview,
  aiAuditDetailSchema,
  aiAuditListResponseSchema,
  aiEvalListResponseSchema,
  aiGovernanceOverviewSchema,
  type KnowledgeListResponse,
  knowledgeListResponseSchema,
  type MenuListResponse,
  menuListResponseSchema,
  type OnlineUserListResponse,
  type OperationLogListResponse,
  onlineUserListResponseSchema,
  operationLogListResponseSchema,
  type PermissionListResponse,
  type PromptGovernanceReview,
  permissionListResponseSchema,
  promptGovernanceReviewSchema,
  type RoleListResponse,
  roleListResponseSchema,
  type ServerSummary,
  serverSummarySchema,
  type UserListResponse,
  userListResponseSchema,
} from '@ai-native-os/shared'
import type { WebEnvironment } from '@/lib/env'

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

export interface DashboardFlashMessage {
  kind: 'error' | 'success'
  message: string
}

export interface DashboardMutationState {
  action: 'created' | 'deleted' | 'updated'
  targetId: string | undefined
}

export function readSearchParam(
  searchParams: DashboardSearchParams,
  key: string,
): string | undefined {
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

export function createMenuFilterState(searchParams: DashboardSearchParams): MenuFilterState {
  const visibleValue = readSearchParam(searchParams, 'visible')

  return {
    ...createToggleFilterState(searchParams),
    visible: visibleValue === 'visible' || visibleValue === 'hidden' ? visibleValue : 'all',
  }
}

export function createPermissionFilterState(
  searchParams: DashboardSearchParams,
): PermissionFilterState {
  return {
    ...createListFilters(searchParams),
    action: normalizeSearch(readSearchParam(searchParams, 'action')),
    resource: normalizeSearch(readSearchParam(searchParams, 'resource')),
  }
}

export function createLogFilterState(searchParams: DashboardSearchParams): LogFilterState {
  const statusValue = readSearchParam(searchParams, 'status')

  return {
    ...createListFilters(searchParams),
    module: normalizeSearch(readSearchParam(searchParams, 'module')),
    status: statusValue === 'error' || statusValue === 'success' ? statusValue : 'all',
  }
}

export function createKnowledgeFilterState(
  searchParams: DashboardSearchParams,
): KnowledgeFilterState {
  return {
    ...createListFilters(searchParams),
    sourceType: normalizeSearch(readSearchParam(searchParams, 'sourceType')),
  }
}

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

export function createAiGovernanceFilterState(
  searchParams: DashboardSearchParams,
): DashboardListFilters {
  return createListFilters(searchParams)
}

export function readDashboardFlashMessage(
  searchParams: DashboardSearchParams,
): DashboardFlashMessage | null {
  const errorValue = readSearchParam(searchParams, 'error')
  const successValue = readSearchParam(searchParams, 'success')

  if (errorValue) {
    return {
      kind: 'error',
      message: errorValue,
    }
  }

  if (successValue) {
    return {
      kind: 'success',
      message: successValue,
    }
  }

  return null
}

export function readDashboardMutationState(
  searchParams: DashboardSearchParams,
): DashboardMutationState | null {
  const actionValue = readSearchParam(searchParams, 'mutation')
  const targetValue = readSearchParam(searchParams, 'target')

  if (actionValue !== 'created' && actionValue !== 'deleted' && actionValue !== 'updated') {
    return null
  }

  return {
    action: actionValue,
    targetId: targetValue,
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

export async function fetchAiAuditDetail(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  auditId: string,
): Promise<AiAuditDetail> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    `/api/v1/ai/audit/${auditId}`,
    {},
    aiAuditDetailSchema.parse,
  )
}

export async function fetchAiGovernanceOverview(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  filters: DashboardListFilters,
): Promise<AiGovernanceOverview> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/ai/governance/overview',
    {
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      search: filters.search,
    },
    aiGovernanceOverviewSchema.parse,
  )
}

export async function fetchPromptGovernanceReview(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  promptKey: string,
): Promise<PromptGovernanceReview> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    `/api/v1/ai/governance/prompts/${encodeURIComponent(promptKey)}`,
    {},
    promptGovernanceReviewSchema.parse,
  )
}
