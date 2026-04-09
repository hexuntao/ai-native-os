import assert from 'node:assert/strict'
import test from 'node:test'

import { JSON_SCHEMA_REGISTRY } from '@orpc/zod/zod4'
import { z } from 'zod'

import { withOpenApiSchemaDoc } from './openapi-doc'

test('withOpenApiSchemaDoc registers schema metadata for oRPC OpenAPI conversion', () => {
  const schema = withOpenApiSchemaDoc(z.string(), {
    title: 'ExampleField',
    description: '示例字段说明',
    examples: ['demo'],
    default: 'demo',
  })
  const metadata = JSON_SCHEMA_REGISTRY.get(schema)

  assert.deepEqual(metadata, {
    title: 'ExampleField',
    description: '示例字段说明',
    examples: ['demo'],
    default: 'demo',
  })
  assert.equal(schema.description, '示例字段说明')
})
