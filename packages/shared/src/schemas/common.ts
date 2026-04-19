import { z } from 'zod'

import { ErrorCodes } from '../constants/error-codes'

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
})

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int(),
      pageSize: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  })

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export const apiErrorResponseSchema = z.object({
  code: z.string(),
  errorCode: z.number().int(),
  message: z.string(),
  requestId: z.string().optional(),
  status: z.number().int(),
})

export const validationIssuesSchema = z.object({
  fieldErrors: z.record(z.string(), z.array(z.string())),
  formErrors: z.array(z.string()),
})

export const validationErrorResponseSchema = apiErrorResponseSchema.extend({
  code: z.literal('BAD_REQUEST'),
  errorCode: z.literal(ErrorCodes.BAD_REQUEST.code),
  issues: validationIssuesSchema,
})

export const rateLimitErrorResponseSchema = apiErrorResponseSchema.extend({
  code: z.literal('RATE_LIMITED'),
  errorCode: z.literal(ErrorCodes.RATE_LIMITED.code),
  retryAfterSeconds: z.number().int().min(1),
})
