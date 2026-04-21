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

export interface CopilotPageHandoff {
  badge: string
  note: string
  prompts: readonly string[]
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
  const routeSpecificInstruction = matchesPathPrefixes(pathname, [
    '/ai/knowledge',
    '/knowledge/collections',
  ])
    ? 'On the knowledge route, prioritize indexed document coverage, source concentration, metadata quality, and safe reindex guidance before suggesting changes.'
    : matchesPathPrefixes(pathname, ['/ai/prompts', '/build/prompts', '/govern/approvals'])
      ? 'On the prompt-governance route, prioritize release gates, failure audit, rollback readiness, linked eval evidence, and version drift before suggesting changes.'
      : matchesPathPrefixes(pathname, ['/ai/evals', '/improve/evals'])
        ? 'On the eval route, prioritize failed last runs, never-run suites, dataset coverage, and scorer reliability before suggesting changes.'
        : matchesPathPrefixes(pathname, ['/ai/audit', '/govern/audit', '/observe/runs'])
          ? 'On the audit route, prioritize forbidden calls, execution errors, human overrides, and explicit governance boundaries before suggesting changes.'
          : matchesPathPrefixes(pathname, ['/monitor/server', '/observe/monitor'])
            ? 'On the server monitor route, prioritize degraded dependencies, AI capability gaps, and runtime registry anomalies before suggesting changes.'
            : pathname.startsWith('/monitor/online')
              ? 'On the live-session route, prioritize unmapped sessions, expiring sessions, and role-density anomalies before suggesting changes.'
              : pathname.startsWith('/home')
                ? 'On the AI operations center route, prioritize the highest-risk runtime signal, release gate pressure, and operator attention queue before suggesting changes.'
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

  if (matchesPathPrefixes(pathname, ['/ai/knowledge', '/knowledge/collections'])) {
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
  } else if (matchesPathPrefixes(pathname, ['/ai/prompts', '/build/prompts'])) {
    suggestions.unshift(
      {
        message:
          'Summarize which prompt keys in the current queue are blocked by missing eval evidence, recent failures, or override pressure, then identify the first review candidate.',
        title: 'Prompt triage',
      },
      {
        message:
          'Explain whether the selected prompt key looks release-ready, exception-prone, or rollback-sensitive, and call out the missing governance evidence.',
        title: 'Release gate read',
      },
    )
  } else if (matchesPathPrefixes(pathname, ['/ai/evals', '/improve/evals'])) {
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
  } else if (matchesPathPrefixes(pathname, ['/ai/audit', '/govern/audit', '/observe/runs'])) {
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
  } else if (matchesPathPrefixes(pathname, ['/monitor/server', '/observe/monitor'])) {
    suggestions.unshift(
      {
        message:
          'Summarize the current degraded dependencies, AI capability gaps, and telemetry blind spots, then identify the first incident worth escalation.',
        title: 'Incident triage',
      },
      {
        message:
          'Explain whether the current server summary looks deploy-ready, partially degraded, or incident-shaped, and call out the missing evidence.',
        title: 'Runtime read',
      },
    )
  } else if (pathname.startsWith('/monitor/online')) {
    suggestions.unshift(
      {
        message:
          'Summarize unmapped sessions, expiring sessions, and role-density anomalies in the current slice, then identify the first operator follow-up.',
        title: 'Session triage',
      },
      {
        message:
          'Explain whether this live-session slice suggests stable identity coverage or fragile RBAC/session alignment.',
        title: 'Identity read',
      },
    )
  } else if (pathname.startsWith('/system/logs')) {
    suggestions.unshift(
      {
        message:
          'Summarize the current audit slice, identify which module is generating the most operator noise, and call out the first row that deserves escalation.',
        title: 'Trace triage',
      },
      {
        message:
          'Explain whether this log slice looks healthy, noisy, or incident-shaped, and tell me what evidence is still missing.',
        title: 'Incident read',
      },
    )
  } else if (matchesPathPrefixes(pathname, ['/reports', '/workspace/reports'])) {
    suggestions.unshift(
      {
        message:
          'Given the current reports placeholder, explain which workflow, export history, and operator controls are still missing from this surface.',
        title: 'Module gap',
      },
      {
        message:
          'Tell me which backend workflow signals should be surfaced first when the report workbench is implemented.',
        title: 'Future workbench',
      },
    )
  } else if (pathname.startsWith('/govern/approvals')) {
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
  } else if (pathname.startsWith('/home')) {
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
  } else if (shellState.visibleNavigation.some((item) => item.href === '/knowledge/collections')) {
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
  if (matchesPathPrefixes(pathname, ['/ai/knowledge', '/knowledge/collections'])) {
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

  if (matchesPathPrefixes(pathname, ['/ai/prompts', '/build/prompts'])) {
    return {
      badge: 'prompt-governance',
      guardrail:
        '只基于当前 Prompt 治理读模型、失败审计、回滚链和评测绑定给出建议，不伪造不存在的审批实体或写权限。',
      summary:
        '优先帮助操作员识别 release gate 缺口、失败模式、回滚风险和 linked eval 证据，而不是重复版本字段。',
      title: 'Prompt assistant brief',
      workstreams: [
        '指出哪些 Prompt key 正卡在缺少 eval evidence、release gate 或异常路径上。',
        '把 compare、history、rollback 和 release audit 串成统一治理解释，而不是孤立看单个接口。',
        '建议最小安全下一步，避免让操作员直接扩大到未验证的变更动作。',
      ],
    }
  }

  if (matchesPathPrefixes(pathname, ['/ai/evals', '/improve/evals'])) {
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

  if (matchesPathPrefixes(pathname, ['/ai/audit', '/govern/audit', '/observe/runs'])) {
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

  if (matchesPathPrefixes(pathname, ['/monitor/server', '/observe/monitor'])) {
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

  if (pathname.startsWith('/monitor/online')) {
    return {
      badge: 'presence-triage',
      guardrail: '只基于 Better Auth 会话和 RBAC 映射解释在线态，不把它伪装成实时 heartbeat 遥测。',
      summary:
        '优先帮助操作员识别 unmapped session、即将过期会话和角色密度异常，而不是只读会话表。',
      title: 'Presence assistant brief',
      workstreams: [
        '区分身份桥接问题、会话寿命问题和权限面过宽问题。',
        '指出当前切片里最值得先复核的会话主体。',
        '提醒这张表是认证平面近似值，不是实时在线证明。',
      ],
    }
  }

  if (pathname.startsWith('/govern/approvals')) {
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

  if (pathname.startsWith('/home')) {
    return {
      badge: 'ops-center',
      guardrail:
        '只基于当前主页可见的 runtime、eval、governance 和 audit 汇总给出建议，不假装拥有页外 incident 证据。',
      summary:
        '优先帮助操作员从全局信号中识别第一优先级风险，再判断问题属于 runtime、release gate 还是知识/评测缺口。',
      title: 'Operations center brief',
      workstreams: [
        '从 attention queue、release pipeline 和 recent events 里识别最值得升级的那条线索。',
        '把多种状态压缩成一条高信号 operator summary。',
        '始终先解释证据边界，再建议后续动作。',
      ],
    }
  }

  return null
}

/**
 * 为当前页面返回可直接展示在主工作区里的助手移交摘要，帮助操作员把问题准确交给右侧 Copilot。
 */
export function resolveCopilotPageHandoff(pathname: string): CopilotPageHandoff | null {
  if (matchesPathPrefixes(pathname, ['/system/logs', '/govern/audit', '/observe/runs'])) {
    return {
      badge: 'trace-handoff',
      note: '把问题交给助手时，优先引用当前筛选条件和可见行范围，避免让模型假设它看到了整条审计流。',
      prompts: [
        '总结当前页最值得升级排查的一条审计线索。',
        '判断这一页更像是偶发错误、权限边界触发，还是持续噪声。',
        '指出当前表格还缺哪类证据，才足够支撑 incident 结论。',
      ],
      summary: '适合让助手先读当前审计切片，再帮你判断是噪声、边界命中还是需要升级排查的事件。',
      title: 'Audit handoff',
    }
  }

  if (matchesPathPrefixes(pathname, ['/reports', '/workspace/reports'])) {
    return {
      badge: 'workflow-handoff',
      note: '当前页仍是占位工作台，所以更适合让助手做“缺口梳理”和“优先级建议”，而不是假装已经具备导出执行能力。',
      prompts: [
        '说明报表工作台当前还缺哪三块最关键的 operator UI。',
        '结合现有 workflow 设计，建议最先落到页面上的状态信号。',
        '给出一条不扩 scope 的最小实现路径，让这页从占位态进入可操作态。',
      ],
      summary: '把助手当成产品与运营桥梁，用来梳理报表工作台还缺的状态、动作和安全边界。',
      title: 'Reports handoff',
    }
  }

  if (matchesPathPrefixes(pathname, ['/ai/knowledge', '/knowledge/collections'])) {
    return {
      badge: 'knowledge-handoff',
      note: '优先围绕可见文档、metadata 密度和重建索引成本提问，不要让助手虚构页外知识库状态。',
      prompts: [
        '指出当前页最值得优先重建索引的文档，并解释原因。',
        '总结 metadata 最薄弱的文档切片和来源分布风险。',
        '给出一条安全的下一步治理动作，而不是扩大到全库。',
      ],
      summary: '适合把当前文档切片交给助手，让它先做索引治理和覆盖判断，再决定是否执行变更。',
      title: 'Knowledge handoff',
    }
  }

  if (matchesPathPrefixes(pathname, ['/ai/prompts', '/build/prompts'])) {
    return {
      badge: 'prompt-handoff',
      note: '优先引用当前选中的 promptKey、失败类型、release gate 原因和 linked eval 摘要，不要让助手猜测页外版本历史。',
      prompts: [
        '指出当前队列里最需要优先人工复核的 Prompt key，并解释原因。',
        '说明选中 Prompt 当前更像缺少评测证据、异常频发，还是已经具备激活条件。',
        '给出一条不扩 scope 的最小治理下一步，帮助我推进这个 Prompt key。',
      ],
      summary:
        '适合把当前 Prompt 治理切片交给助手做门禁解释、失败归因和回滚风险梳理，再决定是否执行人工动作。',
      title: 'Prompt governance handoff',
    }
  }

  if (matchesPathPrefixes(pathname, ['/ai/evals', '/improve/evals'])) {
    return {
      badge: 'eval-handoff',
      note: '当前页偏治理视角，适合让助手先解释失败和覆盖缺口，再决定是否触发新的 eval run。',
      prompts: [
        '说明当前页哪些 eval suite 仍然没有形成真实回归纪律。',
        '指出 last run 失败更可能是 dataset、scorer 还是 runner 问题。',
        '给出一条最小安全下一步，避免把治理问题误写成模型问题。',
      ],
      summary:
        '适合让助手把表格字段翻译成治理语言，帮助你判断应该补数据、补 scorer 还是补运行纪律。',
      title: 'Eval handoff',
    }
  }

  if (matchesPathPrefixes(pathname, ['/ai/audit', '/govern/audit'])) {
    return {
      badge: 'governance-handoff',
      note: '先让助手区分 forbidden、error、override 三类信号，再决定是否需要升级人工审批或权限调整。',
      prompts: [
        '总结当前页最高风险的治理信号，并解释为什么不是普通错误。',
        '说明这批审计行能证明什么、还不能证明什么。',
        '指出最应该优先交给人工复核的一条 override 或 forbidden 记录。',
      ],
      summary:
        '适合把当前审计切片交给助手做边界解读和风险排序，而不是直接要求它给出超出证据面的结论。',
      title: 'Governance handoff',
    }
  }

  if (matchesPathPrefixes(pathname, ['/monitor/server', '/observe/monitor'])) {
    return {
      badge: 'runtime-handoff',
      note: '把问题交给助手时，优先引用当前 degraded dependency、AI capability 状态和 telemetry 缺口，不要要求它猜测页外运行环境。',
      prompts: [
        '总结当前页最值得优先升级排查的一条 incident 线索。',
        '判断现在更像依赖故障、AI runtime 缺口，还是可观测性盲区。',
        '指出还缺哪类证据，才足以支撑生产事故结论。',
      ],
      summary: '适合把当前运行态快照交给助手做 incident triage，而不是直接跳到修复动作。',
      title: 'Runtime handoff',
    }
  }

  if (pathname.startsWith('/monitor/online')) {
    return {
      badge: 'presence-handoff',
      note: '优先让助手解释 unmapped、expiring 和 role-density 信号，再决定是否需要身份回填或会话治理动作。',
      prompts: [
        '指出当前页最需要优先复核的在线会话，并解释原因。',
        '说明这批会话更像身份桥接问题，还是登录态寿命问题。',
        '给出一条不扩 scope 的最小后续动作，帮助收紧在线面风险。',
      ],
      summary: '适合把当前在线切片交给助手做身份与会话稳定性解读，再决定是否升级处理。',
      title: 'Presence handoff',
    }
  }

  if (pathname.startsWith('/govern/approvals')) {
    return {
      badge: 'approval-handoff',
      note: '优先让助手解释 release evidence、failure pressure、rollback 风险和下一步人工动作，不要让它伪造审批结果。',
      prompts: [
        '指出当前队列里最应该先人工复核的一条审批项，并解释原因。',
        '说明选中的审批项到底是证据不足、失败压力过大，还是已经接近可批准状态。',
        '给出一条不扩 scope 的最小安全下一步，帮助推进这条审批。',
      ],
      summary: '适合把治理队列交给助手做审批排序、证据解释和风险压缩，再决定是否进入人工处理。',
      title: 'Approval handoff',
    }
  }

  if (pathname.startsWith('/home')) {
    return {
      badge: 'ops-handoff',
      note: '优先让助手在全局信号中识别第一优先级风险和最小动作，而不是要求它直接给出大范围修复方案。',
      prompts: [
        '总结当前 operations center 里最值得优先处理的一条风险。',
        '判断这条风险更像 runtime 问题、治理门禁问题，还是知识/评测缺口。',
        '给出一条不扩 scope 的最小操作建议，帮助我推进第一步。',
      ],
      summary: '适合让助手把全局状态压缩成一个高优先级 operator summary，再决定从哪个工作台切入。',
      title: 'Operations handoff',
    }
  }

  return null
}
