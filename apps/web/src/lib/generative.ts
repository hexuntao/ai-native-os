import type { KnowledgeListResponse, UserListResponse } from '@ai-native-os/shared'

import { formatCount } from './format'

export interface GenerativeChartDatum {
  label: string
  value: number
}

export interface UserGenerativeDraft {
  roleCode: string | null
  search: string | null
  status: 'active' | 'all' | 'inactive'
}

export interface UserGenerativeResult {
  chartData: readonly GenerativeChartDatum[]
  draft: UserGenerativeDraft
  filteredRows: readonly UserListResponse['data'][number][]
  headline: string
  narrative: string
}

export interface KnowledgeGenerativeDraft {
  lens: 'all' | 'largest_chunks' | 'recent'
  search: string | null
  sourceType: string | null
}

export interface KnowledgeGenerativeResult {
  chartData: readonly GenerativeChartDatum[]
  draft: KnowledgeGenerativeDraft
  filteredRows: readonly KnowledgeListResponse['data'][number][]
  headline: string
  narrative: string
}

const promptStopWords = new Set([
  'a',
  'all',
  'and',
  'audit',
  'by',
  'docs',
  'documents',
  'for',
  'from',
  'inactive',
  'knowledge',
  'latest',
  'list',
  'me',
  'only',
  'recent',
  'show',
  'source',
  'sources',
  'status',
  'the',
  'users',
  'with',
])

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase()
}

function tokenizePrompt(prompt: string): string[] {
  return normalizePrompt(prompt)
    .split(/[^a-z0-9_.@-]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function extractQuotedSearch(prompt: string): string | null {
  const match = prompt.match(/"([^"]+)"/)

  return match?.[1]?.trim() || null
}

function createChartData(entries: Iterable<[string, number]>): GenerativeChartDatum[] {
  return [...entries]
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, value]) => ({
      label,
      value,
    }))
}

function resolveUserStatus(prompt: string): UserGenerativeDraft['status'] {
  if (/(inactive|disabled|offboard|suspended)/i.test(prompt)) {
    return 'inactive'
  }

  if (/(active|enabled|live)/i.test(prompt)) {
    return 'active'
  }

  return 'all'
}

function resolveUserRole(
  prompt: string,
  rows: readonly UserListResponse['data'][number][],
): string | null {
  const availableRoles = new Set(
    rows.flatMap((row) => row.roleCodes).map((roleCode) => roleCode.toLowerCase()),
  )

  for (const roleCode of availableRoles) {
    if (prompt.includes(roleCode)) {
      return roleCode
    }
  }

  return null
}

function resolveFallbackSearchTerm(prompt: string): string | null {
  const fallbackTokens = tokenizePrompt(prompt).filter((token) => !promptStopWords.has(token))

  return fallbackTokens.find((token) => token.length >= 3) ?? null
}

/**
 * 从自然语言中提炼用户目录页可承载的搜索词，避免生成式过滤扩大到服务端尚未支持的字段。
 */
function resolveUserSearchTerm(
  prompt: string,
  rows: readonly UserListResponse['data'][number][],
): string | null {
  const quotedSearch = extractQuotedSearch(prompt)

  if (quotedSearch) {
    return quotedSearch
  }

  const normalizedPrompt = normalizePrompt(prompt)

  for (const row of rows) {
    for (const candidate of [row.email, row.nickname ?? '', row.username]) {
      const normalizedCandidate = candidate.trim().toLowerCase()

      if (normalizedCandidate && normalizedPrompt.includes(normalizedCandidate)) {
        return candidate
      }
    }
  }

  return resolveFallbackSearchTerm(prompt)
}

/**
 * 从自然语言中提炼知识库页可承载的搜索词，只在当前页已可见的文档标题和来源中匹配。
 */
function resolveKnowledgeSearchTerm(
  prompt: string,
  rows: readonly KnowledgeListResponse['data'][number][],
): string | null {
  const quotedSearch = extractQuotedSearch(prompt)

  if (quotedSearch) {
    return quotedSearch
  }

  const normalizedPrompt = normalizePrompt(prompt)

  for (const row of rows) {
    for (const candidate of [row.sourceType, row.sourceUri ?? '', row.title]) {
      const normalizedCandidate = candidate.trim().toLowerCase()

      if (normalizedCandidate && normalizedPrompt.includes(normalizedCandidate)) {
        return candidate
      }
    }
  }

  return resolveFallbackSearchTerm(prompt)
}

function matchesSearch(haystack: readonly string[], search: string | null): boolean {
  if (!search) {
    return true
  }

  const normalizedSearch = search.trim().toLowerCase()

  return haystack.some((value) => value.toLowerCase().includes(normalizedSearch))
}

/**
 * 根据当前页可见的用户数据生成结构化筛选结果，确保生成式交互不会越过现有 RBAC 可见范围。
 */
export function applyUserDirectoryGenerativePrompt(
  prompt: string,
  rows: readonly UserListResponse['data'][number][],
): UserGenerativeResult {
  const normalizedPrompt = normalizePrompt(prompt)
  const draft: UserGenerativeDraft = {
    roleCode: resolveUserRole(normalizedPrompt, rows),
    search: resolveUserSearchTerm(normalizedPrompt, rows),
    status: resolveUserStatus(normalizedPrompt),
  }

  const filteredRows = rows.filter((row) => {
    if (draft.status === 'active' && !row.status) {
      return false
    }

    if (draft.status === 'inactive' && row.status) {
      return false
    }

    if (
      draft.roleCode &&
      !row.roleCodes.some((roleCode) => roleCode.toLowerCase() === draft.roleCode)
    ) {
      return false
    }

    return matchesSearch([row.email, row.nickname ?? '', row.username], draft.search)
  })

  const roleDistribution = new Map<string, number>()

  for (const row of filteredRows) {
    if (row.roleCodes.length === 0) {
      roleDistribution.set('unassigned', (roleDistribution.get('unassigned') ?? 0) + 1)
      continue
    }

    for (const roleCode of row.roleCodes) {
      roleDistribution.set(roleCode, (roleDistribution.get(roleCode) ?? 0) + 1)
    }
  }

  const activeCount = filteredRows.filter((row) => row.status).length
  const inactiveCount = filteredRows.length - activeCount

  return {
    chartData: createChartData(roleDistribution.entries()),
    draft,
    filteredRows,
    headline: `${formatCount(filteredRows.length)} operators match the generated lens`,
    narrative: [
      `Active ${formatCount(activeCount)} / inactive ${formatCount(inactiveCount)} within the current page slice.`,
      draft.roleCode
        ? `Role focus is constrained to ${draft.roleCode}.`
        : 'No role-specific narrowing was derived.',
      draft.search
        ? `Search focus resolves to "${draft.search}".`
        : 'No explicit identity keyword was derived.',
    ].join(' '),
  }
}

function resolveKnowledgeSourceType(
  prompt: string,
  rows: readonly KnowledgeListResponse['data'][number][],
): string | null {
  const sourceTypes = [...new Set(rows.map((row) => row.sourceType.toLowerCase()))]

  for (const sourceType of sourceTypes) {
    if (prompt.includes(sourceType)) {
      return sourceType
    }
  }

  return null
}

function resolveKnowledgeLens(prompt: string): KnowledgeGenerativeDraft['lens'] {
  if (/(recent|latest|newest|fresh)/i.test(prompt)) {
    return 'recent'
  }

  if (/(largest|chunk|heavy|dense|coverage)/i.test(prompt)) {
    return 'largest_chunks'
  }

  return 'all'
}

/**
 * 根据知识库页当前可见数据生成摘要、排序意图和来源分布，避免在 UI 侧触发新的索引或检索写路径。
 */
export function applyKnowledgeGenerativePrompt(
  prompt: string,
  rows: readonly KnowledgeListResponse['data'][number][],
): KnowledgeGenerativeResult {
  const normalizedPrompt = normalizePrompt(prompt)
  const draft: KnowledgeGenerativeDraft = {
    lens: resolveKnowledgeLens(normalizedPrompt),
    search: resolveKnowledgeSearchTerm(normalizedPrompt, rows),
    sourceType: resolveKnowledgeSourceType(normalizedPrompt, rows),
  }

  const filteredRows = rows
    .filter((row) => {
      if (draft.sourceType && row.sourceType.toLowerCase() !== draft.sourceType) {
        return false
      }

      return matchesSearch([row.sourceType, row.sourceUri ?? '', row.title], draft.search)
    })
    .sort((left, right) => {
      if (draft.lens === 'recent') {
        return new Date(right.lastIndexedAt).getTime() - new Date(left.lastIndexedAt).getTime()
      }

      if (draft.lens === 'largest_chunks') {
        return right.chunkCount - left.chunkCount
      }

      return left.title.localeCompare(right.title)
    })

  const sourceDistribution = new Map<string, number>()

  for (const row of filteredRows) {
    sourceDistribution.set(
      row.sourceType,
      (sourceDistribution.get(row.sourceType) ?? 0) + row.chunkCount,
    )
  }

  const totalChunks = filteredRows.reduce((sum, row) => sum + row.chunkCount, 0)
  const latestIndexed = filteredRows[0]?.lastIndexedAt ?? null

  return {
    chartData: createChartData(sourceDistribution.entries()),
    draft,
    filteredRows,
    headline: `${formatCount(filteredRows.length)} knowledge documents fit the generated lens`,
    narrative: [
      `Visible chunk coverage totals ${formatCount(totalChunks)} chunks in the current page slice.`,
      draft.sourceType
        ? `Source focus narrows to ${draft.sourceType}.`
        : 'No source type constraint was derived.',
      latestIndexed
        ? `Top row in the generated ordering was indexed at ${latestIndexed}.`
        : 'No indexed document matched the current prompt.',
    ].join(' '),
  }
}
