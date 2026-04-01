import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveDashboardLandingHref, resolveLoginErrorMessage } from './shell'

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
