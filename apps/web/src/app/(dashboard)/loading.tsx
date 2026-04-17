import type { ReactNode } from 'react'

import { SurfaceStatePanel } from '@/components/management/page-feedback'

/**
 * 为 dashboard segment 提供统一加载态，避免路由切换时回退到无语义的空白屏。
 */
export default function DashboardLoading(): ReactNode {
  return (
    <SurfaceStatePanel
      description="正在加载当前控制台切片、权限上下文和可见工作区，请稍候。"
      eyebrow="Dashboard loading"
      hints={['如果加载时间异常变长，优先检查 session、权限上下文和当前页的数据读取链路。']}
      title="Loading operator workspace"
      tone="loading"
    />
  )
}
