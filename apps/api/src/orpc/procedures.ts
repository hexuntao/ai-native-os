import type { AppActions, AppSubjects } from '@ai-native-os/shared'
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

export function requirePermission(
  action: AppActions,
  subject: AppSubjects,
): typeof protectedProcedure {
  return protectedProcedure.use(({ context, next }) => {
    if (!context.ability.can(action, subject)) {
      throw new ORPCError('FORBIDDEN', {
        message: `Missing permission ${action}:${subject}`,
      })
    }

    const resolvedUserId = context.userId ?? context.session?.user.id

    if (!resolvedUserId) {
      throw new ORPCError('UNAUTHORIZED')
    }

    return next({
      context: {
        ...context,
        userId: resolvedUserId,
      },
    })
  })
}
