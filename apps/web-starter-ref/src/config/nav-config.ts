import type { AppActions, AppSubjects } from '@ai-native-os/shared';
import { Icons } from '@/components/icons';

export type AppRoute =
  | '/dashboard/admin/menus'
  | '/dashboard/admin/permissions'
  | '/dashboard/admin/roles'
  | '/dashboard/admin/users'
  | '/dashboard/build/prompts'
  | '/dashboard/govern/approvals'
  | '/dashboard/govern/audit'
  | '/dashboard/improve/evals'
  | '/dashboard/knowledge/collections'
  | '/dashboard/observe/monitor'
  | '/dashboard/observe/runs'
  | '/dashboard/overview'
  | '/dashboard/workspace/reports';

export type NavigationGroupKey =
  | 'admin'
  | 'build'
  | 'govern'
  | 'home'
  | 'improve'
  | 'knowledge'
  | 'observe'
  | 'workspace';

export interface NavigationGroupConfig {
  description: string;
  key: NavigationGroupKey;
  label: string;
}

export interface NavigationItem {
  action: AppActions;
  aliases?: readonly string[];
  description: string;
  group: NavigationGroupKey;
  href: AppRoute;
  icon: keyof typeof Icons;
  label: string;
  shortcut?: [string, string];
  subject: AppSubjects;
}

export interface NavigationGroup {
  description: string;
  items: NavigationItem[];
  key: NavigationGroupKey;
  label: string;
}

export const navigationGroupOrder = [
  'home',
  'build',
  'observe',
  'improve',
  'knowledge',
  'govern',
  'workspace',
  'admin'
] as const;

export const navigationGroups: Record<NavigationGroupKey, NavigationGroupConfig> = {
  admin: {
    description: 'Identity, permissions, and control-plane administration.',
    key: 'admin',
    label: 'Admin'
  },
  build: {
    description: 'Define prompts and other AI runtime building blocks.',
    key: 'build',
    label: 'Build'
  },
  govern: {
    description: 'Review audit, approvals, and release boundaries.',
    key: 'govern',
    label: 'Govern'
  },
  home: {
    description: 'System-wide AI operating picture.',
    key: 'home',
    label: 'Home'
  },
  improve: {
    description: 'Quality, eval, and iteration surfaces.',
    key: 'improve',
    label: 'Improve'
  },
  knowledge: {
    description: 'Context engineering and retrieval operations.',
    key: 'knowledge',
    label: 'Knowledge'
  },
  observe: {
    description: 'Runtime inspection, traces, and platform health.',
    key: 'observe',
    label: 'Observe'
  },
  workspace: {
    description: 'Human-in-the-loop work queues and reports.',
    key: 'workspace',
    label: 'Workspace'
  }
};

export const navigationItems: readonly NavigationItem[] = [
  {
    action: 'read',
    aliases: ['/dashboard/home'],
    description: 'System-wide AI operating picture with release, risk, and runtime signals.',
    group: 'home',
    href: '/dashboard/overview',
    icon: 'dashboard',
    label: 'AI Operations Center',
    shortcut: ['g', 'h'],
    subject: 'OperationLog'
  },
  {
    action: 'read',
    description: 'Review prompt governance, release gates, and linked eval evidence.',
    group: 'build',
    href: '/dashboard/build/prompts',
    icon: 'sparkles',
    label: 'Prompt Studio',
    shortcut: ['g', 'b'],
    subject: 'AiAuditLog'
  },
  {
    action: 'read',
    description: 'Inspect AI runtime runs, request context, and execution evidence.',
    group: 'observe',
    href: '/dashboard/observe/runs',
    icon: 'checks',
    label: 'Runs & Traces',
    shortcut: ['g', 'r'],
    subject: 'AiAuditLog'
  },
  {
    action: 'read',
    description: 'Inspect API, worker, Trigger, and authenticated session health.',
    group: 'observe',
    href: '/dashboard/observe/monitor',
    icon: 'settings',
    label: 'Runtime Monitor',
    shortcut: ['g', 'm'],
    subject: 'OperationLog'
  },
  {
    action: 'read',
    description: 'Track evaluation readiness, failures, and quality coverage.',
    group: 'improve',
    href: '/dashboard/improve/evals',
    icon: 'badgeCheck',
    label: 'Eval Registry',
    shortcut: ['g', 'e'],
    subject: 'AiAuditLog'
  },
  {
    action: 'manage',
    description: 'Operate indexed knowledge documents and retrieval inputs.',
    group: 'knowledge',
    href: '/dashboard/knowledge/collections',
    icon: 'workspace',
    label: 'Knowledge Collections',
    shortcut: ['g', 'k'],
    subject: 'AiKnowledge'
  },
  {
    action: 'read',
    description: 'Review approval queue, evidence packs, and governance next actions.',
    group: 'govern',
    href: '/dashboard/govern/approvals',
    icon: 'circleCheck',
    label: 'Approval Queue',
    shortcut: ['g', 'a'],
    subject: 'AiAuditLog'
  },
  {
    action: 'read',
    description: 'Inspect AI audit and operation-log driven governance evidence.',
    group: 'govern',
    href: '/dashboard/govern/audit',
    icon: 'post',
    label: 'Audit Ledger',
    shortcut: ['g', 'u'],
    subject: 'AiAuditLog'
  },
  {
    action: 'export',
    description: 'Inspect report workflow gaps and export-oriented operating surfaces.',
    group: 'workspace',
    href: '/dashboard/workspace/reports',
    icon: 'page',
    label: 'Reports Workspace',
    shortcut: ['g', 'w'],
    subject: 'Report'
  },
  {
    action: 'read',
    description: 'Inspect authenticated principals, status, and assigned roles.',
    group: 'admin',
    href: '/dashboard/admin/users',
    icon: 'teams',
    label: 'Users Directory',
    shortcut: ['g', '1'],
    subject: 'User'
  },
  {
    action: 'read',
    description: 'Inspect seeded roles and their visible control-plane surfaces.',
    group: 'admin',
    href: '/dashboard/admin/roles',
    icon: 'account',
    label: 'Roles Matrix',
    shortcut: ['g', '2'],
    subject: 'Role'
  },
  {
    action: 'manage',
    description: 'Inspect and change permission topology with audit-safe writes.',
    group: 'admin',
    href: '/dashboard/admin/permissions',
    icon: 'lock',
    label: 'Permission Center',
    shortcut: ['g', '3'],
    subject: 'Permission'
  },
  {
    action: 'read',
    description: 'Inspect routed menu definitions and their permission bindings.',
    group: 'admin',
    href: '/dashboard/admin/menus',
    icon: 'panelLeft',
    label: 'Navigation Registry',
    shortcut: ['g', '4'],
    subject: 'Menu'
  }
] as const;

export function resolveNavigationItemForPath(pathname: string): NavigationItem | undefined {
  return navigationItems.find((item) => {
    const candidatePaths = [item.href, ...(item.aliases ?? [])];

    return candidatePaths.some(
      (candidatePath) => pathname === candidatePath || pathname.startsWith(`${candidatePath}/`)
    );
  });
}

export function resolveNavigationGroupLabel(group: NavigationGroupKey): string {
  return navigationGroups[group].label;
}
