import type { ReactNode } from 'react'

import { SurfaceStatePanel } from '@/components/management/page-feedback'

/**
 * 为 dashboard segment 提供统一 not-found 页面，避免未知路由回退到无上下文错误页。
 */
export default function DashboardNotFound(): ReactNode {
  return (
    <SurfaceStatePanel
      actionHref="/"
      actionLabel="Return home"
      description="这个控制台路由不存在，或者当前主体没有对应页面的可见入口。"
      eyebrow="Dashboard not found"
      hints={['先返回首页，再从当前主体可见的导航里重新进入目标模块。']}
      title="Workspace route not found"
      tone="neutral"
    />
  )
}
