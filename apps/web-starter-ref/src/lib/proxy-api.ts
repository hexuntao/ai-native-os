import { resolveWebEnvironment } from '@/lib/env'

interface ForwardApiRequestOptions {
  endpointPath: string
  request: Request
}

function createForwardHeaders(request: Request): Headers {
  const headers = new Headers()

  for (const [key, value] of request.headers.entries()) {
    if (key === 'connection' || key === 'content-length' || key === 'host') {
      continue
    }

    headers.set(key, value)
  }

  const environment = resolveWebEnvironment()

  headers.set('origin', environment.appUrl)

  return headers
}

export async function forwardApiRequest({
  endpointPath,
  request,
}: ForwardApiRequestOptions): Promise<Response> {
  const environment = resolveWebEnvironment()
  const requestBody =
    request.method === 'GET' || request.method === 'HEAD' ? null : await request.text()
  const upstreamResponse = await fetch(`${environment.apiUrl}${endpointPath}`, {
    body: requestBody,
    cache: 'no-store',
    headers: createForwardHeaders(request),
    method: request.method,
  })

  return new Response(upstreamResponse.body, {
    headers: new Headers(upstreamResponse.headers),
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
  })
}
