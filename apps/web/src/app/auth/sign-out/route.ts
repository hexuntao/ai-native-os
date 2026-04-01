import { NextResponse } from 'next/server'

import { resolveWebEnvironment } from '@/lib/env'
import { appendSetCookieHeaders, performSignOut } from '@/lib/proxy-auth'

export async function POST(request: Request): Promise<Response> {
  const upstreamResponse = await performSignOut(
    request.headers.get('cookie'),
    resolveWebEnvironment(),
  )
  const response = NextResponse.redirect(new URL('/', request.url), 303)

  appendSetCookieHeaders(response, upstreamResponse.headers)

  return response
}
