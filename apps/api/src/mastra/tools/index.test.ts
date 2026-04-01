import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import {
  defaultUsers,
  listAiAuditLogsByToolId,
  loadUserPermissionProfileByEmail,
} from '@ai-native-os/db'
import type { RequestContext } from '@mastra/core/request-context'

import { createMastraRequestContext } from '../request-context'
import {
  aiAuditLogSearchRegistration,
  reportDataSnapshotRegistration,
  userDirectoryRegistration,
} from './index'

async function createToolRequestContextForRole(
  roleCode: string,
): Promise<ReturnType<typeof createMastraRequestContext>> {
  const seededUser = defaultUsers.find((user) => user.roleCodes.includes(roleCode))

  assert.ok(seededUser, `Expected seeded user for role ${roleCode}`)

  const permissionProfile = await loadUserPermissionProfileByEmail(seededUser.email)

  assert.ok(permissionProfile, `Expected permission profile for ${seededUser.email}`)

  return createMastraRequestContext({
    authUserId: `auth-${roleCode}-${randomUUID()}`,
    permissionRules: permissionProfile.rules,
    rbacUserId: permissionProfile.userId,
    requestId: randomUUID(),
    roleCodes: permissionProfile.roleCodes,
    userEmail: seededUser.email,
  })
}

function toUntypedRequestContext(
  requestContext: ReturnType<typeof createMastraRequestContext>,
): RequestContext<unknown> {
  return requestContext as unknown as RequestContext<unknown>
}

test('user-directory tool returns users and writes a success audit log', async () => {
  const requestContext = await createToolRequestContextForRole('viewer')
  const execute = userDirectoryRegistration.tool.execute

  assert.ok(execute)

  const result = await execute(
    {
      includeInactive: false,
      limit: 5,
    },
    {
      requestContext: toUntypedRequestContext(requestContext),
    },
  )
  const parsedResult = userDirectoryRegistration.outputSchema.parse(result) as {
    users: Array<{
      email: string
      id: string
      nickname: string | null
      roleCodes: string[]
      status: boolean
      username: string
    }>
  }
  const auditRows = await listAiAuditLogsByToolId(userDirectoryRegistration.id)

  assert.ok(parsedResult.users.length > 0)
  assert.equal(auditRows[0]?.status, 'success')
  assert.equal(auditRows[0]?.requestInfo?.requestId, requestContext.get('requestId'))
  assert.equal(auditRows[0]?.subject, 'User')
})

test('ai-audit-log-search tool rejects insufficient permissions and writes a forbidden audit log', async () => {
  const requestContext = await createToolRequestContextForRole('viewer')
  const execute = aiAuditLogSearchRegistration.tool.execute

  assert.ok(execute)

  await assert.rejects(
    () =>
      execute(
        {
          limit: 5,
        },
        {
          requestContext: toUntypedRequestContext(requestContext),
        },
      ),
    {
      message: 'Missing permission read:AiAuditLog',
      name: 'MastraToolPermissionError',
    },
  )

  const auditRows = await listAiAuditLogsByToolId(aiAuditLogSearchRegistration.id)

  assert.equal(auditRows[0]?.status, 'forbidden')
  assert.equal(auditRows[0]?.requestInfo?.requestId, requestContext.get('requestId'))
  assert.equal(auditRows[0]?.subject, 'AiAuditLog')
})

test('report-data-snapshot tool returns aggregate counts for report-capable principals', async () => {
  const requestContext = await createToolRequestContextForRole('editor')
  const execute = reportDataSnapshotRegistration.tool.execute

  assert.ok(execute)

  const result = await execute(
    {},
    {
      requestContext: toUntypedRequestContext(requestContext),
    },
  )
  const parsedResult = reportDataSnapshotRegistration.outputSchema.parse(result) as {
    counts: {
      aiAuditLogs: number
      menus: number
      operationLogs: number
      permissions: number
      roles: number
      users: number
    }
    generatedAt: string
  }

  assert.ok(parsedResult.counts.users > 0)
  assert.ok(parsedResult.counts.roles > 0)
  assert.ok(parsedResult.generatedAt.length > 0)
})
