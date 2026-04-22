import type { PermissionListResponse, RoleListResponse } from '@ai-native-os/shared'
import { cookies } from 'next/headers'
import { fetchSerializedAbilityPayload } from '@/lib/api'
import { resolveWebEnvironment } from '@/lib/env'
import {
  type AiAuditFilterState,
  type DashboardListFilters,
  fetchAiAuditDetail,
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
} from '@/lib/management'

async function readCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()

  return cookieStore.toString() || undefined
}

export async function loadSerializedAbilityPayload(): Promise<
  Awaited<ReturnType<typeof fetchSerializedAbilityPayload>>
> {
  return fetchSerializedAbilityPayload(await readCookieHeader(), resolveWebEnvironment())
}

export async function loadUsersList(filters: ToggleFilterState) {
  return fetchUsersList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

export async function loadRolesList(filters: ToggleFilterState) {
  return fetchRolesList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

export async function loadAssignableRoles(): Promise<RoleListResponse['data']> {
  const payload = await loadRolesList({
    page: 1,
    pageSize: 100,
    search: undefined,
    status: 'active',
  })

  return payload.data
}

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

export async function loadPermissionsList(filters: PermissionFilterState) {
  return fetchPermissionsList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

export async function loadMenusList(filters: MenuFilterState) {
  return fetchMenusList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

export async function loadOperationLogsList(filters: LogFilterState) {
  return fetchOperationLogsList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

export async function loadOnlineUsersList(filters: DashboardListFilters) {
  return fetchOnlineUsersList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

export async function loadServerSummary() {
  return fetchServerSummary(await readCookieHeader(), resolveWebEnvironment())
}

export async function loadKnowledgeList(filters: KnowledgeFilterState) {
  return fetchKnowledgeList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

export async function loadAiEvalsList(filters: DashboardListFilters) {
  return fetchAiEvalsList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

export async function loadAiAuditLogsList(filters: AiAuditFilterState) {
  return fetchAiAuditLogsList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

export async function loadAiAuditDetail(auditId: string) {
  return fetchAiAuditDetail(await readCookieHeader(), resolveWebEnvironment(), auditId)
}

export async function loadAiGovernanceOverview(filters: DashboardListFilters) {
  return fetchAiGovernanceOverview(await readCookieHeader(), resolveWebEnvironment(), filters)
}

export async function loadPromptGovernanceReview(promptKey: string) {
  return fetchPromptGovernanceReview(await readCookieHeader(), resolveWebEnvironment(), promptKey)
}
