import assert from 'node:assert/strict'
import test from 'node:test'

import {
  localBootstrapAdminCredentials,
  resolveLocalBootstrapAdminCredentials,
  shouldEnableLocalBootstrapAuth,
} from './local-bootstrap-auth'

test('local bootstrap credentials are available outside production', () => {
  assert.equal(shouldEnableLocalBootstrapAuth({ NODE_ENV: 'development' }), true)
  assert.deepEqual(resolveLocalBootstrapAdminCredentials({ NODE_ENV: 'development' }), {
    email: localBootstrapAdminCredentials.email,
    password: localBootstrapAdminCredentials.password,
  })
})

test('local bootstrap credentials are hidden in production', () => {
  assert.equal(shouldEnableLocalBootstrapAuth({ NODE_ENV: 'production' }), false)
  assert.equal(resolveLocalBootstrapAdminCredentials({ NODE_ENV: 'production' }), undefined)
})
