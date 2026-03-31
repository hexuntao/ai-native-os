import { os } from '@orpc/server'

import type { AppContext } from './context'

const base = os.$context<AppContext>()

export const publicProcedure = base
