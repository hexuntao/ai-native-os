'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import type { GenerativeChartDatum } from '@/lib/generative'

interface GenerativeBarChartProps {
  data: readonly GenerativeChartDatum[]
  emptyMessage: string
  title: string
}

/**
 * 用轻量条形图承载生成式摘要中的分布信息，避免为了 Phase 4 引入新的图表依赖。
 */
export function GenerativeBarChart({
  data,
  emptyMessage,
  title,
}: GenerativeBarChartProps): ReactNode {
  const maxValue = Math.max(...data.map((entry) => entry.value), 1)

  return (
    <Card className="border-border/70 bg-background/80 shadow-[var(--shadow-soft)]">
      <CardHeader className="gap-1 pb-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Generative chart
        </p>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {data.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">{emptyMessage}</p>
        ) : (
          data.map((entry) => (
            <div className="grid gap-2" key={entry.label}>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-foreground">{entry.label}</span>
                <span className="text-muted-foreground">{entry.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary/65">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max((entry.value / maxValue) * 100, 10)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
