import type { NextResponse } from 'next/server'
import type { WebEnvironment } from '@/lib/env'

interface SignInRequest {
  email: string
  environment: WebEnvironment
  password: string
}

type CookieCapableHeaders = Headers & {
  getSetCookie?: () => string[]
}

function readSetCookieHeaders(headers: Headers): string[] {
  const cookieHeaders = headers as CookieCapableHeaders
  return typeof cookieHeaders.getSetCookie === 'function' ? cookieHeaders.getSetCookie() : []
}

export function appendSetCookieHeaders(response: NextResponse, headers: Headers): void {
  for (const setCookieHeader of readSetCookieHeaders(headers)) {
    response.headers.append('set-cookie', setCookieHeader)
  }
}

export async function performSignIn({
  email,
  environment,
  password,
}: SignInRequest): Promise<Response> {
  return fetch(`${environment.apiUrl}/api/auth/sign-in/email`, {
    body: JSON.stringify({
      email,
      password,
      rememberMe: true,
    }),
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      origin: environment.appUrl,
    },
    method: 'POST',
  })
}

export async function performSignOut(
  cookieHeader: string | null,
  environment: WebEnvironment,
): Promise<Response> {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: environment.appUrl,
  })

  if (cookieHeader) {
    headers.set('cookie', cookieHeader)
  }

  return fetch(`${environment.apiUrl}/api/auth/sign-out`, {
    body: JSON.stringify({}),
    cache: 'no-store',
    headers,
    method: 'POST',
  })
}
