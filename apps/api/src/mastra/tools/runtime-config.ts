import { z } from 'zod'

import { resolveMastraEnvironment } from '../env'
import { defineProtectedMastraTool } from './base'

const runtimeConfigInputSchema = z.object({})

const runtimeConfigOutputSchema = z.object({
  appUrl: z.string().url(),
  defaultModel: z.string(),
  environment: z.string(),
  mastraRoutePrefix: z.string(),
})

export const runtimeConfigRegistration = defineProtectedMastraTool({
  description: 'Read a safe runtime configuration summary without exposing secrets.',
  execute: async (input) => {
    runtimeConfigInputSchema.parse(input)
    const mastraEnvironment = resolveMastraEnvironment()

    return {
      appUrl: process.env.APP_URL ?? 'http://localhost:3000',
      defaultModel: mastraEnvironment.defaultModel,
      environment: process.env.NODE_ENV ?? 'development',
      mastraRoutePrefix: mastraEnvironment.routePrefix,
    }
  },
  id: 'runtime-config',
  inputSchema: runtimeConfigInputSchema,
  outputSchema: runtimeConfigOutputSchema,
  permission: {
    action: 'read',
    subject: 'Config',
  },
})
