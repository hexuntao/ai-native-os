import assert from 'node:assert/strict'
import test from 'node:test'

import type { KnowledgeListResponse, UserListResponse } from '@ai-native-os/shared'

import { applyKnowledgeGenerativePrompt, applyUserDirectoryGenerativePrompt } from './generative'

const userRows: UserListResponse['data'] = [
  {
    createdAt: '2026-04-01T10:00:00.000Z',
    email: 'viewer@ai-native-os.local',
    id: '86f2fa87-40b1-44d0-ae4a-6ca99dffb0d1',
    nickname: 'Audit Viewer',
    roleCodes: ['viewer'],
    status: false,
    updatedAt: '2026-04-01T10:00:00.000Z',
    username: 'viewer.ops',
  },
  {
    createdAt: '2026-04-01T11:00:00.000Z',
    email: 'admin@ai-native-os.local',
    id: 'd8013c4c-3d71-4f1c-8f4b-7b066a7ea9f5',
    nickname: 'Admin Operator',
    roleCodes: ['admin'],
    status: true,
    updatedAt: '2026-04-01T11:00:00.000Z',
    username: 'admin.ops',
  },
]

const knowledgeRows: KnowledgeListResponse['data'] = [
  {
    chunkCount: 18,
    documentId: 'ef6f1271-0431-4842-ae12-d7d17e7788e6',
    lastIndexedAt: '2026-04-01T10:00:00.000Z',
    metadata: {},
    sourceType: 'markdown',
    sourceUri: 'internal://playbooks/audit.md',
    title: 'Audit Playbook',
  },
  {
    chunkCount: 42,
    documentId: '2d0efc55-80d8-47d9-9329-5f1db9a8ef84',
    lastIndexedAt: '2026-04-02T10:00:00.000Z',
    metadata: {},
    sourceType: 'policy',
    sourceUri: 'internal://policies/security.md',
    title: 'Security Policy',
  },
]

test('applyUserDirectoryGenerativePrompt narrows the current page slice', () => {
  const result = applyUserDirectoryGenerativePrompt('Show inactive viewer accounts', userRows)

  assert.equal(result.draft.status, 'inactive')
  assert.equal(result.draft.roleCode, 'viewer')
  assert.equal(result.filteredRows.length, 1)
  assert.equal(result.filteredRows[0]?.email, 'viewer@ai-native-os.local')
})

test('applyKnowledgeGenerativePrompt ranks recent documents and preserves source focus', () => {
  const result = applyKnowledgeGenerativePrompt('Show recent policy documents', knowledgeRows)

  assert.equal(result.draft.lens, 'recent')
  assert.equal(result.draft.sourceType, 'policy')
  assert.equal(result.filteredRows.length, 1)
  assert.equal(result.filteredRows[0]?.title, 'Security Policy')
})
