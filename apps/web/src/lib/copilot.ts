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
  const routeSpecificInstruction =
    pathname === '/ai/knowledge'
      ? 'On the knowledge route, prioritize indexed document coverage, source concentration, and safe reindex guidance before suggesting changes.'
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

  if (pathname === '/ai/knowledge') {
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
  } else if (shellState.visibleNavigation.some((item) => item.href === '/ai/knowledge')) {
    suggestions.push({
      message:
        'Search the knowledge workflow and explain how indexed AI knowledge is governed in this environment.',
      title: 'Knowledge context',
    })
  }

  return suggestions
}
