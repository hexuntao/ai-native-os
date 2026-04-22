import { NextResponse } from 'next/server'
import { resolveWebEnvironment } from '@/lib/env'
import { appendSetCookieHeaders, performSignOut } from '@/lib/proxy-auth'

export async function POST(request: Request): Promise<Response> {
  const upstreamResponse = await performSignOut(
    request.headers.get('cookie'),
    resolveWebEnvironment(),
  )
  const destinationUrl = new URL('/', request.url)

  if (!upstreamResponse.ok) {
    destinationUrl.searchParams.set('error', `Sign out failed (HTTP ${upstreamResponse.status}).`)
  }

  const response = NextResponse.redirect(destinationUrl, 303)

  appendSetCookieHeaders(response, upstreamResponse.headers)

  return response
}
