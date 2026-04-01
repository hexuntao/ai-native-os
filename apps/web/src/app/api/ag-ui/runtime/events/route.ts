import { forwardApiRequest } from '@/lib/proxy-api'

export const dynamic = 'force-dynamic'

/**
 * 代理 AG-UI bootstrap SSE 流，保证浏览器仍然只访问 web 同源路径。
 */
export async function GET(request: Request): Promise<Response> {
  return forwardApiRequest({
    endpointPath: '/api/ag-ui/runtime/events',
    request,
  })
}
