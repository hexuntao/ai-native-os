'use client'

import {
  Button,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@ai-native-os/ui'
import type { ReactNode } from 'react'

interface HiddenField {
  name: string
  value: string
}

interface DestructiveActionDialogProps {
  action: (formData: FormData) => void | Promise<void>
  confirmLabel?: string
  consequences?: string
  description: string
  hiddenFields: readonly HiddenField[]
  title: string
  triggerLabel: string
  triggerSize?: 'default' | 'lg' | 'sm'
  triggerVariant?: 'default' | 'ghost' | 'secondary'
}

/**
 * 为删除等破坏性操作提供统一确认弹层，避免列表页直接触发表单提交。
 */
export function DestructiveActionDialog({
  action,
  confirmLabel = 'Confirm delete',
  consequences,
  description,
  hiddenFields,
  title,
  triggerLabel,
  triggerSize = 'sm',
  triggerVariant = 'ghost',
}: DestructiveActionDialogProps): ReactNode {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          aria-haspopup="dialog"
          aria-label={triggerLabel}
          size={triggerSize}
          type="button"
          variant={triggerVariant}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {consequences ? (
          <p className="rounded-[var(--radius-lg)] border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm leading-6 text-red-800">
            {consequences}
          </p>
        ) : null}

        <form action={action} className="grid gap-4">
          {hiddenFields.map((field) => (
            <input key={field.name} name={field.name} type="hidden" value={field.value} />
          ))}

          <DialogFooter className="gap-3 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button
              className={cn(
                'border border-red-200 bg-red-600 text-white hover:bg-red-500',
                'focus-visible:ring-red-400/70',
              )}
              type="submit"
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
