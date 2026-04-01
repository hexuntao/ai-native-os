import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ai-native-os/ui'
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
  children,
  description,
  eyebrow,
  facts,
  metrics,
  title,
}: DataSurfacePageProps): ReactNode {
  return (
    <article className="grid gap-6">
      <Card className="overflow-hidden border-border/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,245,249,0.88))]">
        <CardHeader className="gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid max-w-3xl gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
              <CardTitle className="text-4xl leading-none text-balance md:text-5xl">
                {title}
              </CardTitle>
              <CardDescription className="text-base leading-7 text-muted-foreground">
                {description}
              </CardDescription>
            </div>

            <div className="grid min-w-[15rem] gap-3 rounded-[var(--radius-xl)] border border-border/70 bg-background/80 p-4 shadow-[var(--shadow-soft)]">
              {facts.map((fact) => (
                <div className="grid gap-1" key={fact.label}>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {fact.label}
                  </p>
                  <p className="text-sm font-medium text-foreground">{fact.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {metrics.map((metric) => (
              <div
                className="rounded-[var(--radius-xl)] border border-border/70 bg-background/85 p-4 shadow-[var(--shadow-soft)]"
                key={metric.label}
              >
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-3 text-3xl font-semibold text-foreground">{metric.value}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{metric.detail}</p>
              </div>
            ))}
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/80 bg-card/90">
        <CardContent className="grid gap-6 p-6">{children}</CardContent>
      </Card>
    </article>
  )
}
