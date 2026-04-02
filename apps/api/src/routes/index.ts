import { aiAuditListProcedure } from './ai/audit'
import { aiEvalsListProcedure } from './ai/evals'
import { aiFeedbackCreateProcedure, aiFeedbackListProcedure } from './ai/feedback'
import { aiKnowledgeListProcedure } from './ai/knowledge'
import {
  aiPromptsActivateProcedure,
  aiPromptsAttachEvidenceProcedure,
  aiPromptsCreateProcedure,
  aiPromptsListProcedure,
  aiPromptsRollbackProcedure,
} from './ai/prompts'
import { monitorLogsListProcedure } from './monitor/logs'
import { monitorOnlineListProcedure } from './monitor/online'
import { monitorServerSummaryProcedure } from './monitor/server'
import { aiAuditLogsProcedure } from './system/ai-audit-logs'
import { aiToolCatalogProcedure } from './system/ai-tool-catalog'
import { configListProcedure } from './system/config'
import { dictsListProcedure } from './system/dicts'
import { menusListProcedure } from './system/menus'
import { permissionAdminCheckProcedure } from './system/permission-admin-check'
import { permissionsListProcedure } from './system/permissions'
import { pingProcedure } from './system/ping'
import { rbacSummaryProcedure } from './system/rbac-summary'
import { rolesListProcedure } from './system/roles'
import { sessionProcedure } from './system/session'
import { usersListProcedure } from './system/users'
import { toolGenListProcedure } from './tools/gen'
import { toolJobsListProcedure } from './tools/jobs'

export const appRouter = {
  ai: {
    audit: aiAuditListProcedure,
    evals: aiEvalsListProcedure,
    feedback: {
      create: aiFeedbackCreateProcedure,
      list: aiFeedbackListProcedure,
    },
    knowledge: aiKnowledgeListProcedure,
    prompts: {
      activate: aiPromptsActivateProcedure,
      'attach-evidence': aiPromptsAttachEvidenceProcedure,
      create: aiPromptsCreateProcedure,
      list: aiPromptsListProcedure,
      rollback: aiPromptsRollbackProcedure,
    },
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
    config: configListProcedure,
    dicts: dictsListProcedure,
    menus: menusListProcedure,
    'permission-admin-check': permissionAdminCheckProcedure,
    ping: pingProcedure,
    permissions: permissionsListProcedure,
    'rbac-summary': rbacSummaryProcedure,
    roles: rolesListProcedure,
    session: sessionProcedure,
    users: usersListProcedure,
  },
  tools: {
    gen: toolGenListProcedure,
    jobs: toolJobsListProcedure,
  },
}

export type AppRouter = typeof appRouter
