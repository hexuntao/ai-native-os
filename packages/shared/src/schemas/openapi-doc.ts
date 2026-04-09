import { JSON_SCHEMA_REGISTRY } from '@orpc/zod/zod4'
import type { z } from 'zod'

export interface OpenApiSchemaDoc<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  default?: z.input<TSchema> | z.output<TSchema>
  description: string
  examples?: ReadonlyArray<z.input<TSchema> | z.output<TSchema>>
  title?: string
}

/**
 * 为 Zod schema 附加可被 oRPC OpenAPI 生成器识别的文档元数据。
 *
 * 说明：
 * - 当前栈里的 Zod schema 仍是运行时校验源
 * - 文档元数据通过 oRPC 官方 `JSON_SCHEMA_REGISTRY` 注册
 * - 同时保留纯文本 `description`，便于其他工具和错误消息读取
 */
export function withOpenApiSchemaDoc<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  doc: OpenApiSchemaDoc<TSchema>,
): TSchema {
  const documentedSchema = schema.describe(doc.description) as TSchema

  JSON_SCHEMA_REGISTRY.add(documentedSchema, doc)

  return documentedSchema
}
