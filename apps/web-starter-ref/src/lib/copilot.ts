import type { CopilotBridgeSummary, CopilotSessionContextEvent } from '@ai-native-os/shared'
import { copilotBridgeSummarySchema, copilotSessionContextEventSchema } from '@ai-native-os/shared'
import type { CopilotChatSuggestion } from '@copilotkit/react-ui'
import type { AuthenticatedShellState } from '@/lib/api'

export const copilotBrowserPaths = {
  endpoint: '/api/copilotkit',
  runtime: '/api/ag-ui/runtime',
  runtimeEvents: '/api/ag-ui/runtime/events',
} as const

export type CopilotStreamStatus = 'connecting' | 'error' | 'idle' | 'ready'

export interface CopilotRoutePanel {
  badge: string
  guardrail: string
  summary: string
  title: string
  workstreams: readonly string[]
}

export interface AssistantRailFact {
  label: string
  value: string
}

export interface AssistantRailLink {
  href: string
  label: string
}

export interface AssistantRailState {
  detail: string
  status: CopilotStreamStatus
}

export interface AssistantRailContent {
  assistantState: AssistantRailState
  facts: readonly AssistantRailFact[]
  guardrail: string
  links: readonly AssistantRailLink[]
  summary: string
  title: string
}

function matchesPathPrefixes(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname.startsWith(prefix))
}

function normalizeThreadSegment(value: string): string {
  return value
    .trim()
    .replaceAll(/[^a-zA-Z0-9/-]+/g, '-')
    .replaceAll('/', '--')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
}

function normalizeDashboardPath(pathname: string): string {
  if (pathname === '/dashboard/home' || pathname === '/dashboard/overview') {
    return '/home'
  }

  if (pathname.startsWith('/dashboard/')) {
    return pathname.replace('/dashboard', '') || '/'
  }

  return pathname
}

function createBaseFacts(
  shellState: AuthenticatedShellState,
  bridgeSummary: CopilotBridgeSummary | null,
  pathname: string,
): AssistantRailFact[] {
  const normalizedPath = normalizeDashboardPath(pathname)

  return [
    {
      label: 'Current route',
      value: normalizedPath,
    },
    {
      label: 'Roles',
      value: shellState.roleCodes.join(', ') || 'none',
    },
    {
      label: 'Permission rules',
      value: String(shellState.permissionRuleCount),
    },
    {
      label: 'Assistant bridge',
      value: bridgeSummary?.defaultAgentId ?? 'bridge-unavailable',
    },
  ]
}

export async function fetchCopilotBridgeSummaryFromBrowser(): Promise<CopilotBridgeSummary> {
  const response = await fetch(copilotBrowserPaths.runtime, {
    cache: 'no-store',
    credentials: 'include',
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to load Copilot bridge summary: ${response.status}`)
  }

  return copilotBridgeSummarySchema.parse(await response.json())
}

export function parseCopilotSessionContextEventData(
  payload: string,
): CopilotSessionContextEvent | null {
  try {
    return copilotSessionContextEventSchema.parse(JSON.parse(payload))
  } catch {
    return null
  }
}

export function createCopilotThreadId(resourceId: string, pathname: string): string {
  const normalizedPath = normalizeThreadSegment(pathname || '/')

  return `dashboard:${normalizeThreadSegment(resourceId)}:${normalizedPath || 'root'}`
}

export function buildCopilotInstructions(
  shellState: AuthenticatedShellState,
  pathname: string,
): string {
  const visibleLabels = shellState.visibleNavigation.map((item) => item.label).join(', ')
  const normalizedPath = normalizeDashboardPath(pathname)
  const routePanel = resolveCopilotRoutePanel(pathname)

  return [
    'You are the in-dashboard operator copilot for AI Native OS.',
    `Current route: ${normalizedPath}.`,
    `Authenticated roles: ${shellState.roleCodes.join(', ') || 'none'}.`,
    `Visible navigation surfaces: ${visibleLabels || 'none'}.`,
    `Permission rule count: ${shellState.permissionRuleCount}.`,
    'Never imply elevated capabilities that are not available through the runtime tools.',
    'If a requested action is blocked by permissions or missing tools, explain the limit explicitly.',
    routePanel
      ? `Current guardrail: ${routePanel.guardrail}`
      : 'Stay focused on the current route and explain operational tradeoffs before suggesting actions.',
    'Prefer concise operational guidance tied to the current starter-based control plane shell.',
  ].join(' ')
}

export function buildCopilotSuggestions(
  shellState: AuthenticatedShellState,
  pathname: string,
): CopilotChatSuggestion[] {
  const normalizedPath = normalizeDashboardPath(pathname)
  const suggestions: CopilotChatSuggestion[] = [
    {
      message: 'Summarize my current roles, visible navigation, and blocked admin areas.',
      title: 'Access summary',
    },
    {
      message: 'Explain which AI control-plane surfaces I can safely inspect from this route.',
      title: 'Visible surfaces',
    },
  ]

  if (normalizedPath === '/home') {
    suggestions.unshift(
      {
        message:
          'Summarize the highest-risk signal on the operations center and identify the first operator action worth taking.',
        title: 'Ops triage',
      },
      {
        message:
          'Explain whether the current release pipeline looks healthy, blocked by governance, or degraded by runtime issues.',
        title: 'Release posture',
      },
    )
  } else if (normalizedPath.startsWith('/observe/runs')) {
    suggestions.unshift(
      {
        message:
          'Summarize the current forbidden, error, and override signals in this audit slice and identify the highest-risk governance issue.',
        title: 'Run triage',
      },
      {
        message:
          'Explain what the current run table can prove, what it cannot prove yet, and which signal deserves operator attention first.',
        title: 'Boundary read',
      },
    )
  } else if (normalizedPath.startsWith('/govern/approvals')) {
    suggestions.unshift(
      {
        message:
          'Summarize which approval item has the strongest release evidence, which one is blocked by failures, and which one deserves human review first.',
        title: 'Approval triage',
      },
      {
        message:
          'Explain whether the selected approval looks release-ready, rollback-sensitive, or under-evidenced, and tell me the minimum safe next step.',
        title: 'Evidence read',
      },
    )
  } else if (normalizedPath.startsWith('/govern/audit')) {
    suggestions.unshift(
      {
        message:
          'Summarize the current audit evidence, highlight the strongest human override signal, and tell me what evidence is still missing.',
        title: 'Feedback trail',
      },
      {
        message:
          'Explain whether the selected audit entry indicates a routine failure, a forbidden boundary hit, or something worth escalation.',
        title: 'Audit read',
      },
    )
  } else if (normalizedPath.startsWith('/build/prompts')) {
    suggestions.unshift(
      {
        message:
          'Summarize which prompt key in the current queue is blocked by missing eval evidence, recent failures, or rollback pressure.',
        title: 'Prompt triage',
      },
      {
        message:
          'Explain whether the selected prompt looks release-ready, exception-prone, or rollback-sensitive, and call out the missing governance evidence.',
        title: 'Release gate read',
      },
    )
  } else if (normalizedPath.startsWith('/workspace/reports')) {
    suggestions.unshift(
      {
        message:
          'Explain whether the report workflow looks healthy, schedule-blocked, or missing export evidence, and identify the safest next inspection path.',
        title: 'Report health',
      },
      {
        message:
          'Summarize the latest report export evidence and tell me whether the next stop should be schedule health, export history, or workflow traces.',
        title: 'Export read',
      },
    )
  } else if (normalizedPath.startsWith('/knowledge/collections')) {
    suggestions.unshift({
      message:
        'Review the visible knowledge documents, call out sparse metadata coverage, and identify which document looks most expensive to reindex.',
      title: 'Knowledge coverage',
    })
  } else if (normalizedPath.startsWith('/admin/')) {
    suggestions.unshift({
      message:
        'Summarize the current admin table, identify the most likely write operation, and explain what permission boundary applies.',
      title: 'Admin write boundary',
    })
  }

  if (
    shellState.visibleNavigation.some((item) => item.href === '/dashboard/knowledge/collections')
  ) {
    suggestions.push({
      message:
        'Search the knowledge workflow and explain how indexed AI knowledge is governed in this environment.',
      title: 'Knowledge context',
    })
  }

  return suggestions
}

export function resolveCopilotRoutePanel(pathname: string): CopilotRoutePanel | null {
  const normalizedPath = normalizeDashboardPath(pathname)

  if (normalizedPath.startsWith('/knowledge/collections')) {
    return {
      badge: 'knowledge-workbench',
      guardrail: '只建议安全的索引治理动作，不假设可以直接重写底层 chunk 或绕过审计链。',
      summary: '优先帮助操作员判断知识覆盖、来源集中度、metadata 完整性以及整文档重建索引的成本。',
      title: 'Knowledge assistant brief',
      workstreams: [
        '识别 metadata 稀疏或来源过度集中的文档切片。',
        '指出最值得优先重建索引的高 chunk 成本文档。',
        '把建议约束在当前页已可见的知识文档和当前主体权限范围内。',
      ],
    }
  }

  if (normalizedPath.startsWith('/build/prompts')) {
    return {
      badge: 'prompt-governance',
      guardrail:
        '只基于当前 Prompt 治理读模型、失败审计、回滚链和评测绑定给出建议，不伪造不存在的审批实体或写权限。',
      summary:
        '优先帮助操作员识别 release gate 缺口、失败模式、回滚风险和 linked eval 证据，而不是重复版本字段。',
      title: 'Prompt assistant brief',
      workstreams: [
        '指出哪些 Prompt key 正卡在缺少 eval evidence、release gate 或异常路径上。',
        '把 compare、history、rollback 和 release audit 串成统一治理解释。',
        '建议最小安全下一步，避免扩大到未验证的变更动作。',
      ],
    }
  }

  if (normalizedPath.startsWith('/improve/evals')) {
    return {
      badge: 'eval-governance',
      guardrail:
        '只基于当前可见 eval suite、最近一次运行和持久化 summary 给出建议，不伪造更深的实验明细。',
      summary:
        '优先帮助操作员识别 never-run 套件、失败运行、数据集覆盖和 scorer 稠密度，而不是只重复表格字段。',
      title: 'Eval assistant brief',
      workstreams: [
        '快速指出哪些 suite 已登记但仍未形成真实回归纪律。',
        '把 failed last run 解释成 scorer、dataset 或 runner 风险。',
        '建议最小安全下一步，而不是扩大到当前页外的治理动作。',
      ],
    }
  }

  if (matchesPathPrefixes(normalizedPath, ['/govern/audit', '/observe/runs'])) {
    return {
      badge: 'audit-governance',
      guardrail: '只解释工具级审计、human override 和当前边界，不把缺失的审批流假装成已经存在。',
      summary:
        '优先帮助操作员分辨 forbidden、error、override 三类信号，并提醒当前审计面的真实边界。',
      title: 'Audit assistant brief',
      workstreams: [
        '识别权限拒绝、执行错误和人工接管之间的差异。',
        '指出当前切片里最值得升级排查的治理风险。',
        '明确这张表能证明什么、不能证明什么，避免过度解读。',
      ],
    }
  }

  if (normalizedPath.startsWith('/observe/monitor')) {
    return {
      badge: 'runtime-triage',
      guardrail:
        '只基于当前健康检查、运行时注册表和遥测连通性给出建议，不假设 worker 或外部平台已经验证完毕。',
      summary:
        '优先帮助操作员识别 degraded dependency、AI capability 缺口和 registry 异常，而不是重复状态字段。',
      title: 'Runtime assistant brief',
      workstreams: [
        '把依赖降级、AI capability 缺失和 telemetry partial 区分开。',
        '先指出最需要升级排查的一条 incident 线索，再补充影响面。',
        '明确当前页的证据边界，避免过度声称生产健康性。',
      ],
    }
  }

  if (normalizedPath.startsWith('/govern/approvals')) {
    return {
      badge: 'approval-governance',
      guardrail:
        '只根据当前 review queue、linked eval、failure audit、rollback chain 和 release audit 证据给出建议，不伪造不存在的审批实体。',
      summary:
        '优先帮助操作员判断哪些审批项已经具备证据包、哪些仍然受失败或回滚风险影响，以及哪一项最值得先人工复核。',
      title: 'Approval assistant brief',
      workstreams: [
        '按 release evidence、failure pressure 和 rollback sensitivity 给队列排序。',
        '把 evidence、policy checks 和 next action 串成一条清晰审批判断链。',
        '建议最小安全动作，而不是扩大到未验证的变更执行。',
      ],
    }
  }

  if (normalizedPath === '/home') {
    return {
      badge: 'ops-center',
      guardrail:
        '只基于当前主页可见的 runtime、eval、governance 和 audit 汇总给出建议，不假装拥有页外 incident 证据。',
      summary:
        '优先帮助操作员从全局信号中识别第一优先级风险，再判断问题属于 runtime、release gate 还是知识/评测缺口。',
      title: 'Operations center brief',
      workstreams: [
        '从 attention queue、release pipeline 和 recent events 里识别最值得升级的线索。',
        '把多种状态压缩成一条高信号 operator summary。',
        '始终先解释证据边界，再建议后续动作。',
      ],
    }
  }

  if (normalizedPath.startsWith('/workspace/reports')) {
    return {
      badge: 'report-workspace',
      guardrail:
        '当前报表页优先暴露 schedule、export history 和 workflow evidence；不要假设 shell 已具备直接触发导出的写能力。',
      summary:
        '优先帮助操作员判断计划任务是否健康、最近导出是否成功，以及下一步应该看 schedule、快照还是运行审计。',
      title: 'Reports assistant brief',
      workstreams: [
        '区分计划调度异常、workflow 执行异常和导出证据缺口。',
        '把最近导出记录与运行时健康状态串成一条可追踪解释链。',
        '建议下一步去 schedule health、export history 或 workflow traces，而不是扩大到新模块。',
      ],
    }
  }

  return {
    badge: 'control-plane',
    guardrail: '只根据当前 starter-based shell 可见的数据与权限边界给出建议。',
    summary: '优先帮助操作员解释当前页面目的、边界和安全下一步。',
    title: 'Control plane assistant brief',
    workstreams: ['总结当前页面用途。', '明确权限边界。', '建议最小安全下一步。'],
  }
}

export function resolveAssistantRailContent(
  pathname: string,
  shellState: AuthenticatedShellState,
  bridgeSummary: CopilotBridgeSummary | null,
  content: {
    links: readonly AssistantRailLink[]
    summary: string | null
    title: string | null
  } | null,
): AssistantRailContent {
  const routePanel = resolveCopilotRoutePanel(pathname)
  const bridgeEnabled =
    bridgeSummary?.capability.status === 'enabled' && Boolean(bridgeSummary.defaultAgentId)

  return {
    assistantState: {
      detail: bridgeSummary
        ? bridgeSummary.capability.reason
        : 'Copilot bridge summary is unavailable for this session.',
      status: bridgeEnabled ? 'connecting' : bridgeSummary ? 'error' : 'idle',
    },
    facts: createBaseFacts(shellState, bridgeSummary, pathname),
    guardrail: routePanel?.guardrail ?? 'Stay within the current route and authenticated shell.',
    links: content?.links ?? [],
    summary: content?.summary ?? routePanel?.summary ?? 'No route-specific summary is available.',
    title: content?.title ?? routePanel?.title ?? 'Assistant Rail',
  }
}
