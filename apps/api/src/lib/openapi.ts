import { OpenAPIGenerator } from '@orpc/openapi'

import { appRouter } from '@/routes'

const generator = new OpenAPIGenerator()

export async function generateOpenApiDocument() {
  return generator.generate(appRouter, {
    info: {
      title: 'AI Native OS API',
      version: '0.1.0',
      description: 'Phase 1 API skeleton for AI Native OS.',
    },
    servers: [
      {
        url: process.env.API_URL ?? 'http://localhost:3001',
        description: 'Local API server',
      },
    ],
  })
}
