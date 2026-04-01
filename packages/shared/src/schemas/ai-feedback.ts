import { z } from 'zod'

export const aiFeedbackUserActionSchema = z.enum(['accepted', 'edited', 'overridden', 'rejected'])

export const createAiFeedbackInputSchema = z
  .object({
    accepted: z.boolean(),
    auditLogId: z.string().uuid(),
    correction: z.string().trim().max(2_000).optional(),
    feedbackText: z.string().trim().max(2_000).optional(),
    userAction: aiFeedbackUserActionSchema,
  })
  .superRefine((value, context) => {
    const normalizedCorrection = value.correction?.trim()

    if (value.userAction === 'accepted' && !value.accepted) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'accepted feedback must set accepted=true',
        path: ['accepted'],
      })
    }

    if (value.userAction !== 'accepted' && value.accepted) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'non-accepted feedback must set accepted=false',
        path: ['accepted'],
      })
    }

    if (
      (value.userAction === 'edited' || value.userAction === 'overridden') &&
      !normalizedCorrection
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'edited or overridden feedback requires a correction',
        path: ['correction'],
      })
    }
  })

export const aiFeedbackEntrySchema = z.object({
  accepted: z.boolean(),
  actorAuthUserId: z.string(),
  actorRbacUserId: z.string().uuid().nullable(),
  auditLogId: z.string().uuid(),
  correction: z.string().nullable(),
  createdAt: z.string(),
  feedbackText: z.string().nullable(),
  id: z.string().uuid(),
  userAction: aiFeedbackUserActionSchema,
})

export const aiFeedbackSummarySchema = z.object({
  accepted: z.number().int().min(0),
  edited: z.number().int().min(0),
  humanOverrideCount: z.number().int().min(0),
  overridden: z.number().int().min(0),
  rejected: z.number().int().min(0),
})

export type AiFeedbackUserAction = z.infer<typeof aiFeedbackUserActionSchema>
export type AiFeedbackCreateInput = z.infer<typeof createAiFeedbackInputSchema>
export type AiFeedbackEntry = z.infer<typeof aiFeedbackEntrySchema>
