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
        description: 'System-wide AI operating picture with release, risk, and runtime signals.',
        group: 'home',
        href: '/home',
        label: 'AI Operations Center',
        subject: 'OperationLog',
      },
    ],
  })

  assert.equal(href, '/home')
})

test('resolveLoginErrorMessage maps known error codes to user-facing copy', () => {
  assert.equal(resolveLoginErrorMessage('missing_credentials'), 'Email and password are required.')
  assert.match(resolveLoginErrorMessage('invalid_credentials') ?? '', /Sign-in failed/)
  assert.equal(resolveLoginErrorMessage(undefined), undefined)
})

test('resolveShellModuleLabel groups known dashboard routes into stable modules', () => {
  assert.equal(resolveShellModuleLabel('/home'), 'Home')
  assert.equal(resolveShellModuleLabel('/system/users'), 'Admin')
  assert.equal(resolveShellModuleLabel('/monitor/server'), 'Observe')
  assert.equal(resolveShellModuleLabel('/ai/knowledge'), 'Knowledge')
  assert.equal(resolveShellModuleLabel('/reports'), 'Workspace')
})

test('resolveActiveNavigationItem returns the current route descriptor', () => {
  const activeItem = resolveActiveNavigationItem('/system/roles', [
    {
      action: 'read',
      description: 'Inspect authenticated principals, status, and assigned roles.',
      group: 'admin',
      href: '/admin/users',
      legacyHrefs: ['/system/users'],
      label: 'Users Directory',
      subject: 'User',
    },
    {
      action: 'read',
      description: 'Inspect seeded roles and access surfaces.',
      group: 'admin',
      href: '/admin/roles',
      legacyHrefs: ['/system/roles'],
      label: 'Roles Matrix',
      subject: 'Role',
    },
  ])

  assert.equal(activeItem?.label, 'Roles Matrix')
})

test('groupNavigationItems preserves home-build-observe-improve-knowledge-govern-workspace-admin ordering', () => {
  const groups = groupNavigationItems([
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
    {
      action: 'read',
      description: 'Inspect API and Mastra runtime health.',
      group: 'observe',
      href: '/observe/monitor',
      legacyHrefs: ['/monitor/server'],
      label: 'Runtime Monitor',
      subject: 'OperationLog',
    },
    {
      action: 'read',
      description: 'Inspect authenticated principals, status, and assigned roles.',
      group: 'admin',
      href: '/admin/users',
      legacyHrefs: ['/system/users'],
      label: 'Users Directory',
      subject: 'User',
    },
  ])

  assert.deepEqual(
    groups.map((group) => group.label),
    ['Home', 'Observe', 'Knowledge', 'Admin'],
  )
})
