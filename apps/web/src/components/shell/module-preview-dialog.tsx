'use client'

import { Button } from '@ai-native-os/ui'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@ai-native-os/ui/client'
import type { ReactNode } from 'react'

interface ModulePreviewDialogProps {
  milestones: readonly string[]
  summary: string
  title: string
}

/**
 * 用最小交互弹层解释模块当前范围，验证共享 Dialog 原语已接入到 web 端。
 */
export function ModulePreviewDialog({
  milestones,
  summary,
  title,
}: ModulePreviewDialogProps): ReactNode {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Scope Preview
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Upcoming milestones
          </p>
          <ul className="grid gap-2 text-sm leading-6 text-foreground">
            {milestones.map((milestone) => (
              <li
                className="rounded-[var(--radius-md)] border border-border/70 bg-background/60 px-3 py-2"
                key={milestone}
              >
                {milestone}
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
