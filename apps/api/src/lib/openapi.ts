import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'

import { appRouter } from '@/routes'

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
})

/**
 * 为所有操作补齐统一错误响应引用，避免不同资源面继续漂移成多套错误文档。
 */
function applyStandardErrorResponses(document: Record<string, unknown>): void {
  const paths = document.paths

  if (!paths || typeof paths !== 'object') {
    return
  }

  for (const pathItem of Object.values(paths)) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      if (
        !['delete', 'get', 'post', 'put'].includes(method) ||
        !operation ||
        typeof operation !== 'object'
      ) {
        continue
      }

      const responses =
        'responses' in operation && operation.responses && typeof operation.responses === 'object'
          ? (operation.responses as Record<string, unknown>)
          : {}

      Object.assign(responses, {
        400: responses['400'] ?? { $ref: '#/components/responses/BadRequestError' },
        401: responses['401'] ?? { $ref: '#/components/responses/UnauthorizedError' },
        403: responses['403'] ?? { $ref: '#/components/responses/ForbiddenError' },
        404: responses['404'] ?? { $ref: '#/components/responses/NotFoundError' },
        429: responses['429'] ?? { $ref: '#/components/responses/RateLimitedError' },
      })

      ;(operation as { responses: Record<string, unknown> }).responses = responses as Record<
        string,
        unknown
      >
    }
  }
}

/**
 * 将统一错误 schema 和 response 组件注入 OpenAPI 文档，供 Scalar 直接展示错误合同。
 */
function attachStandardErrorComponents(document: Record<string, unknown>): void {
  const components =
    document.components && typeof document.components === 'object' ? document.components : {}
  const schemas =
    'schemas' in components && components.schemas && typeof components.schemas === 'object'
      ? components.schemas
      : {}
  const responses =
    'responses' in components && components.responses && typeof components.responses === 'object'
      ? components.responses
      : {}

  Object.assign(schemas, {
    ApiError: {
      type: 'object',
      required: ['code', 'errorCode', 'message', 'status'],
      properties: {
        code: { type: 'string', description: '稳定错误键。', examples: ['FORBIDDEN'] },
        errorCode: { type: 'integer', description: '数值型业务错误码。', examples: [40300] },
        message: { type: 'string', description: '人类可读错误信息。', examples: ['权限不足'] },
        requestId: {
          type: 'string',
          description: '请求追踪 ID。',
          examples: ['c0c9f0eb-99ee-4826-915e-ae72d703d0fd'],
        },
        status: { type: 'integer', description: 'HTTP 状态码。', examples: [403] },
      },
    },
    ValidationError: {
      allOf: [
        { $ref: '#/components/schemas/ApiError' },
        {
          type: 'object',
          required: ['issues'],
          properties: {
            issues: {
              type: 'object',
              required: ['fieldErrors', 'formErrors'],
              properties: {
                fieldErrors: {
                  type: 'object',
                  additionalProperties: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                formErrors: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
      ],
    },
    RateLimitError: {
      allOf: [
        { $ref: '#/components/schemas/ApiError' },
        {
          type: 'object',
          required: ['retryAfterSeconds'],
          properties: {
            retryAfterSeconds: {
              type: 'integer',
              description: '客户端应等待的秒数。',
              examples: [60],
            },
          },
        },
      ],
    },
  })

  Object.assign(responses, {
    BadRequestError: {
      description: '请求参数错误或业务前置条件未满足。',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ValidationError' },
          example: {
            code: 'BAD_REQUEST',
            errorCode: 40000,
            formErrors: [],
            issues: { fieldErrors: { key: ['Key is required'] }, formErrors: [] },
            message: 'Invalid request payload',
            requestId: 'example-request-id',
            status: 400,
          },
        },
      },
    },
    UnauthorizedError: {
      description: '当前请求未携带有效登录态。',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiError' },
          example: {
            code: 'UNAUTHORIZED',
            errorCode: 40100,
            message: 'Authentication required',
            requestId: 'example-request-id',
            status: 401,
          },
        },
      },
    },
    ForbiddenError: {
      description: '当前主体缺少访问所需权限。',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiError' },
          example: {
            code: 'FORBIDDEN',
            errorCode: 40300,
            message: 'manage:Config | manage:all',
            requestId: 'example-request-id',
            status: 403,
          },
        },
      },
    },
    NotFoundError: {
      description: '请求的资源不存在。',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiError' },
          example: {
            code: 'NOT_FOUND',
            errorCode: 40400,
            message: 'Config 6d0b2cb6-1ac6-4f2c-9b53-f1eab4f3df67 was not found',
            requestId: 'example-request-id',
            status: 404,
          },
        },
      },
    },
    RateLimitedError: {
      description: '请求超出限流配额。',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/RateLimitError' },
          example: {
            code: 'RATE_LIMITED',
            errorCode: 42900,
            message: '请求过于频繁',
            requestId: 'example-request-id',
            retryAfterSeconds: 60,
            status: 429,
          },
        },
      },
    },
  })

  document.components = {
    ...components,
    responses,
    schemas,
  }
}

// 生成当前 API 合约文档，确保对外描述反映真实阶段能力，而不是遗留骨架状态。
export async function generateOpenApiDocument() {
  const document = await generator.generate(appRouter, {
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

  const mutableDocument = document as unknown as Record<string, unknown>

  attachStandardErrorComponents(mutableDocument)
  applyStandardErrorResponses(mutableDocument)

  return document
}
