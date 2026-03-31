import { pingProcedure } from './system/ping'

export const appRouter = {
  system: {
    ping: pingProcedure,
  },
}

export type AppRouter = typeof appRouter
