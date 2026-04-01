import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../lib/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    defaultVariants: {
      variant: 'secondary',
    },
    variants: {
      variant: {
        accent: 'border-primary/20 bg-primary/10 text-primary',
        outline: 'border-border/80 bg-transparent text-foreground',
        secondary: 'border-border/70 bg-card text-muted-foreground',
      },
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * 用于呈现角色、状态或范围标签等低信息密度元素。
 */
export function Badge({ className, variant, ...props }: BadgeProps): React.ReactNode {
  return <span className={cn(badgeVariants({ className, variant }))} {...props} />
}
