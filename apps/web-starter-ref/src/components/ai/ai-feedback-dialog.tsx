'use client'

import type { AiFeedbackUserAction } from '@ai-native-os/shared'
import { useRouter } from 'next/navigation'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

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
]

function resolveFeedbackActionOption(action: AiFeedbackUserAction) {
  return (
    feedbackActionOptions.find((option) => option.value === action) ?? acceptedFeedbackActionOption
  )
}

function resolveActionBadgeVariant(
  action: AiFeedbackUserAction | null,
): 'default' | 'outline' | 'secondary' {
  if (action === 'accepted') {
    return 'default'
  }

  if (action === 'edited' || action === 'overridden') {
    return 'outline'
  }

  return 'secondary'
}

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
        const payload = (await response.json().catch(() => null)) as { message?: string } | null

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

          <form aria-label="AI feedback form" className="grid gap-4" onSubmit={handleSubmit}>
            <Field>
              <FieldLabel htmlFor={`feedback-action-${auditLogId}`}>User action</FieldLabel>
              <select
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none"
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
              <FieldDescription>{selectedAction.description}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor={`feedback-correction-${auditLogId}`}>Correction</FieldLabel>
              <Input
                disabled={!requiresCorrection}
                id={`feedback-correction-${auditLogId}`}
                placeholder="Describe the human-corrected output"
                required={requiresCorrection}
                value={correction}
                onChange={(event) => setCorrection(event.currentTarget.value)}
              />
              <FieldDescription>
                {requiresCorrection
                  ? 'This action requires a concrete correction.'
                  : 'Optional when the AI response was accepted or simply rejected.'}
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor={`feedback-note-${auditLogId}`}>Feedback note</FieldLabel>
              <Textarea
                id={`feedback-note-${auditLogId}`}
                placeholder="Explain why the operator accepted, rejected, or overrode the AI suggestion"
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.currentTarget.value)}
              />
            </Field>

            {errorMessage ? (
              <FieldError aria-live="assertive" role="alert">
                {errorMessage}
              </FieldError>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button isLoading={submitting} type="submit">
                Save feedback
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
