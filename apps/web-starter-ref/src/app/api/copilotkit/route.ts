import { forwardApiRequest } from '@/lib/proxy-api'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  return forwardApiRequest({
    endpointPath: '/api/copilotkit',
    request,
  })
}

export async function POST(request: Request): Promise<Response> {
  return forwardApiRequest({
    endpointPath: '/api/copilotkit',
    request,
  })
}
