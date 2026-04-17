import { Card, CardContent } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

interface DataSurfaceMetric {
  detail: string
  label: string
  value: string
}

interface DataSurfaceFact {
  label: string
  value: string
}

interface DataSurfacePageProps {
  assistantHandoff?: ReactNode
  children: ReactNode
  description: string
  eyebrow: string
  facts: readonly DataSurfaceFact[]
  metrics: readonly DataSurfaceMetric[]
  title: string
}

/**
 * 为管理台列表页提供统一版式，保持 system、monitor 和 AI 模块使用同一套信息密度与层级语言。
 */
export function DataSurfacePage({
  assistantHandoff,
  children,
  description,
  eyebrow,
  facts,
  metrics,
  title,
}: DataSurfacePageProps): ReactNode {
  return (
    <article className="grid gap-5">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid max-w-3xl gap-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
          </div>

          <div className="flex min-w-[15rem] flex-wrap gap-2">
            {facts.map((fact) => (
              <div
                className="min-w-[10rem] rounded-[var(--radius-lg)] border border-border/75 bg-card/90 px-4 py-3 shadow-[var(--shadow-soft)]"
                key={fact.label}
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {fact.label}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">{fact.value}</p>
              </div>
            ))}
          </div>
        </div>

        {assistantHandoff}

        <div className="grid gap-3 md:grid-cols-3">
          {metrics.map((metric) => (
            <div
              className="rounded-[var(--radius-lg)] border border-border/75 bg-card/92 px-4 py-4 shadow-[var(--shadow-soft)]"
              key={metric.label}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {metric.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {metric.value}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{metric.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <Card className="border-border/80 bg-card/94 shadow-[var(--shadow-soft)]">
        <CardContent className="grid gap-6 p-6">{children}</CardContent>
      </Card>
    </article>
  )
}
