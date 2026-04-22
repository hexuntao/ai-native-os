'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ManagementDialogProps {
  children: ReactNode
  contentClassName?: string
  description: string
  title: string
  triggerAriaLabel?: string
  triggerId?: string
  triggerLabel: string
  triggerSize?: 'default' | 'lg' | 'sm'
  triggerVariant?: 'default' | 'ghost' | 'outline' | 'secondary'
}

export function ManagementDialog({
  children,
  contentClassName,
  description,
  title,
  triggerAriaLabel,
  triggerId,
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
          data-management-primary-action={triggerId ? 'true' : undefined}
          id={triggerId}
          size={triggerSize}
          type="button"
          variant={triggerVariant}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className={cn('max-h-[85vh] overflow-y-auto sm:max-w-2xl', contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
