import assert from 'node:assert/strict'
import test from 'node:test'

import { isCopilotCapabilityEnabled, resolveAiRuntimeCapability } from './capabilities'

test('resolveAiRuntimeCapability degrades AI runtime when OPENAI_API_KEY is missing', () => {
  const capability = resolveAiRuntimeCapability({
    MASTRA_DEFAULT_MODEL: 'openai/gpt-4.1-mini',
    NODE_ENV: 'development',
  })

  assert.equal(capability.status, 'degraded')
  assert.equal(capability.copilot, 'degraded')
  assert.equal(capability.remoteEmbeddings, 'degraded')
  assert.equal(capability.embeddingProvider, 'deterministic-local')
  assert.equal(capability.openaiApiKeyConfigured, false)
  assert.ok(capability.reason.includes('OPENAI_API_KEY'))
  assert.deepEqual(capability.unavailableSurfaces, ['copilot', 'remote-embeddings'])
  assert.equal(isCopilotCapabilityEnabled(capability), false)
})

test('resolveAiRuntimeCapability enables remote AI runtime when OPENAI_API_KEY is configured', () => {
  const capability = resolveAiRuntimeCapability({
    MASTRA_DEFAULT_MODEL: 'openai/gpt-4.1-mini',
    NODE_ENV: 'production',
    OPENAI_API_KEY: 'test-openai-key',
  })

  assert.equal(capability.status, 'enabled')
  assert.equal(capability.copilot, 'enabled')
  assert.equal(capability.remoteEmbeddings, 'enabled')
  assert.equal(capability.embeddingProvider, 'openai')
  assert.equal(capability.openaiApiKeyConfigured, true)
  assert.deepEqual(capability.unavailableSurfaces, [])
  assert.equal(isCopilotCapabilityEnabled(capability), true)
})
