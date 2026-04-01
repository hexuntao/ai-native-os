import { permissionRuleListSchema } from '@ai-native-os/shared'
import { RequestContext } from '@mastra/core/request-context'
import { z } from 'zod'

export const mastraToolRequestContextSchema = z.object({
  authUserId: z.string(),
  permissionRules: permissionRuleListSchema,
  rbacUserId: z.string().uuid().nullable(),
  requestId: z.string(),
  roleCodes: z.array(z.string()),
  userEmail: z.string().email().nullable(),
})

export type MastraToolRequestContextValues = z.infer<typeof mastraToolRequestContextSchema>

export interface MastraAppContextSource {
  permissionRules: MastraToolRequestContextValues['permissionRules']
  rbacUserId: MastraToolRequestContextValues['rbacUserId']
  requestId: MastraToolRequestContextValues['requestId']
  roleCodes: MastraToolRequestContextValues['roleCodes']
  session: {
    user: {
      email?: string | null
    }
  } | null
  userId: string | null
}

export function createMastraRequestContext(
  values: MastraToolRequestContextValues,
): RequestContext<MastraToolRequestContextValues> {
  const requestContext = new RequestContext<MastraToolRequestContextValues>()

  requestContext.set('authUserId', values.authUserId)
  requestContext.set('permissionRules', values.permissionRules)
  requestContext.set('rbacUserId', values.rbacUserId)
  requestContext.set('requestId', values.requestId)
  requestContext.set('roleCodes', values.roleCodes)
  requestContext.set('userEmail', values.userEmail)

  return requestContext
}

export function createMastraRequestContextFromAppContext(
  context: MastraAppContextSource,
): RequestContext<MastraToolRequestContextValues> {
  if (!context.userId) {
    throw new Error('Authenticated app context is required to build Mastra request context')
  }

  return createMastraRequestContext({
    authUserId: context.userId,
    permissionRules: context.permissionRules,
    rbacUserId: context.rbacUserId,
    requestId: context.requestId,
    roleCodes: context.roleCodes,
    userEmail: context.session?.user.email ?? null,
  })
}

export function readMastraRequestContext(
  requestContext: { all?: unknown } | undefined,
): MastraToolRequestContextValues {
  return mastraToolRequestContextSchema.parse(requestContext?.all ?? {})
}
