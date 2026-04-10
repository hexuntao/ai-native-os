import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { db, listAiAuditLogsByToolId, roles, userRoles, users } from '@ai-native-os/db'
import { serve } from '@hono/node-server'
import { eq } from 'drizzle-orm'

import { app } from '@/index'
import { createExternalMcpClient, discoverExternalMcpSnapshot } from '@/mastra/mcp/client'
import { mastraMcpEndpointPath } from '@/mastra/mcp/server'
import { reportScheduleWorkflowOutputSchema } from '@/mastra/workflows/report-schedule'

function convertSetCookieToCookie(headers: Headers): Headers {
  const setCookieHeaders = headers.getSetCookie()

  if (setCookieHeaders.length === 0) {
    return headers
  }

  const existingCookies = headers.get('cookie')
  const cookies = existingCookies ? existingCookies.split('; ') : []

  for (const setCookie of setCookieHeaders) {
    const cookiePair = setCookie.split(';')[0]?.trim()

    if (cookiePair) {
      cookies.push(cookiePair)
    }
  }

  headers.set('cookie', cookies.join('; '))

  return headers
}

/**
 * 为测试角色创建一条可登录的 Better Auth 会话。
 */
async function createSessionForRole(roleCode: string): Promise<Headers> {
  const email = `mcp-${roleCode}-${randomUUID()}@example.com`
  const username = `mcp_${roleCode}_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const origin = 'http://localhost:3000'
  const [role] = await db
    .select({
      id: roles.id,
    })
    .from(roles)
    .where(eq(roles.code, roleCode))
    .limit(1)

  assert.ok(role, `Expected seeded role ${roleCode} to exist`)

  const userId = randomUUID()

  await db.insert(users).values({
    email,
    id: userId,
    nickname: `MCP ${roleCode}`,
    passwordHash: 'mcp-test-placeholder',
    username,
  })
  await db.insert(userRoles).values({
    roleId: role.id,
    userId,
  })

  const password = 'Passw0rd!Passw0rd!'
  const signUpResponse = await app.request('http://localhost/api/auth/sign-up/email', {
    body: JSON.stringify({
      callbackURL: origin,
      email,
      name: `MCP ${roleCode}`,
      password,
    }),
    headers: {
      'content-type': 'application/json',
      origin,
    },
    method: 'POST',
  })

  assert.equal(signUpResponse.status, 200)

  const signInResponse = await app.request('http://localhost/api/auth/sign-in/email', {
    body: JSON.stringify({
      email,
      password,
      rememberMe: true,
    }),
    headers: {
      'content-type': 'application/json',
      origin,
    },
    method: 'POST',
  })

  assert.equal(signInResponse.status, 200)

  const authHeaders = convertSetCookieToCookie(signInResponse.headers)

  authHeaders.set('origin', origin)

  return authHeaders
}

/**
 * 启动仅供 MCP 集成测试使用的临时 HTTP server。
 */
async function startTestServer(): Promise<{
  baseUrl: string
  close: () => Promise<void>
}> {
  return new Promise((resolve, reject) => {
    const server = serve(
      {
        fetch: app.fetch,
        port: 0,
      },
      (info) => {
        resolve({
          baseUrl: `http://127.0.0.1:${info.port}`,
          close: async () =>
            new Promise<void>((closeResolve, closeReject) => {
              server.close((error?: Error) => {
                if (error) {
                  closeReject(error)
                  return
                }

                closeResolve()
              })
            }),
        })
      },
    )

    server.on('error', reject)
  })
}

/**
 * 把 Headers 转成 MCP client 可接受的普通对象。
 */
function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries())
}

/**
 * 解析 MCP tool 返回的结构化 JSON 文本。
 */
function parseMcpToolJsonResult(result: unknown): unknown {
  if (
    typeof result === 'object' &&
    result !== null &&
    'toolResult' in result &&
    result.toolResult !== undefined
  ) {
    return result.toolResult
  }

  if (
    typeof result === 'object' &&
    result !== null &&
    'content' in result &&
    Array.isArray(result.content)
  ) {
    const textPart = result.content.find(
      (contentPart) =>
        typeof contentPart === 'object' &&
        contentPart !== null &&
        'type' in contentPart &&
        contentPart.type === 'text' &&
        'text' in contentPart &&
        typeof contentPart.text === 'string',
    )

    assert.ok(textPart, 'Expected MCP tool result to expose a text content part')

    return JSON.parse(textPart.text)
  }

  throw new Error('Unsupported MCP tool result payload')
}

/**
 * 为动态 MCP tool 执行生成最小调用上下文。
 */
function createMcpToolCallOptions(): {
  messages: []
  toolCallId: string
} {
  return {
    messages: [],
    toolCallId: randomUUID(),
  }
}

test('MCP route rejects unauthenticated requests', async () => {
  const response = await app.request(`http://localhost${mastraMcpEndpointPath}`)
  const payload = (await response.json()) as {
    code: string
    message: string
  }

  assert.equal(response.status, 401)
  assert.equal(payload.code, 'UNAUTHORIZED')
  assert.equal(payload.message, 'Authentication required for Mastra routes')
})

test('admin MCP discovery hides workflow wrappers that the principal cannot execute', async () => {
  const authHeaders = await createSessionForRole('admin')
  const server = await startTestServer()

  try {
    const snapshot = await discoverExternalMcpSnapshot({
      headers: headersToRecord(authHeaders),
      url: `${server.baseUrl}${mastraMcpEndpointPath}`,
    })

    assert.deepEqual(snapshot.toolNames, ['tool_user_directory'])
    assert.deepEqual(snapshot.resourceUris, [
      'resource://ai-native-os/enabled-tool-catalog',
      'resource://ai-native-os/runtime-summary',
    ])
    assert.deepEqual(snapshot.promptNames, ['system-report'])
    assert.deepEqual(snapshot.resourceTemplateNames, [])

    const client = await createExternalMcpClient({
      headers: headersToRecord(authHeaders),
      url: `${server.baseUrl}${mastraMcpEndpointPath}`,
    })

    try {
      const tools = await client.tools()
      const runtimeSummaryResource = await client.readResource({
        uri: 'resource://ai-native-os/runtime-summary',
      })
      const prompt = await client.getPrompt({
        arguments: {
          focus: 'rbac',
        },
        name: 'system-report',
      })
      const runtimeSummaryContent = runtimeSummaryResource.contents[0]

      assert.ok(runtimeSummaryContent && 'text' in runtimeSummaryContent)
      assert.equal(typeof runtimeSummaryContent.text, 'string')
      const runtimeSummaryText =
        typeof runtimeSummaryContent.text === 'string' ? runtimeSummaryContent.text : ''

      assert.ok(runtimeSummaryText.includes('"status": "degraded"'))
      assert.ok(runtimeSummaryText.includes('"enabledAgentIds": []'))
      assert.ok(runtimeSummaryText.includes('"workflow": []'))
      assert.ok(!('run_report_schedule' in tools))
      assert.ok('tool_user_directory' in tools)
      assert.equal(prompt.messages[0]?.role, 'user')
      assert.ok(prompt.messages[0]?.content.type === 'text')
      assert.ok(prompt.messages[0]?.content.text.includes('重点关注：rbac'))

      const userDirectoryTool = tools.tool_user_directory
      const userDirectoryResult = await userDirectoryTool.execute(
        {
          includeInactive: false,
          limit: 2,
        },
        createMcpToolCallOptions(),
      )
      const parsedUserDirectoryResult = parseMcpToolJsonResult(userDirectoryResult) as {
        users: Array<{
          id: string
        }>
      }

      assert.ok(parsedUserDirectoryResult.users.length > 0)
    } finally {
      await client.close()
    }
  } finally {
    await server.close()
  }
})

test('editor and super_admin discover and execute report schedule workflow through MCP', async () => {
  for (const roleCode of ['editor', 'super_admin'] as const) {
    const authHeaders = await createSessionForRole(roleCode)
    const server = await startTestServer()

    try {
      const snapshot = await discoverExternalMcpSnapshot({
        headers: headersToRecord(authHeaders),
        url: `${server.baseUrl}${mastraMcpEndpointPath}`,
      })

      assert.ok(snapshot.toolNames.includes('run_report_schedule'))
      assert.ok(snapshot.toolNames.includes('tool_user_directory'))

      const client = await createExternalMcpClient({
        headers: headersToRecord(authHeaders),
        url: `${server.baseUrl}${mastraMcpEndpointPath}`,
      })

      try {
        const tools = await client.tools()

        assert.ok('run_report_schedule' in tools)

        const workflowResult = await tools.run_report_schedule.execute(
          {
            reportLabel: `mcp-${roleCode}-report`,
            triggerSource: 'test',
          },
          createMcpToolCallOptions(),
        )
        const parsedWorkflowResult = reportScheduleWorkflowOutputSchema.parse(
          parseMcpToolJsonResult(workflowResult),
        )
        const workflowAuditRows = await listAiAuditLogsByToolId('workflow:report-schedule')

        assert.equal(parsedWorkflowResult.reportLabel, `mcp-${roleCode}-report`)
        assert.equal(parsedWorkflowResult.triggerSource, 'test')
        assert.ok(parsedWorkflowResult.snapshot.counts.users > 0)
        assert.equal(workflowAuditRows[0]?.status, 'success')
        assert.equal(workflowAuditRows[0]?.requestInfo?.triggerSource, 'test')
      } finally {
        await client.close()
      }
    } finally {
      await server.close()
    }
  }
})
