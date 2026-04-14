import { Card, CardContent } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import {
  WorkbenchSignalCard,
  type WorkbenchSignalCardProps,
} from '@/components/management/workbench-signal-card'

interface WorkbenchContextFact {
  label: string
  value: string
}

interface StatusWorkbenchPageProps {
  children: ReactNode
  context: readonly WorkbenchContextFact[]
  description: string
  eyebrow: string
  signals: readonly WorkbenchSignalCardProps[]
  statusStrip?: ReactNode
  title: string
}

/**
 * 为状态优先的控制台页面提供统一壳层，突出上下文、运行信号与主工作区三段结构。
 */
export function StatusWorkbenchPage({
  children,
  context,
  description,
  eyebrow,
  signals,
  statusStrip,
  title,
}: StatusWorkbenchPageProps): ReactNode {
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
            {context.map((fact) => (
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

        {statusStrip ? (
          <Card className="border-border/80 bg-card/94 shadow-[var(--shadow-soft)]">
            <CardContent className="p-5">{statusStrip}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-4">
          {signals.map((signal) => (
            <WorkbenchSignalCard key={signal.label} {...signal} />
          ))}
        </div>
      </div>

      <Card className="border-border/80 bg-card/94 shadow-[var(--shadow-soft)]">
        <CardContent className="grid gap-6 p-6">{children}</CardContent>
      </Card>
    </article>
  )
}
