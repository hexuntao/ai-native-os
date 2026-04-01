import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPermissionRuleSignature,
  dedupePermissionRules,
  mapPermissionRecordToRule,
} from './load-permissions'

test('mapPermissionRecordToRule converts stored permission rows to CASL rules', () => {
  const rule = mapPermissionRecordToRule({
    action: 'read',
    conditions: { ownerId: 'user-1' },
    fields: ['email'],
    inverted: true,
    resource: 'User',
  })

  assert.deepEqual(rule, {
    action: 'read',
    conditions: { ownerId: 'user-1' },
    fields: ['email'],
    inverted: true,
    subject: 'User',
  })
})

test('dedupePermissionRules removes duplicate rule signatures', () => {
  const uniqueRules = dedupePermissionRules([
    { action: 'manage', subject: 'all' },
    { action: 'manage', subject: 'all' },
    { action: 'read', subject: 'User' },
  ])

  assert.equal(uniqueRules.length, 2)
  const [firstRule] = uniqueRules

  assert.ok(firstRule)
  assert.equal(
    createPermissionRuleSignature(firstRule),
    '{"action":"manage","conditions":null,"fields":null,"inverted":false,"subject":"all"}',
  )
})
