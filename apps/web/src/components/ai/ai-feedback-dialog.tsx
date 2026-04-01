'use client'

import type { AiFeedbackUserAction } from '@ai-native-os/shared'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldHint,
  FieldLabel,
  Input,
} from '@ai-native-os/ui'
import { useRouter } from 'next/navigation'
import { type FormEvent, type ReactNode, useState } from 'react'

interface AiFeedbackDialogProps {
  auditLogId: string
  feedbackCount: number
  humanOverride: boolean
  latestUserAction: AiFeedbackUserAction | null
  toolId: string
}

const acceptedFeedbackActionOption = {
  accepted: true,
  description: '确认当前 AI 建议已被采纳，无需人工修正。',
  label: 'Accepted',
  value: 'accepted',
} as const satisfies {
  accepted: boolean
  description: string
  label: string
  value: AiFeedbackUserAction
}

const feedbackActionOptions: ReadonlyArray<{
  accepted: boolean
  description: string
  label: string
  value: AiFeedbackUserAction
}> = [
  acceptedFeedbackActionOption,
  {
    accepted: false,
    description: '拒绝当前 AI 建议，但没有替换文本。',
    label: 'Rejected',
    value: 'rejected',
  },
  {
    accepted: false,
    description: '对 AI 建议进行了人工编辑或修正。',
    label: 'Edited',
    value: 'edited',
  },
  {
    accepted: false,
    description: '人工完全覆盖了 AI 建议或决定。',
    label: 'Overridden',
    value: 'overridden',
  },
] as const

/**
 * 根据当前表单动作解析稳定的反馈选项，避免空数组推断导致的联合类型漂移。
 */
function resolveFeedbackActionOption(action: AiFeedbackUserAction) {
  return (
    feedbackActionOptions.find((option) => option.value === action) ?? acceptedFeedbackActionOption
  )
}

function resolveActionBadgeVariant(
  action: AiFeedbackUserAction | null,
): 'accent' | 'outline' | 'secondary' {
  if (action === 'accepted') {
    return 'accent'
  }

  if (action === 'edited' || action === 'overridden') {
    return 'outline'
  }

  return 'secondary'
}

/**
 * 在 AI 审计页为单条审计记录提供人工反馈与 override 录入入口。
 */
export function AiFeedbackDialog({
  auditLogId,
  feedbackCount,
  humanOverride,
  latestUserAction,
  toolId,
}: AiFeedbackDialogProps): ReactNode {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [userAction, setUserAction] = useState<AiFeedbackUserAction>('accepted')
  const [correction, setCorrection] = useState('')
  const [feedbackText, setFeedbackText] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const selectedAction = resolveFeedbackActionOption(userAction)

  const requiresCorrection = userAction === 'edited' || userAction === 'overridden'

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    if (requiresCorrection && correction.trim().length === 0) {
      setErrorMessage('Edited 或 overridden 反馈必须填写人工修正内容。')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/ai/feedback', {
        body: JSON.stringify({
          accepted: selectedAction.accepted,
          auditLogId,
          correction: correction.trim() || undefined,
          feedbackText: feedbackText.trim() || undefined,
          userAction,
        }),
        headers: {
          'content-type': 'application/json',
        },
        method: 'POST',
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string
        } | null

        throw new Error(payload?.message ?? 'Failed to submit AI feedback.')
      }

      setOpen(false)
      setCorrection('')
      setFeedbackText('')
      setUserAction('accepted')
      router.refresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <Badge variant={resolveActionBadgeVariant(latestUserAction)}>
          {latestUserAction ?? 'no feedback'}
        </Badge>
        <Badge variant={humanOverride ? 'outline' : 'secondary'}>
          {humanOverride ? 'override recorded' : 'no override'}
        </Badge>
        <Badge variant="secondary">{feedbackCount} feedback</Badge>
      </div>

      <Dialog onOpenChange={setOpen} open={open}>
        <Button size="sm" type="button" variant="secondary" onClick={() => setOpen(true)}>
          Record feedback
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record AI feedback</DialogTitle>
            <DialogDescription>
              Attach operator feedback to audit log <code>{auditLogId}</code> for tool{' '}
              <code>{toolId}</code>.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <Field>
              <FieldLabel htmlFor={`feedback-action-${auditLogId}`}>User action</FieldLabel>
              <select
                className="flex h-11 w-full rounded-[var(--radius-md)] border border-border/80 bg-background/70 px-4 py-2 text-sm text-foreground shadow-[var(--shadow-soft)] outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                id={`feedback-action-${auditLogId}`}
                value={userAction}
                onChange={(event) =>
                  setUserAction(event.currentTarget.value as AiFeedbackUserAction)
                }
              >
                {feedbackActionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldHint>{selectedAction.description}</FieldHint>
            </Field>

            <Field>
              <FieldLabel htmlFor={`feedback-correction-${auditLogId}`}>Correction</FieldLabel>
              <Input
                id={`feedback-correction-${auditLogId}`}
                placeholder="Describe the human-corrected output"
                value={correction}
                onChange={(event) => setCorrection(event.currentTarget.value)}
              />
              <FieldHint>
                {requiresCorrection
                  ? 'This action requires a concrete correction.'
                  : 'Optional when the AI response was accepted or simply rejected.'}
              </FieldHint>
            </Field>

            <Field>
              <FieldLabel htmlFor={`feedback-note-${auditLogId}`}>Feedback note</FieldLabel>
              <textarea
                className="min-h-28 w-full rounded-[var(--radius-md)] border border-border/80 bg-background/70 px-4 py-3 text-sm text-foreground shadow-[var(--shadow-soft)] outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                id={`feedback-note-${auditLogId}`}
                placeholder="Explain why the operator accepted, rejected, or overrode the AI suggestion"
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.currentTarget.value)}
              />
            </Field>

            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

            <DialogFooter>
              <Button disabled={submitting} type="submit">
                {submitting ? 'Saving…' : 'Save feedback'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
