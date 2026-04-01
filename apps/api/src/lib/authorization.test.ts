import assert from 'node:assert/strict'
import test from 'node:test'
import { defineAbilityFor } from '@ai-native-os/shared'
import { subject } from '@casl/ability'

test('CASL ability applies conditional rules to plain objects', () => {
  const ability = defineAbilityFor([
    {
      action: 'read',
      conditions: {
        id: 'user-1',
      } as never,
      subject: 'User',
    },
  ])
  const matchingUser = subject('User', { id: 'user-1' }) as never
  const nonMatchingUser = subject('User', { id: 'user-2' }) as never

  assert.equal(ability.can('read', matchingUser), true)
  assert.equal(ability.can('read', nonMatchingUser), false)
  assert.equal(ability.can('update', matchingUser), false)
})
