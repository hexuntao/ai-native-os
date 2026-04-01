import { randomUUID } from 'node:crypto'

import { auth } from './server'

function buildAuthUrl(pathname: string): string {
  return new URL(pathname, auth.options.baseURL).toString()
}

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

async function readJsonOrThrow(response: Response): Promise<unknown> {
  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`Auth smoke request failed: ${response.status} ${payload}`)
  }

  return response.json()
}

async function main(): Promise<void> {
  const email = `phase2-${randomUUID()}@example.com`
  const password = 'Passw0rd!Passw0rd!'
  const origin = process.env.APP_URL ?? 'http://localhost:3000'

  const signUpResponse = await auth.handler(
    new Request(buildAuthUrl('/api/auth/sign-up/email'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin,
      },
      body: JSON.stringify({
        callbackURL: origin,
        email,
        name: 'Phase 2 QA User',
        password,
      }),
    }),
  )

  await readJsonOrThrow(signUpResponse)

  const signInResponse = await auth.handler(
    new Request(buildAuthUrl('/api/auth/sign-in/email'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin,
      },
      body: JSON.stringify({
        email,
        password,
        rememberMe: true,
      }),
    }),
  )

  await readJsonOrThrow(signInResponse)

  const sessionCookie = signInResponse.headers.get('set-cookie')

  if (!sessionCookie) {
    throw new Error('Auth smoke test did not receive a session cookie after sign-in')
  }

  const cookieHeaders = new Headers()
  cookieHeaders.set('set-cookie', sessionCookie)
  const requestHeaders = convertSetCookieToCookie(cookieHeaders)
  requestHeaders.set('origin', origin)

  const getSessionResponse = await auth.handler(
    new Request(buildAuthUrl('/api/auth/get-session'), {
      headers: requestHeaders,
      method: 'GET',
    }),
  )

  const sessionPayload = await readJsonOrThrow(getSessionResponse)

  console.log(
    JSON.stringify(
      {
        email,
        session: sessionPayload,
        status: 'ok',
      },
      null,
      2,
    ),
  )
}

void main()
