'use client'

import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@ai-native-os/ui'
import type { ReactNode } from 'react'

interface ManagementDialogProps {
  children: ReactNode
  contentClassName?: string
  description: string
  title: string
  triggerAriaLabel?: string
  triggerLabel: string
  triggerSize?: 'default' | 'lg' | 'sm'
  triggerVariant?: 'default' | 'ghost' | 'secondary'
}

/**
 * 为目录型页面统一提供弹层式创建/编辑容器，避免表单继续挤占列表首屏。
 */
export function ManagementDialog({
  children,
  contentClassName,
  description,
  title,
  triggerAriaLabel,
  triggerLabel,
  triggerSize = 'default',
  triggerVariant = 'default',
}: ManagementDialogProps): ReactNode {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          aria-haspopup="dialog"
          aria-label={triggerAriaLabel ?? triggerLabel}
          size={triggerSize}
          type="button"
          variant={triggerVariant}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className={cn('max-h-[85vh] overflow-y-auto', contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
