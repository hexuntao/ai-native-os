import * as React from 'react'

import { cn } from '../lib/cn'

/**
 * 统一管理页面中的信息承载容器，确保面板边框、阴影和内边距一致。
 */
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      className={cn(
        'rounded-[var(--radius-xl)] border border-border/80 bg-card/90 shadow-[var(--shadow-panel)] backdrop-blur-sm',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)

Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div className={cn('flex flex-col gap-2 p-6', className)} ref={ref} {...props} />
  ),
)

CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    className={cn('text-2xl font-semibold tracking-tight text-foreground', className)}
    ref={ref}
    {...props}
  />
))

CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p className={cn('text-sm leading-6 text-muted-foreground', className)} ref={ref} {...props} />
))

CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div className={cn('p-6 pt-0', className)} ref={ref} {...props} />
  ),
)

CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div className={cn('flex items-center gap-3 p-6 pt-0', className)} ref={ref} {...props} />
  ),
)

CardFooter.displayName = 'CardFooter'
