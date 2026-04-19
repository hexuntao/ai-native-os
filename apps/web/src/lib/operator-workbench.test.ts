import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createOperatorPresetHref,
  createOperatorPresetStorageKey,
  normalizeOperatorPresetName,
  readOperatorMutationFeedback,
} from './operator-workbench'

describe('operator-workbench helpers', () => {
  it('reads mutation feedback from dashboard search params', () => {
    const feedback = readOperatorMutationFeedback({
      mutation: 'updated',
      success: '用户信息已更新。',
      target: 'user-123',
    })

    assert.deepEqual(feedback, {
      action: 'updated',
      itemId: 'user-123',
      message: '用户信息已更新。',
    })
  })

  it('returns null when mutation metadata is incomplete', () => {
    const feedback = readOperatorMutationFeedback({
      success: '角色已更新。',
    })

    assert.equal(feedback, null)
  })

  it('creates stable preset storage keys and href payloads', () => {
    assert.equal(
      createOperatorPresetStorageKey('system-users'),
      'ai-native-os.operator-presets.system-users',
    )
    assert.equal(
      createOperatorPresetHref('/system/users', {
        pageSize: '20',
        search: 'alice',
        status: 'active',
      }),
      '/system/users?pageSize=20&search=alice&status=active',
    )
  })

  it('normalizes preset names', () => {
    assert.equal(normalizeOperatorPresetName('  高频用户排查  '), '高频用户排查')
  })
})
