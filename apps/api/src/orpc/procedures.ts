import { ORPCError, os } from '@orpc/server'

import type { AppContext } from './context'

const base = os.$context<AppContext>()

export const publicProcedure = base
export const protectedProcedure = base.use(({ context, next }) => {
  if (!context.session) {
    throw new ORPCError('UNAUTHORIZED')
  }

  return next({
    context: {
      ...context,
      userId: context.session.user.id,
    },
  })
})
