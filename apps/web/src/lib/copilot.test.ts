import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthenticatedShellState } from './api'
import {
  buildCopilotInstructions,
  buildCopilotSuggestions,
  createCopilotThreadId,
  parseCopilotSessionContextEventData,
  resolveCopilotPageHandoff,
  resolveCopilotRoutePanel,
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
  assert.match(instructions, /prioritize indexed document coverage/)
})

test('buildCopilotSuggestions includes knowledge guidance when the surface is visible', () => {
  const suggestions = buildCopilotSuggestions(authenticatedShellState, '/ai/knowledge')

  assert.ok(suggestions.some((suggestion) => suggestion.title === 'Knowledge coverage'))
})

test('buildCopilotSuggestions adapts to eval and audit routes', () => {
  const evalSuggestions = buildCopilotSuggestions(authenticatedShellState, '/ai/evals')
  const auditSuggestions = buildCopilotSuggestions(authenticatedShellState, '/ai/audit')
  const logsSuggestions = buildCopilotSuggestions(authenticatedShellState, '/system/logs')
  const reportsSuggestions = buildCopilotSuggestions(authenticatedShellState, '/reports')

  assert.ok(evalSuggestions.some((suggestion) => suggestion.title === 'Eval hygiene'))
  assert.ok(auditSuggestions.some((suggestion) => suggestion.title === 'Audit triage'))
  assert.ok(logsSuggestions.some((suggestion) => suggestion.title === 'Trace triage'))
  assert.ok(reportsSuggestions.some((suggestion) => suggestion.title === 'Module gap'))
})

test('resolveCopilotRoutePanel returns route-specific assistant brief for ai pages', () => {
  const knowledgePanel = resolveCopilotRoutePanel('/ai/knowledge')
  const evalPanel = resolveCopilotRoutePanel('/ai/evals')
  const auditPanel = resolveCopilotRoutePanel('/ai/audit')
  const systemPanel = resolveCopilotRoutePanel('/system/users')

  assert.equal(knowledgePanel?.badge, 'knowledge-workbench')
  assert.equal(evalPanel?.badge, 'eval-governance')
  assert.equal(auditPanel?.badge, 'audit-governance')
  assert.equal(systemPanel, null)
})

test('resolveCopilotPageHandoff returns page-level handoff guidance for remaining workbench surfaces', () => {
  const logsHandoff = resolveCopilotPageHandoff('/system/logs')
  const reportsHandoff = resolveCopilotPageHandoff('/reports')
  const knowledgeHandoff = resolveCopilotPageHandoff('/ai/knowledge')
  const unrelatedHandoff = resolveCopilotPageHandoff('/system/users')

  assert.equal(logsHandoff?.badge, 'trace-handoff')
  assert.equal(reportsHandoff?.badge, 'workflow-handoff')
  assert.equal(knowledgeHandoff?.badge, 'knowledge-handoff')
  assert.equal(unrelatedHandoff, null)
})

test('parseCopilotSessionContextEventData returns null for malformed payloads', () => {
  assert.equal(parseCopilotSessionContextEventData('invalid-json'), null)
})
