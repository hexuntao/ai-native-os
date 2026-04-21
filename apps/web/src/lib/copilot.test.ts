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
      description: 'System-wide AI operating picture with release, risk, and runtime signals.',
      group: 'home',
      href: '/home',
      label: 'AI Operations Center',
      subject: 'OperationLog',
    },
    {
      action: 'manage',
      description: 'Manage AI knowledge assets and retrieval inputs.',
      group: 'knowledge',
      href: '/knowledge/collections',
      legacyHrefs: ['/ai/knowledge'],
      label: 'Knowledge Collections',
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
  const instructions = buildCopilotInstructions(authenticatedShellState, '/knowledge/collections')

  assert.match(instructions, /Current route: \/knowledge\/collections\./)
  assert.match(instructions, /Authenticated roles: admin\./)
  assert.match(instructions, /AI Operations Center, Knowledge Collections/)
  assert.match(instructions, /prioritize indexed document coverage/)
})

test('buildCopilotSuggestions includes knowledge guidance when the surface is visible', () => {
  const suggestions = buildCopilotSuggestions(authenticatedShellState, '/knowledge/collections')

  assert.ok(suggestions.some((suggestion) => suggestion.title === 'Knowledge coverage'))
})

test('buildCopilotSuggestions adapts to eval and audit routes', () => {
  const promptSuggestions = buildCopilotSuggestions(authenticatedShellState, '/build/prompts')
  const evalSuggestions = buildCopilotSuggestions(authenticatedShellState, '/improve/evals')
  const auditSuggestions = buildCopilotSuggestions(authenticatedShellState, '/observe/runs')
  const serverSuggestions = buildCopilotSuggestions(authenticatedShellState, '/observe/monitor')
  const onlineSuggestions = buildCopilotSuggestions(authenticatedShellState, '/monitor/online')
  const logsSuggestions = buildCopilotSuggestions(authenticatedShellState, '/govern/audit')
  const reportsSuggestions = buildCopilotSuggestions(authenticatedShellState, '/workspace/reports')
  const approvalsSuggestions = buildCopilotSuggestions(authenticatedShellState, '/govern/approvals')
  const homeSuggestions = buildCopilotSuggestions(authenticatedShellState, '/home')

  assert.ok(promptSuggestions.some((suggestion) => suggestion.title === 'Prompt triage'))
  assert.ok(evalSuggestions.some((suggestion) => suggestion.title === 'Eval hygiene'))
  assert.ok(auditSuggestions.some((suggestion) => suggestion.title === 'Audit triage'))
  assert.ok(serverSuggestions.some((suggestion) => suggestion.title === 'Incident triage'))
  assert.ok(onlineSuggestions.some((suggestion) => suggestion.title === 'Session triage'))
  assert.ok(logsSuggestions.some((suggestion) => suggestion.title === 'Audit triage'))
  assert.ok(reportsSuggestions.some((suggestion) => suggestion.title === 'Module gap'))
  assert.ok(approvalsSuggestions.some((suggestion) => suggestion.title === 'Approval triage'))
  assert.ok(homeSuggestions.some((suggestion) => suggestion.title === 'Ops triage'))
})

test('resolveCopilotRoutePanel returns route-specific assistant brief for ai and monitor pages', () => {
  const knowledgePanel = resolveCopilotRoutePanel('/knowledge/collections')
  const promptsPanel = resolveCopilotRoutePanel('/build/prompts')
  const evalPanel = resolveCopilotRoutePanel('/improve/evals')
  const auditPanel = resolveCopilotRoutePanel('/observe/runs')
  const serverPanel = resolveCopilotRoutePanel('/observe/monitor')
  const onlinePanel = resolveCopilotRoutePanel('/monitor/online')
  const approvalsPanel = resolveCopilotRoutePanel('/govern/approvals')
  const homePanel = resolveCopilotRoutePanel('/home')
  const systemPanel = resolveCopilotRoutePanel('/admin/users')

  assert.equal(knowledgePanel?.badge, 'knowledge-workbench')
  assert.equal(promptsPanel?.badge, 'prompt-governance')
  assert.equal(evalPanel?.badge, 'eval-governance')
  assert.equal(auditPanel?.badge, 'audit-governance')
  assert.equal(serverPanel?.badge, 'runtime-triage')
  assert.equal(onlinePanel?.badge, 'presence-triage')
  assert.equal(approvalsPanel?.badge, 'approval-governance')
  assert.equal(homePanel?.badge, 'ops-center')
  assert.equal(systemPanel, null)
})

test('resolveCopilotPageHandoff returns page-level handoff guidance for remaining workbench surfaces', () => {
  const logsHandoff = resolveCopilotPageHandoff('/govern/audit')
  const reportsHandoff = resolveCopilotPageHandoff('/workspace/reports')
  const knowledgeHandoff = resolveCopilotPageHandoff('/knowledge/collections')
  const promptsHandoff = resolveCopilotPageHandoff('/build/prompts')
  const serverHandoff = resolveCopilotPageHandoff('/observe/monitor')
  const onlineHandoff = resolveCopilotPageHandoff('/monitor/online')
  const approvalsHandoff = resolveCopilotPageHandoff('/govern/approvals')
  const homeHandoff = resolveCopilotPageHandoff('/home')
  const unrelatedHandoff = resolveCopilotPageHandoff('/admin/users')

  assert.equal(logsHandoff?.badge, 'trace-handoff')
  assert.equal(reportsHandoff?.badge, 'workflow-handoff')
  assert.equal(knowledgeHandoff?.badge, 'knowledge-handoff')
  assert.equal(promptsHandoff?.badge, 'prompt-handoff')
  assert.equal(serverHandoff?.badge, 'runtime-handoff')
  assert.equal(onlineHandoff?.badge, 'presence-handoff')
  assert.equal(approvalsHandoff?.badge, 'approval-handoff')
  assert.equal(homeHandoff?.badge, 'ops-handoff')
  assert.equal(unrelatedHandoff, null)
})

test('parseCopilotSessionContextEventData returns null for malformed payloads', () => {
  assert.equal(parseCopilotSessionContextEventData('invalid-json'), null)
})
