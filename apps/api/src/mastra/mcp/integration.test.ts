import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { db, roles, userRoles, users } from '@ai-native-os/db'
import { serve } from '@hono/node-server'
import { eq } from 'drizzle-orm'

import { app } from '@/index'
import { createExternalMcpClient, discoverExternalMcpSnapshot } from '@/mastra/mcp/client'
import { mastraMcpEndpointPath } from '@/mastra/mcp/server'

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

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries())
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

test('authenticated external MCP client can discover tool, resource, and prompt wrappers', async () => {
  const authHeaders = await createSessionForRole('admin')
  const server = await startTestServer()

  try {
    const snapshot = await discoverExternalMcpSnapshot({
      headers: headersToRecord(authHeaders),
      url: `${server.baseUrl}${mastraMcpEndpointPath}`,
    })

    assert.deepEqual(snapshot.toolNames, [
      'ask_admin_copilot',
      'run_report_schedule',
      'tool_user_directory',
    ])
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

      assert.ok(runtimeSummaryText.includes('ask_admin_copilot'))
      assert.ok(runtimeSummaryText.includes('run_report_schedule'))
      assert.equal(prompt.messages[0]?.role, 'user')
      assert.ok(prompt.messages[0]?.content.type === 'text')
      assert.ok(prompt.messages[0]?.content.text.includes('重点关注：rbac'))
    } finally {
      await client.close()
    }
  } finally {
    await server.close()
  }
})
