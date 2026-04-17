import {
  type CopilotBridgeSummary,
  type CopilotSessionContextEvent,
  copilotBridgeSummarySchema,
  copilotSessionContextEventSchema,
} from '@ai-native-os/shared'
import type { CopilotChatSuggestion } from '@copilotkit/react-ui'

import type { AuthenticatedShellState } from './api'

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

function normalizeThreadSegment(value: string): string {
  return value
    .trim()
    .replaceAll(/[^a-zA-Z0-9/-]+/g, '-')
    .replaceAll('/', '--')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
}

/**
 * 在浏览器侧读取当前登录主体可见的 Copilot bridge 摘要。
 */
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

/**
 * 解析 AG-UI bootstrap 流中的 `session.context` 事件。
 */
export function parseCopilotSessionContextEventData(
  payload: string,
): CopilotSessionContextEvent | null {
  try {
    return copilotSessionContextEventSchema.parse(JSON.parse(payload))
  } catch {
    return null
  }
}

/**
 * 生成与当前主体和当前页面绑定的线程标识，避免不同页面共享同一对话上下文。
 */
export function createCopilotThreadId(resourceId: string, pathname: string): string {
  const normalizedPath = normalizeThreadSegment(pathname || '/')

  return `dashboard:${normalizeThreadSegment(resourceId)}:${normalizedPath || 'root'}`
}

/**
 * 为前端聊天层注入当前权限与页面范围，提醒模型只在后端批准的工具边界内回答。
 */
export function buildCopilotInstructions(
  shellState: AuthenticatedShellState,
  pathname: string,
): string {
  const visibleLabels = shellState.visibleNavigation.map((item) => item.label).join(', ')
  const routeSpecificInstruction = pathname.startsWith('/ai/knowledge')
    ? 'On the knowledge route, prioritize indexed document coverage, source concentration, metadata quality, and safe reindex guidance before suggesting changes.'
    : pathname.startsWith('/ai/evals')
      ? 'On the eval route, prioritize failed last runs, never-run suites, dataset coverage, and scorer reliability before suggesting changes.'
      : pathname.startsWith('/ai/audit')
        ? 'On the audit route, prioritize forbidden calls, execution errors, human overrides, and explicit governance boundaries before suggesting changes.'
        : 'Stay focused on the current route and explain operational tradeoffs before suggesting actions.'

  return [
    'You are the in-dashboard operator copilot for AI Native OS.',
    `Current route: ${pathname}.`,
    `Authenticated roles: ${shellState.roleCodes.join(', ') || 'none'}.`,
    `Visible navigation surfaces: ${visibleLabels || 'none'}.`,
    `Permission rule count: ${shellState.permissionRuleCount}.`,
    'Never imply elevated capabilities that are not available through the runtime tools.',
    'If a requested action is blocked by permissions or missing tools, explain the limit explicitly.',
    routeSpecificInstruction,
    'Prefer concise operational guidance tied to the current admin console context.',
  ].join(' ')
}

/**
 * 生成最小的静态建议问题，帮助用户快速验证聊天桥接已经接入当前权限上下文。
 */
export function buildCopilotSuggestions(
  shellState: AuthenticatedShellState,
  pathname: string,
): CopilotChatSuggestion[] {
  const suggestions: CopilotChatSuggestion[] = [
    {
      message: 'Summarize my current roles, visible navigation, and blocked admin areas.',
      title: 'Access summary',
    },
    {
      message: 'Explain which audit and reporting surfaces I can reach right now.',
      title: 'Available surfaces',
    },
    {
      message:
        'List the safest next actions I can take from this dashboard without escalating scope.',
      title: 'Next actions',
    },
  ]

  if (pathname.startsWith('/ai/knowledge')) {
    suggestions.unshift(
      {
        message:
          'Review the visible knowledge documents, call out sparse metadata coverage, and identify which document looks most expensive to reindex.',
        title: 'Knowledge coverage',
      },
      {
        message:
          'Explain whether the current knowledge slice looks source-heavy, stale, or metadata-light, and suggest the safest next operator action.',
        title: 'Index triage',
      },
    )
  } else if (pathname.startsWith('/ai/evals')) {
    suggestions.unshift(
      {
        message:
          'Explain which visible eval suites have never run, which last run failed, and what that says about current evaluation hygiene.',
        title: 'Eval hygiene',
      },
      {
        message:
          'Summarize dataset coverage, scorer density, and the most actionable next step for the eval registry on this page.',
        title: 'Registry summary',
      },
    )
  } else if (pathname.startsWith('/ai/audit')) {
    suggestions.unshift(
      {
        message:
          'Summarize the current forbidden, error, and override signals in this audit slice and identify the highest-risk governance issue.',
        title: 'Audit triage',
      },
      {
        message:
          'Explain what the current audit table can prove, what it cannot prove yet, and which signal deserves operator attention first.',
        title: 'Boundary read',
      },
    )
  } else if (shellState.visibleNavigation.some((item) => item.href === '/ai/knowledge')) {
    suggestions.push({
      message:
        'Search the knowledge workflow and explain how indexed AI knowledge is governed in this environment.',
      title: 'Knowledge context',
    })
  }

  return suggestions
}

/**
 * 为当前路由返回助手侧栏的工作台说明，避免不同 AI 页面继续共享同一段泛化文案。
 */
export function resolveCopilotRoutePanel(pathname: string): CopilotRoutePanel | null {
  if (pathname.startsWith('/ai/knowledge')) {
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

  if (pathname.startsWith('/ai/evals')) {
    return {
      badge: 'eval-governance',
      guardrail:
        '只基于当前可见 eval suite、最近一次运行和持久化 summary 给出建议，不伪造更深的实验明细。',
      summary:
        '优先帮助操作员识别 never-run 套件、失败运行、数据集覆盖和 scorer 稠密度，而不是只重复表格字段。',
      title: 'Eval assistant brief',
      workstreams: [
        '快速指出哪些 suite 已登记但仍未形成真实回归纪律。',
        '把 failed last run 解释成 scorer、dataset 或 runner 风险，而不是泛化成“模型不好”。',
        '建议最小安全下一步，而不是扩大到当前页外的治理动作。',
      ],
    }
  }

  if (pathname.startsWith('/ai/audit')) {
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

  return null
}
