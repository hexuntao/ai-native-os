import { OpenAPIGenerator } from '@orpc/openapi'

import { appRouter } from '@/routes'

const generator = new OpenAPIGenerator()

// 生成当前 API 合约文档，确保对外描述反映真实阶段能力，而不是遗留骨架状态。
export async function generateOpenApiDocument() {
  return generator.generate(appRouter, {
    info: {
      title: 'AI Native OS API',
      version: '0.1.0',
      description:
        'Contract-first API surface for AI Native OS, including auth, RBAC, system runtime, and AI runtime support endpoints.',
    },
    servers: [
      {
        url: process.env.API_URL ?? 'http://localhost:3001',
        description: 'Local API server',
      },
    ],
  })
}
