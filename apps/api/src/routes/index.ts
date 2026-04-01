import { aiAuditListProcedure } from './ai/audit'
import { aiEvalsListProcedure } from './ai/evals'
import { aiKnowledgeListProcedure } from './ai/knowledge'
import { monitorLogsListProcedure } from './monitor/logs'
import { monitorOnlineListProcedure } from './monitor/online'
import { monitorServerSummaryProcedure } from './monitor/server'
import { aiAuditLogsProcedure } from './system/ai-audit-logs'
import { aiToolCatalogProcedure } from './system/ai-tool-catalog'
import { menusListProcedure } from './system/menus'
import { permissionAdminCheckProcedure } from './system/permission-admin-check'
import { permissionsListProcedure } from './system/permissions'
import { pingProcedure } from './system/ping'
import { rbacSummaryProcedure } from './system/rbac-summary'
import { rolesListProcedure } from './system/roles'
import { sessionProcedure } from './system/session'
import { usersListProcedure } from './system/users'

export const appRouter = {
  ai: {
    audit: aiAuditListProcedure,
    evals: aiEvalsListProcedure,
    knowledge: aiKnowledgeListProcedure,
  },
  monitor: {
    logs: monitorLogsListProcedure,
    online: monitorOnlineListProcedure,
    server: monitorServerSummaryProcedure,
  },
  system: {
    ai: {
      'audit-logs': {
        recent: aiAuditLogsProcedure,
      },
      tools: {
        catalog: aiToolCatalogProcedure,
      },
    },
    menus: menusListProcedure,
    'permission-admin-check': permissionAdminCheckProcedure,
    ping: pingProcedure,
    permissions: permissionsListProcedure,
    'rbac-summary': rbacSummaryProcedure,
    roles: rolesListProcedure,
    session: sessionProcedure,
    users: usersListProcedure,
  },
}

export type AppRouter = typeof appRouter
