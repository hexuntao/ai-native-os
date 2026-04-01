import { z } from 'zod'

export const copilotBridgeSummarySchema = z.object({
  agentIds: z.array(z.string()),
  authRequired: z.literal(true),
  defaultAgentId: z.string(),
  endpoint: z.string(),
  protocol: z.literal('ag-ui'),
  resourceId: z.string(),
  runtimePath: z.string(),
  transport: z.literal('streaming-http'),
})

export const copilotSessionContextEventSchema = z.object({
  requestId: z.string(),
  roleCodes: z.array(z.string()),
  userId: z.string(),
})

export type CopilotBridgeSummary = z.infer<typeof copilotBridgeSummarySchema>
export type CopilotSessionContextEvent = z.infer<typeof copilotSessionContextEventSchema>
