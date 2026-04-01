import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthenticatedShellState } from './api'
import {
  buildCopilotInstructions,
  buildCopilotSuggestions,
  createCopilotThreadId,
  parseCopilotSessionContextEventData,
} from './copilot'

const authenticatedShellState: AuthenticatedShellState = {
  hiddenNavigationCount: 2,
  kind: 'authenticated',
  permissionRuleCount: 5,
  roleCodes: ['admin'],
  session: {
    user: {
      email: 'admin@example.com',
      name: 'Admin Operator',
    },
  },
  visibleNavigation: [
    {
      action: 'read',
      description: 'Inspect seeded roles and access surfaces.',
      href: '/system/roles',
      label: 'Roles Matrix',
      subject: 'Role',
    },
    {
      action: 'manage',
      description: 'Manage AI knowledge assets and retrieval inputs.',
      href: '/ai/knowledge',
      label: 'Knowledge Vault',
      subject: 'AiKnowledge',
    },
  ],
}

test('createCopilotThreadId binds the thread to the current resource and route', () => {
  assert.equal(
    createCopilotThreadId('viewer:123', '/system/roles'),
    'dashboard:viewer-123:system-roles',
  )
})

test('buildCopilotInstructions includes route, roles, and visible surfaces', () => {
  const instructions = buildCopilotInstructions(authenticatedShellState, '/ai/knowledge')

  assert.match(instructions, /Current route: \/ai\/knowledge\./)
  assert.match(instructions, /Authenticated roles: admin\./)
  assert.match(instructions, /Roles Matrix, Knowledge Vault/)
})

test('buildCopilotSuggestions includes knowledge guidance when the surface is visible', () => {
  const suggestions = buildCopilotSuggestions(authenticatedShellState)

  assert.ok(suggestions.some((suggestion) => suggestion.title === 'Knowledge context'))
})

test('parseCopilotSessionContextEventData returns null for malformed payloads', () => {
  assert.equal(parseCopilotSessionContextEventData('invalid-json'), null)
})
