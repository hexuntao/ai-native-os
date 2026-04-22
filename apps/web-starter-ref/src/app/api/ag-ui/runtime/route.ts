import { forwardApiRequest } from '@/lib/proxy-api'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  return forwardApiRequest({
    endpointPath: '/api/ag-ui/runtime',
    request,
  })
}
