import { forwardApiRequest } from '@/lib/proxy-api'

export const dynamic = 'force-dynamic'

/**
 * 代理 AG-UI runtime 摘要，供前端同源发现当前可用的 agent bridge。
 */
export async function GET(request: Request): Promise<Response> {
  return forwardApiRequest({
    endpointPath: '/api/ag-ui/runtime',
    request,
  })
}
