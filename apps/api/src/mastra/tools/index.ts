import type { AppAbility } from '@ai-native-os/shared'

import { aiAuditLogSearchRegistration } from './ai-audit-log-search'
import type { RegisteredMastraTool } from './base'
import { operationLogSearchRegistration } from './operation-log-search'
import { permissionProfileRegistration } from './permission-profile'
import { reportDataSnapshotRegistration } from './report-data-snapshot'
import { runtimeConfigRegistration } from './runtime-config'
import { userDirectoryRegistration } from './user-directory'

const registeredMastraTools = [
  userDirectoryRegistration,
  permissionProfileRegistration,
  operationLogSearchRegistration,
  aiAuditLogSearchRegistration,
  reportDataSnapshotRegistration,
  runtimeConfigRegistration,
] as const satisfies readonly RegisteredMastraTool[]

export const mastraToolRegistry = registeredMastraTools
export {
  aiAuditLogSearchRegistration,
  operationLogSearchRegistration,
  permissionProfileRegistration,
  reportDataSnapshotRegistration,
  runtimeConfigRegistration,
  userDirectoryRegistration,
}

export const mastraTools = Object.fromEntries(
  registeredMastraTools.map((registration) => [registration.id, registration.tool]),
)

export interface MastraToolCatalogItem {
  description: string
  enabled: boolean
  id: string
  permission: RegisteredMastraTool['permission']
}

export function getMastraToolCatalog(ability?: AppAbility): MastraToolCatalogItem[] {
  return registeredMastraTools.map((registration) => ({
    description: registration.description,
    enabled: ability
      ? ability.can(registration.permission.action, registration.permission.subject)
      : false,
    id: registration.id,
    permission: registration.permission,
  }))
}
