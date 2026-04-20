import { aiAuditGetByIdProcedure, aiAuditListProcedure } from './ai/audit'
import {
  aiEvalsGetByIdProcedure,
  aiEvalsListProcedure,
  aiEvalsRunDetailProcedure,
  aiEvalsRunProcedure,
} from './ai/evals'
import {
  aiFeedbackCreateProcedure,
  aiFeedbackGetByIdProcedure,
  aiFeedbackListProcedure,
} from './ai/feedback'
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
  aiPromptsCompareProcedure,
  aiPromptsCreateProcedure,
  aiPromptsFailureAuditProcedure,
  aiPromptsGetByIdProcedure,
  aiPromptsHistoryProcedure,
  aiPromptsListProcedure,
  aiPromptsReleaseAuditProcedure,
  aiPromptsRollbackChainProcedure,
  aiPromptsRollbackProcedure,
} from './ai/prompts'
import { monitorLogsListProcedure } from './monitor/logs'
import { monitorOnlineListProcedure } from './monitor/online'
import { monitorServerSummaryProcedure } from './monitor/server'
import { aiAuditLogsProcedure } from './system/ai-audit-logs'
import { aiToolCatalogProcedure } from './system/ai-tool-catalog'
import {
  configCreateProcedure,
  configDeleteProcedure,
  configGetByIdProcedure,
  configListProcedure,
  configUpdateProcedure,
} from './system/config'
import {
  dictsCreateProcedure,
  dictsDeleteProcedure,
  dictsGetByIdProcedure,
  dictsListProcedure,
  dictsUpdateProcedure,
} from './system/dicts'
import {
  menusCreateProcedure,
  menusDeleteProcedure,
  menusGetByIdProcedure,
  menusListProcedure,
  menusUpdateProcedure,
} from './system/menus'
import { permissionAdminCheckProcedure } from './system/permission-admin-check'
import {
  permissionsAuditProcedure,
  permissionsCreateProcedure,
  permissionsDeleteProcedure,
  permissionsGetByIdProcedure,
  permissionsImpactProcedure,
  permissionsListProcedure,
  permissionsUpdateProcedure,
} from './system/permissions'
import { pingProcedure } from './system/ping'
import {
  usersPrincipalRepairCandidatesProcedure,
  usersPrincipalRepairProcedure,
} from './system/principal-repair'
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
    audit: {
      getById: aiAuditGetByIdProcedure,
      list: aiAuditListProcedure,
    },
    evals: {
      getById: aiEvalsGetByIdProcedure,
      list: aiEvalsListProcedure,
      runDetail: aiEvalsRunDetailProcedure,
      run: aiEvalsRunProcedure,
    },
    feedback: {
      create: aiFeedbackCreateProcedure,
      getById: aiFeedbackGetByIdProcedure,
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
      compare: aiPromptsCompareProcedure,
      create: aiPromptsCreateProcedure,
      failureAudit: aiPromptsFailureAuditProcedure,
      getById: aiPromptsGetByIdProcedure,
      history: aiPromptsHistoryProcedure,
      list: aiPromptsListProcedure,
      releaseAudit: aiPromptsReleaseAuditProcedure,
      rollbackChain: aiPromptsRollbackChainProcedure,
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
    config: {
      create: configCreateProcedure,
      delete: configDeleteProcedure,
      getById: configGetByIdProcedure,
      list: configListProcedure,
      update: configUpdateProcedure,
    },
    dicts: {
      create: dictsCreateProcedure,
      delete: dictsDeleteProcedure,
      getById: dictsGetByIdProcedure,
      list: dictsListProcedure,
      update: dictsUpdateProcedure,
    },
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
      audit: permissionsAuditProcedure,
      create: permissionsCreateProcedure,
      delete: permissionsDeleteProcedure,
      getById: permissionsGetByIdProcedure,
      impact: permissionsImpactProcedure,
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
      'principal-repair': usersPrincipalRepairProcedure,
      'principal-repair-candidates': usersPrincipalRepairCandidatesProcedure,
      update: usersUpdateProcedure,
    },
  },
  tools: {
    gen: toolGenListProcedure,
    jobs: toolJobsListProcedure,
  },
}

export type AppRouter = typeof appRouter
