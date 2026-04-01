import { cn } from '@ai-native-os/ui'
import type { ReactNode, SelectHTMLAttributes } from 'react'

interface FilterSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode
}

/**
 * 为管理台筛选器提供统一的原生下拉样式，避免页面层重复拼接 className。
 */
export function FilterSelect({ children, className, ...props }: FilterSelectProps): ReactNode {
  return (
    <select
      className={cn(
        'flex h-11 w-full rounded-[var(--radius-md)] border border-border/80 bg-background/70 px-4 py-2 text-sm text-foreground shadow-[var(--shadow-soft)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
