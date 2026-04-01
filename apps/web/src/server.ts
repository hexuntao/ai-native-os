import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer } from 'node:http'

import { loadShellState } from '@/lib/api'
import { resolveWebEnvironment } from '@/lib/env'
import { proxyAuthRequest, proxySignOut, readFormBody, sendHtml, sendRedirect } from '@/lib/http'
import { renderIndexPage } from '@/lib/page'

export async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const environment = resolveWebEnvironment()
  const cookieHeader = request.headers.cookie

  try {
    const requestUrl = new URL(request.url ?? '/', environment.appUrl)

    if (request.method === 'POST' && requestUrl.pathname === '/login') {
      const formData = await readFormBody(request)
      const email = formData.get('email')
      const password = formData.get('password')

      if (!email || !password) {
        const state = await loadShellState(
          cookieHeader,
          environment,
          'Email and password are required.',
        )

        sendHtml(response, renderIndexPage(state), 400)
        return
      }

      const signInResponse = await proxyAuthRequest('/api/auth/sign-in/email', environment, {
        email,
        password,
        rememberMe: true,
      })

      if (!signInResponse.ok) {
        const state = await loadShellState(
          cookieHeader,
          environment,
          'Sign-in failed. Confirm the Better Auth account exists and the password is correct.',
        )

        sendHtml(response, renderIndexPage(state), 401)
        return
      }

      sendRedirect(response, '/', signInResponse.headers.getSetCookie())
      return
    }

    if (request.method === 'POST' && requestUrl.pathname === '/logout') {
      const signOutResponse = await proxySignOut(cookieHeader, environment)

      sendRedirect(response, '/', signOutResponse.headers.getSetCookie())
      return
    }

    const state = await loadShellState(cookieHeader, environment)

    sendHtml(response, renderIndexPage(state))
  } catch {
    const state = await loadShellState(
      cookieHeader,
      environment,
      'Web shell cannot reach the auth API right now. Retry after the API is available.',
    )

    sendHtml(response, renderIndexPage(state), 503)
  }
}

if (import.meta.main) {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10)

  createServer((request, response) => {
    void handleRequest(request, response)
  }).listen(port, () => {
    console.log(`AI Native OS web skeleton listening on http://localhost:${port}`)
  })
}
