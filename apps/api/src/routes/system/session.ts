import { withOpenApiSchemaDoc } from '@ai-native-os/shared'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'

import { protectedProcedure } from '@/orpc/procedures'

const sessionResponseSchema = withOpenApiSchemaDoc(
  z.object({
    authenticated: withOpenApiSchemaDoc(z.literal(true), {
      title: 'SessionAuthenticated',
      description: '当前请求已通过认证，固定为 `true`。',
      examples: [true],
    }),
    user: withOpenApiSchemaDoc(
      z.object({
        email: withOpenApiSchemaDoc(z.string().email(), {
          title: 'SessionUserEmail',
          description: '当前 Better Auth 用户邮箱。',
          examples: ['super_admin@ai-native-os.local'],
        }),
        emailVerified: withOpenApiSchemaDoc(z.boolean(), {
          title: 'SessionUserEmailVerified',
          description: '当前用户邮箱是否已验证。',
          examples: [true],
        }),
        id: withOpenApiSchemaDoc(z.string(), {
          title: 'SessionUserId',
          description: '当前 Better Auth 用户 ID。',
          examples: ['auth_user_01'],
        }),
        name: withOpenApiSchemaDoc(z.string(), {
          title: 'SessionUserName',
          description: '当前 Better Auth 用户显示名。',
          examples: ['super_admin'],
        }),
      }),
      {
        title: 'SessionUser',
        description: '当前会话绑定的 Better Auth 用户信息。',
      },
    ),
  }),
  {
    title: 'SessionResponse',
    description: '当前认证会话响应。',
    examples: [
      {
        authenticated: true,
        user: {
          email: 'super_admin@ai-native-os.local',
          emailVerified: true,
          id: 'auth_user_01',
          name: 'super_admin',
        },
      },
    ],
  },
)

export const sessionProcedure = protectedProcedure
  .route({
    method: 'GET',
    path: '/api/v1/system/session',
    tags: ['System:Session'],
    summary: '读取当前认证会话',
    description: '返回当前请求绑定的 Better Auth 会话信息。',
  })
  .output(sessionResponseSchema)
  .handler(({ context }) => {
    const authSession = context.session

    if (!authSession) {
      throw new ORPCError('UNAUTHORIZED')
    }

    return {
      authenticated: true,
      user: {
        email: authSession.user.email,
        emailVerified: authSession.user.emailVerified,
        id: authSession.user.id,
        name: authSession.user.name,
      },
    }
  })
