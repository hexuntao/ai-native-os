import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'

import { appRouter } from '@/routes'

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
})

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
    tags: [
      {
        name: 'System:Users',
        description: '系统管理 / 用户管理。负责后台用户主体的查询、创建、更新、删除与认证同步。',
      },
    ],
  })
}
