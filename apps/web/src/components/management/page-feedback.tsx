import { Badge, Card, CardContent, cn } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

interface AssistantHandoffCardProps {
  badge: string
  description: string
  note?: string | undefined
  prompts: readonly string[]
  title: string
}

interface PageFeedbackBannerProps {
  kind: 'error' | 'success'
  message: string
}

interface SurfaceStatePanelProps {
  actionHref?: string | undefined
  actionLabel?: string | undefined
  description: string
  eyebrow: string
  hints?: readonly string[] | undefined
  title: string
  tone: 'error' | 'loading' | 'neutral'
}

/**
 * 统一渲染管理台里的成功与失败提示，并补齐可访问的状态播报语义。
 */
export function PageFeedbackBanner({ kind, message }: PageFeedbackBannerProps): ReactNode {
  return (
    <div
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'rounded-[var(--radius-md)] border px-4 py-3 text-sm',
        kind === 'error'
          ? 'border-destructive/25 bg-destructive/10 text-destructive'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700',
      )}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {message}
    </div>
  )
}

/**
 * 为空态、加载态和错误态提供统一的控制台式展示壳层，避免剩余页面继续各自实现一套反馈语言。
 */
export function SurfaceStatePanel({
  actionHref,
  actionLabel,
  description,
  eyebrow,
  hints,
  title,
  tone,
}: SurfaceStatePanelProps): ReactNode {
  return (
    <Card
      className={cn(
        'border-border/80 bg-card/94 shadow-[var(--shadow-soft)]',
        tone === 'error' && 'border-destructive/20 bg-destructive/5',
      )}
    >
      <CardContent className="grid gap-5 p-6">
        <div
          aria-live={tone === 'error' ? 'assertive' : 'polite'}
          className="grid gap-2"
          role={tone === 'error' ? 'alert' : 'status'}
        >
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
        </div>

        {hints && hints.length > 0 ? (
          <ul className="grid gap-2 text-sm leading-6 text-muted-foreground">
            {hints.map((hint) => (
              <li
                className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 px-4 py-3"
                key={hint}
              >
                {hint}
              </li>
            ))}
          </ul>
        ) : null}

        {tone === 'loading' ? (
          <div aria-hidden="true" className="grid gap-3">
            <div className="h-10 animate-pulse rounded-[var(--radius-lg)] bg-foreground/8" />
            <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-foreground/6" />
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="h-28 animate-pulse rounded-[var(--radius-lg)] bg-foreground/6" />
              <div className="h-28 animate-pulse rounded-[var(--radius-lg)] bg-foreground/6" />
              <div className="h-28 animate-pulse rounded-[var(--radius-lg)] bg-foreground/6" />
            </div>
          </div>
        ) : null}

        {actionHref && actionLabel ? (
          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex h-11 items-center justify-center rounded-full border border-border/80 bg-background/85 px-5 text-sm font-medium text-foreground transition-colors hover:bg-card/80"
              href={actionHref}
            >
              {actionLabel}
            </a>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * 在页面主工作区中提供清晰的助手移交卡片，让操作员知道当前页最值得交给 Copilot 的问题是什么。
 */
export function AssistantHandoffCard({
  badge,
  description,
  note,
  prompts,
  title,
}: AssistantHandoffCardProps): ReactNode {
  return (
    <div className="rounded-[var(--radius-xl)] border border-border/75 bg-card/92 px-4 py-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <Badge variant="secondary">{badge}</Badge>
          <div className="grid gap-1">
            <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {prompts.map((prompt) => (
          <div
            className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 px-4 py-3 text-sm leading-6 text-foreground"
            key={prompt}
          >
            {prompt}
          </div>
        ))}
      </div>

      {note ? <p className="mt-4 text-xs leading-5 text-muted-foreground">{note}</p> : null}
    </div>
  )
}
