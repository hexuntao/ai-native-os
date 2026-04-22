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
  label: '已接受',
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
    label: '已拒绝',
    value: 'rejected',
  },
  {
    accepted: false,
    description: '对 AI 建议进行了人工编辑或修正。',
    label: '已编辑',
    value: 'edited',
  },
  {
    accepted: false,
    description: '人工完全覆盖了 AI 建议或决定。',
    label: '已覆盖',
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
      setErrorMessage('编辑或覆盖类反馈必须填写人工修正内容。')
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

        throw new Error(payload?.message ?? '提交 AI 反馈失败。')
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
          {latestUserAction ?? '无反馈'}
        </Badge>
        <Badge variant={humanOverride ? 'outline' : 'secondary'}>
          {humanOverride ? '已记录接管' : '无接管'}
        </Badge>
        <Badge variant="secondary">{feedbackCount} 条反馈</Badge>
      </div>

      <Dialog onOpenChange={setOpen} open={open}>
        <Button size="sm" type="button" variant="secondary" onClick={() => setOpen(true)}>
          记录反馈
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>记录 AI 反馈</DialogTitle>
            <DialogDescription>
              将操作员反馈附加到工具 <code>{toolId}</code> 的审计日志 <code>{auditLogId}</code>。
            </DialogDescription>
          </DialogHeader>

          <form aria-label="AI 反馈表单" className="grid gap-4" onSubmit={handleSubmit}>
            <Field>
              <FieldLabel htmlFor={`feedback-action-${auditLogId}`}>用户动作</FieldLabel>
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
              <FieldLabel htmlFor={`feedback-correction-${auditLogId}`}>修正内容</FieldLabel>
              <Input
                disabled={!requiresCorrection}
                id={`feedback-correction-${auditLogId}`}
                placeholder="描述人工修正后的输出"
                required={requiresCorrection}
                value={correction}
                onChange={(event) => setCorrection(event.currentTarget.value)}
              />
              <FieldDescription>
                {requiresCorrection
                  ? '当前动作必须填写明确的修正结果。'
                  : '当 AI 响应被接受或仅被拒绝时，这一项可以留空。'}
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor={`feedback-note-${auditLogId}`}>反馈备注</FieldLabel>
              <Textarea
                id={`feedback-note-${auditLogId}`}
                placeholder="说明操作员为什么接受、拒绝或覆盖 AI 建议"
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
                取消
              </Button>
              <Button isLoading={submitting} type="submit">
                保存反馈
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
