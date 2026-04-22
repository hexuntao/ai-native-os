'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

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
  triggerVariant?: 'default' | 'ghost' | 'outline' | 'secondary'
}

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {consequences ? (
          <p className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border px-4 py-3 text-sm leading-6">
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
            <Button type="submit" variant="destructive">
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
