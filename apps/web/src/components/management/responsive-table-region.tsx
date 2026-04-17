import { cn } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

interface ResponsiveTableRegionProps {
  children: ReactNode
  className?: string
  hint?: string | undefined
  label: string
  minWidthClassName?: string | undefined
}

/**
 * 为密集表格提供统一的横向滚动容器、键盘可达性和窄屏提示，避免移动端只能看到被截断的数据列。
 */
export function ResponsiveTableRegion({
  children,
  className,
  hint = '表格在窄屏下支持横向滚动；聚焦后可使用触控板或 Shift + 鼠标滚轮查看隐藏列。',
  label,
  minWidthClassName,
}: ResponsiveTableRegionProps): ReactNode {
  return (
    <section aria-label={label} className="grid gap-2">
      <p className="text-xs leading-5 text-muted-foreground md:hidden">{hint}</p>
      <div className={cn('overflow-x-auto', className)}>
        <div className={cn('min-w-[48rem]', minWidthClassName)}>{children}</div>
      </div>
    </section>
  )
}
