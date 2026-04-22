import type { NextResponse } from 'next/server'

import type { WebEnvironment } from './env'

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

/**
 * 把上游 Better Auth 返回的 cookie 原样附加到 Next.js 响应上，避免在 web 层重建会话语义。
 */
export function appendSetCookieHeaders(response: NextResponse, headers: Headers): void {
  for (const setCookieHeader of readSetCookieHeaders(headers)) {
    response.headers.append('set-cookie', setCookieHeader)
  }
}

/**
 * 转发登录请求到 API 侧 Better Auth 端点。
 */
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

/**
 * 转发登出请求到 API 侧 Better Auth 端点。
 */
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
