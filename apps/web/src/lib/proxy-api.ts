import { resolveWebEnvironment } from './env'

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

/**
 * 通过 Next.js 同源 route handler 把浏览器请求转发到 API 服务。
 *
 * 安全边界：
 * - 浏览器永远只请求 web 同源路径，避免新增跨域认证面
 * - 上游 cookie 原样转发到 API，让 Better Auth 与 RBAC 继续由后端统一裁决
 */
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
