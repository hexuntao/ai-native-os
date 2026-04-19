import type { DashboardSearchParams } from './management'

export interface OperatorMutationFeedback {
  action: 'created' | 'deleted' | 'updated'
  itemId: string | null
  message: string
}

export interface OperatorViewPresetRecord {
  id: string
  name: string
  query: Record<string, string>
}

/**
 * 读取目录页最近一次成功写操作的反馈元数据，用于行内高亮和工作台内联提示。
 */
export function readOperatorMutationFeedback(
  searchParams: DashboardSearchParams,
): OperatorMutationFeedback | null {
  const successValue = searchParams.success
  const mutationValue = searchParams.mutation
  const targetValue = searchParams.target
  const normalizedSuccess = Array.isArray(successValue) ? successValue[0] : successValue
  const normalizedMutation = Array.isArray(mutationValue) ? mutationValue[0] : mutationValue
  const normalizedTarget = Array.isArray(targetValue) ? targetValue[0] : targetValue

  if (!normalizedSuccess) {
    return null
  }

  if (
    normalizedMutation !== 'created' &&
    normalizedMutation !== 'updated' &&
    normalizedMutation !== 'deleted'
  ) {
    return null
  }

  return {
    action: normalizedMutation,
    itemId: normalizedTarget?.trim() ? normalizedTarget : null,
    message: normalizedSuccess,
  }
}

/**
 * 为目录页 View Preset 生成稳定的本地存储键，避免不同页面互相污染。
 */
export function createOperatorPresetStorageKey(scope: string): string {
  return `ai-native-os.operator-presets.${scope}`
}

/**
 * 把视图预设查询对象拼接成可导航链接，供本地预设按钮恢复页面状态。
 */
export function createOperatorPresetHref(pathname: string, query: Record<string, string>): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value.trim().length > 0) {
      searchParams.set(key, value)
    }
  }

  const queryString = searchParams.toString()

  return queryString.length > 0 ? `${pathname}?${queryString}` : pathname
}

/**
 * 规范化用户输入的预设名称，避免把空白或超长文本直接写入本地存储。
 */
export function normalizeOperatorPresetName(name: string): string {
  return name.trim().slice(0, 48)
}
