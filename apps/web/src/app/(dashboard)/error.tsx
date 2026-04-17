'use client'

import { Button } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import { SurfaceStatePanel } from '@/components/management/page-feedback'

interface DashboardErrorProps {
  error: Error & {
    digest?: string
  }
  reset: () => void
}

/**
 * 为 dashboard segment 提供统一错误态，保证失败时仍保留可操作的恢复入口。
 */
export default function DashboardError({ error, reset }: DashboardErrorProps): ReactNode {
  return (
    <div className="grid gap-4">
      <SurfaceStatePanel
        description="当前控制台切片加载失败。先重试当前路由；如果仍失败，再回到上一层筛选范围缩小问题面。"
        eyebrow="Dashboard error"
        hints={[
          `Error: ${error.message || 'unknown dashboard error'}`,
          error.digest ? `Digest: ${error.digest}` : 'Digest: unavailable',
        ]}
        title="Unable to render this workspace slice"
        tone="error"
      />
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => {
            reset()
          }}
          type="button"
        >
          Retry
        </Button>
        <a
          className="inline-flex h-11 items-center justify-center rounded-full border border-border/80 bg-background/85 px-5 text-sm font-medium text-foreground transition-colors hover:bg-card/80"
          href="/"
        >
          Return home
        </a>
      </div>
    </div>
  )
}
