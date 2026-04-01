import { writeAiAuditLog } from '@ai-native-os/db'
import {
  type AppAbility,
  type AppActions,
  type AppSubjects,
  defineAbilityFor,
  type PermissionRule,
} from '@ai-native-os/shared'
import { createTool, type Tool, type ToolExecutionContext } from '@mastra/core/tools'
import type { z } from 'zod'

import {
  type MastraToolRequestContextValues,
  mastraToolRequestContextSchema,
  readMastraRequestContext,
} from '../request-context'

export class MastraToolPermissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MastraToolPermissionError'
  }
}

export interface MastraToolPermission {
  action: AppActions
  subject: AppSubjects
}

export interface ProtectedMastraToolRunContext {
  ability: AppAbility
  requestContext: MastraToolRequestContextValues
  toolContext: ToolExecutionContext<unknown, unknown, MastraToolRequestContextValues>
}

export interface RegisteredMastraTool {
  description: string
  id: string
  inputSchema: z.ZodType<unknown>
  outputSchema: z.ZodType<unknown>
  permission: MastraToolPermission
  tool: Tool<
    unknown,
    unknown,
    unknown,
    unknown,
    ToolExecutionContext<unknown, unknown, unknown>,
    string,
    unknown
  >
}

export function defineProtectedMastraTool(config: {
  description: string
  execute: (input: unknown, context: ProtectedMastraToolRunContext) => Promise<unknown>
  id: string
  inputSchema: z.ZodType<unknown>
  outputSchema: z.ZodType<unknown>
  permission: MastraToolPermission
  requireApproval?: boolean
}): RegisteredMastraTool {
  const tool = createTool({
    description: config.description,
    execute: async (input, toolContext) => {
      const requestContext = readMastraRequestContext(toolContext.requestContext)
      const ability = defineAbilityFor(requestContext.permissionRules as PermissionRule[])
      const permissionLabel = `${config.permission.action}:${config.permission.subject}`

      if (!ability.can(config.permission.action, config.permission.subject)) {
        const error = new MastraToolPermissionError(`Missing permission ${permissionLabel}`)

        await writeAiAuditLog({
          action: config.permission.action,
          actorAuthUserId: requestContext.authUserId,
          actorRbacUserId: requestContext.rbacUserId,
          errorMessage: error.message,
          input,
          requestInfo: {
            requestId: requestContext.requestId,
            userEmail: requestContext.userEmail ?? 'unknown',
          },
          roleCodes: requestContext.roleCodes,
          status: 'forbidden',
          subject: config.permission.subject,
          toolId: config.id,
        })

        throw error
      }

      try {
        const result = await config.execute(input, {
          ability,
          requestContext,
          toolContext,
        })

        await writeAiAuditLog({
          action: config.permission.action,
          actorAuthUserId: requestContext.authUserId,
          actorRbacUserId: requestContext.rbacUserId,
          input,
          output: result,
          requestInfo: {
            requestId: requestContext.requestId,
            userEmail: requestContext.userEmail ?? 'unknown',
          },
          roleCodes: requestContext.roleCodes,
          status: 'success',
          subject: config.permission.subject,
          toolId: config.id,
        })

        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        await writeAiAuditLog({
          action: config.permission.action,
          actorAuthUserId: requestContext.authUserId,
          actorRbacUserId: requestContext.rbacUserId,
          errorMessage,
          input,
          requestInfo: {
            requestId: requestContext.requestId,
            userEmail: requestContext.userEmail ?? 'unknown',
          },
          roleCodes: requestContext.roleCodes,
          status: 'error',
          subject: config.permission.subject,
          toolId: config.id,
        })

        throw error
      }
    },
    id: config.id,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    requestContextSchema: mastraToolRequestContextSchema,
    requireApproval: config.requireApproval ?? false,
  })

  return {
    description: config.description,
    id: config.id,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    permission: config.permission,
    tool: tool as RegisteredMastraTool['tool'],
  }
}
