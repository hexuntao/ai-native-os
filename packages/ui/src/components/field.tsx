import type * as React from 'react'

import { cn } from '../lib/cn'

/**
 * 为表单元素提供统一的标签、提示和错误布局。
 */
export function Field({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactNode {
  return (
    <div className={cn('grid gap-2.5', className)} {...props}>
      {children}
    </div>
  )
}

export function FieldLabel({
  children,
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>): React.ReactNode {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: 这是共享表单原语，具体表单会在调用处提供 htmlFor。
    <label
      className={cn(
        'text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </label>
  )
}

export function FieldHint({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.ReactNode {
  return (
    <p className={cn('text-sm leading-6 text-muted-foreground', className)} {...props}>
      {children}
    </p>
  )
}

export function FieldError({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.ReactNode {
  return (
    <p
      className={cn(
        'rounded-[var(--radius-md)] border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary',
        className,
      )}
      {...props}
    >
      {children}
    </p>
  )
}
