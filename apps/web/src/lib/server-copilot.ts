import type { CopilotBridgeSummary } from '@ai-native-os/shared'
import { cookies } from 'next/headers'

import { fetchCopilotBridgeSummary } from './api'
import { resolveWebEnvironment } from './env'

/**
 * 在 App Router 服务端读取当前主体可用的 Copilot bridge 摘要。
 *
 * 约束：
 * - 仅在服务端调用，保证 API 侧认证 cookie 不进入浏览器脚本
 * - 失败时返回 `null`，由前端面板显示降级态而不是让整个 dashboard 崩溃
 */
export async function loadCurrentCopilotBridgeSummary(): Promise<CopilotBridgeSummary | null> {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString() || undefined

  return fetchCopilotBridgeSummary(cookieHeader, resolveWebEnvironment())
}
