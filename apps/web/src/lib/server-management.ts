import type { PermissionListResponse, RoleListResponse } from '@ai-native-os/shared'
import { cookies } from 'next/headers'
import { fetchSerializedAbilityPayload } from './api'
import { resolveWebEnvironment } from './env'
import {
  type AiAuditFilterState,
  type DashboardListFilters,
  fetchAiAuditLogsList,
  fetchAiEvalsList,
  fetchAiGovernanceOverview,
  fetchKnowledgeList,
  fetchMenusList,
  fetchOnlineUsersList,
  fetchOperationLogsList,
  fetchPermissionsList,
  fetchPromptGovernanceReview,
  fetchRolesList,
  fetchServerSummary,
  fetchUsersList,
  type KnowledgeFilterState,
  type LogFilterState,
  type MenuFilterState,
  type PermissionFilterState,
  type ToggleFilterState,
} from './management'

/**
 * 读取当前服务端请求的 cookie 头，供后续管理接口透传同一会话上下文。
 */
async function readCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()

  return cookieStore.toString() || undefined
}

/**
 * 在服务端读取序列化权限载荷，供页面层决定是否展示写路径。
 */
export async function loadSerializedAbilityPayload(): Promise<
  Awaited<ReturnType<typeof fetchSerializedAbilityPayload>>
> {
  return fetchSerializedAbilityPayload(await readCookieHeader(), resolveWebEnvironment())
}

/**
 * 在服务端读取用户列表，复用同一套 cookie 与 API 环境配置。
 */
export async function loadUsersList(filters: ToggleFilterState) {
  return fetchUsersList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

/**
 * 在服务端读取角色列表。
 */
export async function loadRolesList(filters: ToggleFilterState) {
  return fetchRolesList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

/**
 * 在服务端读取可分配角色选项，避免用户管理页重复实现角色查询逻辑。
 */
export async function loadAssignableRoles(): Promise<RoleListResponse['data']> {
  const payload = await loadRolesList({
    page: 1,
    pageSize: 100,
    search: undefined,
    status: 'active',
  })

  return payload.data
}

/**
 * 在服务端读取可分配权限选项，供角色管理页复用统一 contract-first 数据源。
 */
export async function loadAssignablePermissions(): Promise<PermissionListResponse['data']> {
  const payload = await loadPermissionsList({
    action: undefined,
    page: 1,
    pageSize: 200,
    resource: undefined,
    search: undefined,
  })

  return payload.data
}

/**
 * 在服务端读取权限列表。
 */
export async function loadPermissionsList(filters: PermissionFilterState) {
  return fetchPermissionsList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

/**
 * 在服务端读取菜单列表。
 */
export async function loadMenusList(filters: MenuFilterState) {
  return fetchMenusList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

/**
 * 在服务端读取操作日志列表。
 */
export async function loadOperationLogsList(filters: LogFilterState) {
  return fetchOperationLogsList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

/**
 * 在服务端读取在线用户列表。
 */
export async function loadOnlineUsersList(filters: DashboardListFilters) {
  return fetchOnlineUsersList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

/**
 * 在服务端读取服务端运行时摘要。
 */
export async function loadServerSummary() {
  return fetchServerSummary(await readCookieHeader(), resolveWebEnvironment())
}

/**
 * 在服务端读取知识库列表。
 */
export async function loadKnowledgeList(filters: KnowledgeFilterState) {
  return fetchKnowledgeList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

/**
 * 在服务端读取 AI evals 列表。
 */
export async function loadAiEvalsList(filters: DashboardListFilters) {
  return fetchAiEvalsList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

/**
 * 在服务端读取 AI 审计日志列表。
 */
export async function loadAiAuditLogsList(filters: AiAuditFilterState) {
  return fetchAiAuditLogsList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

/**
 * 在服务端读取 AI 治理总览。
 */
export async function loadAiGovernanceOverview(filters: DashboardListFilters) {
  return fetchAiGovernanceOverview(await readCookieHeader(), resolveWebEnvironment(), filters)
}

/**
 * 在服务端读取单个 Prompt 治理键的治理读模型。
 */
export async function loadPromptGovernanceReview(promptKey: string) {
  return fetchPromptGovernanceReview(await readCookieHeader(), resolveWebEnvironment(), promptKey)
}
