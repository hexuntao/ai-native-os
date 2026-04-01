import { aiAuditLogsProcedure } from './system/ai-audit-logs'
import { aiToolCatalogProcedure } from './system/ai-tool-catalog'
import { currentAbilityProcedure } from './system/current-ability'
import { currentPermissionsProcedure } from './system/current-permissions'
import { permissionAdminCheckProcedure } from './system/permission-admin-check'
import { pingProcedure } from './system/ping'
import { rbacSummaryProcedure } from './system/rbac-summary'
import { sessionProcedure } from './system/session'

export const appRouter = {
  system: {
    ai: {
      'audit-logs': {
        recent: aiAuditLogsProcedure,
      },
      tools: {
        catalog: aiToolCatalogProcedure,
      },
    },
    'permission-admin-check': permissionAdminCheckProcedure,
    ping: pingProcedure,
    permissions: {
      ability: currentAbilityProcedure,
      current: currentPermissionsProcedure,
    },
    'rbac-summary': rbacSummaryProcedure,
    session: sessionProcedure,
  },
}

export type AppRouter = typeof appRouter
