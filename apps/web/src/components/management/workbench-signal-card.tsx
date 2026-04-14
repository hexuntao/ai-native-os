import { Badge, Card, CardContent, CardHeader, CardTitle, cn } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

export type WorkbenchSignalTone = 'critical' | 'neutral' | 'positive' | 'warning'

export interface WorkbenchSignalCardProps {
  badge?: string
  detail: string
  label: string
  tone?: WorkbenchSignalTone
  value: string
}

/**
 * 根据工作台信号的严重程度返回对应的视觉强调类名。
 */
function resolveSignalToneClassName(tone: WorkbenchSignalTone): string {
  switch (tone) {
    case 'positive':
      return 'border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.9))]'
    case 'warning':
      return 'border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.9))]'
    case 'critical':
      return 'border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,255,255,0.9))]'
    default:
      return 'border-border/80 bg-card/94'
  }
}

/**
 * 以高密度信号卡片呈现关键状态、计数和治理摘要，供控制台类页面复用。
 */
export function WorkbenchSignalCard({
  badge,
  detail,
  label,
  tone = 'neutral',
  value,
}: WorkbenchSignalCardProps): ReactNode {
  return (
    <Card className={cn('shadow-[var(--shadow-soft)]', resolveSignalToneClassName(tone))}>
      <CardHeader className="gap-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
        </div>
        <CardTitle className="text-3xl tracking-tight text-foreground">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}
