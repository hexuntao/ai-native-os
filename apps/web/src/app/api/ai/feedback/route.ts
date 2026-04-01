import { forwardApiRequest } from '@/lib/proxy-api'

export const dynamic = 'force-dynamic'

/**
 * 代理 AI feedback 读写接口，保证浏览器仍然只访问 web 同源路径。
 */
export async function GET(request: Request): Promise<Response> {
  return forwardApiRequest({
    endpointPath: '/api/v1/ai/feedback',
    request,
  })
}

/**
 * 代理 AI feedback 写入请求，避免在 web 层实现正式业务逻辑。
 */
export async function POST(request: Request): Promise<Response> {
  return forwardApiRequest({
    endpointPath: '/api/v1/ai/feedback',
    request,
  })
}
