import { cookies } from 'next/headers'

import { loadShellState, type ShellState } from './api'
import { resolveWebEnvironment } from './env'

/**
 * 在 App Router 服务端读取当前登录主体的 shell state。
 *
 * 安全约束：
 * - 仅在服务端调用，避免把会话 cookie 暴露给客户端脚本
 * - 每次请求都走 no-store API 读取，防止跨用户缓存污染
 */
export async function loadCurrentShellState(errorMessage?: string): Promise<ShellState> {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString() || undefined

  return loadShellState(cookieHeader, resolveWebEnvironment(), errorMessage)
}
