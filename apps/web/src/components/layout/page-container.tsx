import { cn } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps): ReactNode {
  return <section className={cn('min-w-0 xl:pr-2', className)}>{children}</section>
}
