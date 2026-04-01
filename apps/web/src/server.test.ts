import assert from 'node:assert/strict'
import test from 'node:test'

import { renderIndexPage } from './lib/page'

test('renderIndexPage returns sign-in shell when unauthenticated', () => {
  const html = renderIndexPage({
    kind: 'unauthenticated',
  })

  assert.match(html, /<!DOCTYPE html>/)
  assert.match(html, /AI Native OS/)
  assert.match(html, /Sign in to materialize your control surface/)
  assert.match(html, /Minimal Auth Shell/)
})

test('renderIndexPage hides navigation that the current ability does not allow', () => {
  const html = renderIndexPage({
    hiddenNavigationCount: 2,
    kind: 'authenticated',
    permissionRuleCount: 3,
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
      {
        action: 'read',
        description: 'Review operation history and audit visibility.',
        href: '/system/logs',
        label: 'Audit Trails',
        subject: 'OperationLog',
      },
    ],
  })

  assert.match(html, /Viewer/)
  assert.match(html, /Roles Matrix/)
  assert.match(html, /Audit Trails/)
  assert.doesNotMatch(html, /Permission Center/)
})
