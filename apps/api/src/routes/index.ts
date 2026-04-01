import { pingProcedure } from './system/ping'
import { sessionProcedure } from './system/session'

export const appRouter = {
  system: {
    ping: pingProcedure,
    session: sessionProcedure,
  },
}

export type AppRouter = typeof appRouter
