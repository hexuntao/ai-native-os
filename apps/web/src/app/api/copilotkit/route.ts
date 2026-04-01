import { forwardApiRequest } from '@/lib/proxy-api'

export const dynamic = 'force-dynamic'

/**
 * 通过 web 同源路径代理 CopilotKit runtime，供浏览器侧聊天组件使用。
 */
export async function GET(request: Request): Promise<Response> {
  return forwardApiRequest({
    endpointPath: '/api/copilotkit',
    request,
  })
}

/**
 * 转发聊天请求到 API 侧 Copilot runtime。
 */
export async function POST(request: Request): Promise<Response> {
  return forwardApiRequest({
    endpointPath: '/api/copilotkit',
    request,
  })
}
