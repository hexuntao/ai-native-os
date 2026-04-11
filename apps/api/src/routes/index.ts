import { aiAuditListProcedure } from './ai/audit'
import { aiEvalsListProcedure } from './ai/evals'
import { aiFeedbackCreateProcedure, aiFeedbackListProcedure } from './ai/feedback'
import {
  aiKnowledgeCreateProcedure,
  aiKnowledgeDeleteProcedure,
  aiKnowledgeGetByIdProcedure,
  aiKnowledgeListProcedure,
  aiKnowledgeUpdateProcedure,
} from './ai/knowledge'
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
import {
  menusCreateProcedure,
  menusDeleteProcedure,
  menusGetByIdProcedure,
  menusListProcedure,
  menusUpdateProcedure,
} from './system/menus'
import { permissionAdminCheckProcedure } from './system/permission-admin-check'
import {
  permissionsCreateProcedure,
  permissionsDeleteProcedure,
  permissionsGetByIdProcedure,
  permissionsListProcedure,
  permissionsUpdateProcedure,
} from './system/permissions'
import { pingProcedure } from './system/ping'
import { rbacSummaryProcedure } from './system/rbac-summary'
import {
  rolesCreateProcedure,
  rolesDeleteProcedure,
  rolesGetByIdProcedure,
  rolesListProcedure,
  rolesUpdateProcedure,
} from './system/roles'
import { sessionProcedure } from './system/session'
import {
  usersCreateProcedure,
  usersDeleteProcedure,
  usersGetByIdProcedure,
  usersListProcedure,
  usersUpdateProcedure,
} from './system/users'
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
    knowledge: {
      create: aiKnowledgeCreateProcedure,
      delete: aiKnowledgeDeleteProcedure,
      getById: aiKnowledgeGetByIdProcedure,
      list: aiKnowledgeListProcedure,
      update: aiKnowledgeUpdateProcedure,
    },
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
    menus: {
      create: menusCreateProcedure,
      delete: menusDeleteProcedure,
      getById: menusGetByIdProcedure,
      list: menusListProcedure,
      update: menusUpdateProcedure,
    },
    'permission-admin-check': permissionAdminCheckProcedure,
    ping: pingProcedure,
    permissions: {
      create: permissionsCreateProcedure,
      delete: permissionsDeleteProcedure,
      getById: permissionsGetByIdProcedure,
      list: permissionsListProcedure,
      update: permissionsUpdateProcedure,
    },
    'rbac-summary': rbacSummaryProcedure,
    roles: {
      create: rolesCreateProcedure,
      delete: rolesDeleteProcedure,
      getById: rolesGetByIdProcedure,
      list: rolesListProcedure,
      update: rolesUpdateProcedure,
    },
    session: sessionProcedure,
    users: {
      create: usersCreateProcedure,
      delete: usersDeleteProcedure,
      getById: usersGetByIdProcedure,
      list: usersListProcedure,
      update: usersUpdateProcedure,
    },
  },
  tools: {
    gen: toolGenListProcedure,
    jobs: toolJobsListProcedure,
  },
}

export type AppRouter = typeof appRouter
