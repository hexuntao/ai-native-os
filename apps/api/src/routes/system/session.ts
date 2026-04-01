import { ORPCError } from '@orpc/server'
import { z } from 'zod'

import { protectedProcedure } from '@/orpc/procedures'

export const sessionProcedure = protectedProcedure
  .route({
    method: 'GET',
    path: '/api/v1/system/session',
    tags: ['System:Session'],
    summary: 'Get current authenticated session',
    description: 'Returns the current Better Auth session bound to the request cookie.',
  })
  .output(
    z.object({
      authenticated: z.literal(true),
      user: z.object({
        email: z.string().email(),
        emailVerified: z.boolean(),
        id: z.string(),
        name: z.string(),
      }),
    }),
  )
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
