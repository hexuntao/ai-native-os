import type { AppActions, AppSubjects } from '@ai-native-os/shared'

export type CanonicalAppRoute =
  | '/admin/menus'
  | '/admin/permissions'
  | '/admin/roles'
  | '/admin/users'
  | '/build/prompts'
  | '/govern/approvals'
  | '/govern/audit'
  | '/home'
  | '/improve/evals'
  | '/knowledge/collections'
  | '/observe/monitor'
  | '/observe/runs'
  | '/workspace/reports'

export type LegacyAppRoute =
  | '/ai/audit'
  | '/ai/evals'
  | '/ai/knowledge'
  | '/ai/prompts'
  | '/monitor/online'
  | '/monitor/server'
  | '/reports'
  | '/system/logs'
  | '/system/menus'
  | '/system/permissions'
  | '/system/roles'
  | '/system/users'

export type AppRoute = CanonicalAppRoute | LegacyAppRoute

export type NavigationGroupKey =
  | 'admin'
  | 'build'
  | 'govern'
  | 'home'
  | 'improve'
  | 'knowledge'
  | 'observe'
  | 'workspace'

export interface NavigationGroupConfig {
  description: string
  key: NavigationGroupKey
  label: string
}

export interface NavigationItem {
  action: AppActions
  description: string
  group: NavigationGroupKey
  href: CanonicalAppRoute
  label: string
  legacyHrefs?: readonly LegacyAppRoute[]
  subject: AppSubjects
}

export const navigationGroupOrder = [
  'home',
  'build',
  'observe',
  'improve',
  'knowledge',
  'govern',
  'workspace',
  'admin',
] as const

export const navigationGroups: Record<NavigationGroupKey, NavigationGroupConfig> = {
  admin: {
    description: 'Identity, permissions, and control-plane administration.',
    key: 'admin',
    label: 'Admin',
  },
  build: {
    description: 'Define prompts and other AI runtime building blocks.',
    key: 'build',
    label: 'Build',
  },
  govern: {
    description: 'Review audit, approvals, and release boundaries.',
    key: 'govern',
    label: 'Govern',
  },
  home: {
    description: 'System-wide AI operating picture.',
    key: 'home',
    label: 'Home',
  },
  improve: {
    description: 'Quality, eval, and iteration surfaces.',
    key: 'improve',
    label: 'Improve',
  },
  knowledge: {
    description: 'Context engineering and retrieval operations.',
    key: 'knowledge',
    label: 'Knowledge',
  },
  observe: {
    description: 'Runtime inspection, traces, and platform health.',
    key: 'observe',
    label: 'Observe',
  },
  workspace: {
    description: 'Human-in-the-loop work queues and reports.',
    key: 'workspace',
    label: 'Workspace',
  },
}

export const navigationItems: readonly NavigationItem[] = [
  {
    action: 'read',
    description: 'System-wide AI operating picture with release, risk, and runtime signals.',
    group: 'home',
    href: '/home',
    label: 'AI Operations Center',
    subject: 'OperationLog',
  },
  {
    action: 'read',
    description: 'Review prompt governance, release gates, and linked eval evidence.',
    group: 'build',
    href: '/build/prompts',
    label: 'Prompt Studio',
    legacyHrefs: ['/ai/prompts'],
    subject: 'AiAuditLog',
  },
  {
    action: 'read',
    description: 'Inspect AI runtime runs, request context, and execution evidence.',
    group: 'observe',
    href: '/observe/runs',
    label: 'Runs & Traces',
    legacyHrefs: ['/ai/audit'],
    subject: 'AiAuditLog',
  },
  {
    action: 'read',
    description: 'Inspect API, worker, Trigger, and authenticated session health.',
    group: 'observe',
    href: '/observe/monitor',
    legacyHrefs: ['/monitor/server', '/monitor/online'],
    label: 'Runtime Monitor',
    subject: 'OperationLog',
  },
  {
    action: 'read',
    description: 'Track evaluation readiness, failures, and quality coverage.',
    group: 'improve',
    href: '/improve/evals',
    legacyHrefs: ['/ai/evals'],
    label: 'Eval Registry',
    subject: 'AiAuditLog',
  },
  {
    action: 'manage',
    description: 'Operate indexed knowledge documents and retrieval inputs.',
    group: 'knowledge',
    href: '/knowledge/collections',
    legacyHrefs: ['/ai/knowledge'],
    label: 'Knowledge Collections',
    subject: 'AiKnowledge',
  },
  {
    action: 'read',
    description: 'Review approval queue, evidence packs, and governance next actions.',
    group: 'govern',
    href: '/govern/approvals',
    label: 'Approval Queue',
    legacyHrefs: ['/ai/prompts'],
    subject: 'AiAuditLog',
  },
  {
    action: 'read',
    description: 'Inspect AI audit and operation-log driven governance evidence.',
    group: 'govern',
    href: '/govern/audit',
    legacyHrefs: ['/ai/audit', '/system/logs'],
    label: 'Audit Ledger',
    subject: 'AiAuditLog',
  },
  {
    action: 'export',
    description: 'Inspect report workflow gaps and export-oriented operating surfaces.',
    group: 'workspace',
    href: '/workspace/reports',
    legacyHrefs: ['/reports'],
    label: 'Reports Workspace',
    subject: 'Report',
  },
  {
    action: 'read',
    description: 'Inspect authenticated principals, status, and assigned roles.',
    group: 'admin',
    href: '/admin/users',
    label: 'Users Directory',
    legacyHrefs: ['/system/users'],
    subject: 'User',
  },
  {
    action: 'read',
    description: 'Inspect seeded roles and their visible control-plane surfaces.',
    group: 'admin',
    href: '/admin/roles',
    label: 'Roles Matrix',
    legacyHrefs: ['/system/roles'],
    subject: 'Role',
  },
  {
    action: 'manage',
    description: 'Inspect and change permission topology with audit-safe writes.',
    group: 'admin',
    href: '/admin/permissions',
    label: 'Permission Center',
    legacyHrefs: ['/system/permissions'],
    subject: 'Permission',
  },
  {
    action: 'read',
    description: 'Inspect routed menu definitions and their permission bindings.',
    group: 'admin',
    href: '/admin/menus',
    label: 'Navigation Registry',
    legacyHrefs: ['/system/menus'],
    subject: 'Menu',
  },
] as const

export function findNavigationItemByHref(href: AppRoute): NavigationItem | undefined {
  return navigationItems.find(
    (item) => item.href === href || item.legacyHrefs?.includes(href as LegacyAppRoute),
  )
}

export function resolveNavigationItemForPath(pathname: string): NavigationItem | undefined {
  return navigationItems.find((item) => {
    const candidateHrefs = [item.href, ...(item.legacyHrefs ?? [])]

    return candidateHrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`))
  })
}

export function resolveNavigationGroupLabel(group: NavigationGroupKey): string {
  return navigationGroups[group].label
}
