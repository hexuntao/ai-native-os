import type { AppActions, AppSubjects } from '@ai-native-os/shared'
import type { Icons } from '@/components/icons'

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
  | '/dashboard/workspace/reports'

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
  aliases?: readonly string[]
  description: string
  group: NavigationGroupKey
  href: AppRoute
  icon: keyof typeof Icons
  label: string
  shortcut?: [string, string]
  subject: AppSubjects
}

export interface NavigationGroup {
  description: string
  items: NavigationItem[]
  key: NavigationGroupKey
  label: string
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
    description: '身份、权限与控制台管理。',
    key: 'admin',
    label: '管理',
  },
  build: {
    description: '定义 Prompt 与 AI 运行时构件。',
    key: 'build',
    label: '构建',
  },
  govern: {
    description: '审核审计、审批与发布边界。',
    key: 'govern',
    label: '治理',
  },
  home: {
    description: '全局 AI 运行态势。',
    key: 'home',
    label: '首页',
  },
  improve: {
    description: '质量、评测与迭代工作面。',
    key: 'improve',
    label: '改进',
  },
  knowledge: {
    description: '上下文工程与检索运营。',
    key: 'knowledge',
    label: '知识',
  },
  observe: {
    description: '运行时巡检、追踪与平台健康。',
    key: 'observe',
    label: '观测',
  },
  workspace: {
    description: '人工参与的工作队列与报表。',
    key: 'workspace',
    label: '工作区',
  },
}

export const navigationItems: readonly NavigationItem[] = [
  {
    action: 'read',
    aliases: ['/dashboard/home'],
    description: '全局 AI 运行态势，聚合发布、风险与运行时信号。',
    group: 'home',
    href: '/dashboard/overview',
    icon: 'dashboard',
    label: 'AI 运营中心',
    shortcut: ['g', 'h'],
    subject: 'OperationLog',
  },
  {
    action: 'read',
    description: '查看 Prompt 治理、发布门禁与关联评测证据。',
    group: 'build',
    href: '/dashboard/build/prompts',
    icon: 'sparkles',
    label: 'Prompt 工作台',
    shortcut: ['g', 'b'],
    subject: 'AiAuditLog',
  },
  {
    action: 'read',
    description: '检查 AI 运行、请求上下文与执行证据。',
    group: 'observe',
    href: '/dashboard/observe/runs',
    icon: 'checks',
    label: '运行与追踪',
    shortcut: ['g', 'r'],
    subject: 'AiAuditLog',
  },
  {
    action: 'read',
    description: '检查 API、Worker、Trigger 与登录会话健康。',
    group: 'observe',
    href: '/dashboard/observe/monitor',
    icon: 'settings',
    label: '运行监控',
    shortcut: ['g', 'm'],
    subject: 'OperationLog',
  },
  {
    action: 'read',
    description: '跟踪评测就绪度、失败态与质量覆盖。',
    group: 'improve',
    href: '/dashboard/improve/evals',
    icon: 'badgeCheck',
    label: '评测注册表',
    shortcut: ['g', 'e'],
    subject: 'AiAuditLog',
  },
  {
    action: 'manage',
    description: '管理已索引知识文档与检索输入。',
    group: 'knowledge',
    href: '/dashboard/knowledge/collections',
    icon: 'workspace',
    label: '知识集合',
    shortcut: ['g', 'k'],
    subject: 'AiKnowledge',
  },
  {
    action: 'read',
    description: '查看审批队列、证据包与治理下一步。',
    group: 'govern',
    href: '/dashboard/govern/approvals',
    icon: 'circleCheck',
    label: '审批队列',
    shortcut: ['g', 'a'],
    subject: 'AiAuditLog',
  },
  {
    action: 'read',
    description: '检查 AI 审计与操作日志驱动的治理证据。',
    group: 'govern',
    href: '/dashboard/govern/audit',
    icon: 'post',
    label: '审计台账',
    shortcut: ['g', 'u'],
    subject: 'AiAuditLog',
  },
  {
    action: 'export',
    description: '检查报表工作流缺口与导出相关工作面。',
    group: 'workspace',
    href: '/dashboard/workspace/reports',
    icon: 'page',
    label: '报表工作区',
    shortcut: ['g', 'w'],
    subject: 'Report',
  },
  {
    action: 'read',
    description: '查看认证主体、状态与分配角色。',
    group: 'admin',
    href: '/dashboard/admin/users',
    icon: 'teams',
    label: '用户目录',
    shortcut: ['g', '1'],
    subject: 'User',
  },
  {
    action: 'read',
    description: '查看种子角色及其可见控制台面。',
    group: 'admin',
    href: '/dashboard/admin/roles',
    icon: 'account',
    label: '角色矩阵',
    shortcut: ['g', '2'],
    subject: 'Role',
  },
  {
    action: 'manage',
    description: '查看并修改权限拓扑，同时保留审计安全写入。',
    group: 'admin',
    href: '/dashboard/admin/permissions',
    icon: 'lock',
    label: '权限中心',
    shortcut: ['g', '3'],
    subject: 'Permission',
  },
  {
    action: 'read',
    description: '查看路由菜单定义及其权限绑定。',
    group: 'admin',
    href: '/dashboard/admin/menus',
    icon: 'panelLeft',
    label: '导航注册表',
    shortcut: ['g', '4'],
    subject: 'Menu',
  },
] as const

export function resolveNavigationItemForPath(pathname: string): NavigationItem | undefined {
  return navigationItems.find((item) => {
    const candidatePaths = [item.href, ...(item.aliases ?? [])]

    return candidatePaths.some(
      (candidatePath) => pathname === candidatePath || pathname.startsWith(`${candidatePath}/`),
    )
  })
}

export function resolveNavigationGroupLabel(group: NavigationGroupKey): string {
  return navigationGroups[group].label
}
