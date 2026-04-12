import assert from 'node:assert/strict'
import test from 'node:test'

import {
  groupNavigationItems,
  resolveActiveNavigationItem,
  resolveDashboardLandingHref,
  resolveLoginErrorMessage,
  resolveShellModuleLabel,
} from './shell'

test('resolveDashboardLandingHref returns the first visible route for authenticated users', () => {
  const href = resolveDashboardLandingHref({
    hiddenNavigationCount: 1,
    kind: 'authenticated',
    permissionRuleCount: 2,
    roleCodes: ['viewer'],
    session: {
      user: {
        email: 'viewer@example.com',
        name: 'Viewer',
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
    ],
  })

  assert.equal(href, '/system/roles')
})

test('resolveLoginErrorMessage maps known error codes to user-facing copy', () => {
  assert.equal(resolveLoginErrorMessage('missing_credentials'), 'Email and password are required.')
  assert.match(resolveLoginErrorMessage('invalid_credentials') ?? '', /Sign-in failed/)
  assert.equal(resolveLoginErrorMessage(undefined), undefined)
})

test('resolveShellModuleLabel groups known dashboard routes into stable modules', () => {
  assert.equal(resolveShellModuleLabel('/system/users'), 'System Control')
  assert.equal(resolveShellModuleLabel('/monitor/server'), 'Observability')
  assert.equal(resolveShellModuleLabel('/ai/knowledge'), 'AI Governance')
  assert.equal(resolveShellModuleLabel('/reports'), 'Exports')
})

test('resolveActiveNavigationItem returns the current route descriptor', () => {
  const activeItem = resolveActiveNavigationItem('/system/roles', [
    {
      action: 'read',
      description: 'Inspect authenticated principals, status, and assigned roles.',
      href: '/system/users',
      label: 'Users Directory',
      subject: 'User',
    },
    {
      action: 'read',
      description: 'Inspect seeded roles and access surfaces.',
      href: '/system/roles',
      label: 'Roles Matrix',
      subject: 'Role',
    },
  ])

  assert.equal(activeItem?.label, 'Roles Matrix')
})

test('groupNavigationItems preserves system-monitor-ai-reports ordering', () => {
  const groups = groupNavigationItems([
    {
      action: 'manage',
      description: 'Manage AI knowledge assets and retrieval inputs.',
      href: '/ai/knowledge',
      label: 'Knowledge Vault',
      subject: 'AiKnowledge',
    },
    {
      action: 'read',
      description: 'Inspect API and Mastra runtime health.',
      href: '/monitor/server',
      label: 'System Health',
      subject: 'OperationLog',
    },
    {
      action: 'read',
      description: 'Inspect authenticated principals, status, and assigned roles.',
      href: '/system/users',
      label: 'Users Directory',
      subject: 'User',
    },
  ])

  assert.deepEqual(
    groups.map((group) => group.label),
    ['System Control', 'Observability', 'AI Governance'],
  )
})
