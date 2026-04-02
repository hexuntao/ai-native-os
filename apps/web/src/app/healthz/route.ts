export interface WebHealthPayload {
  service: '@ai-native-os/web'
  status: 'ok'
  timestamp: string
}

/**
 * 生成 web 容器健康检查响应，避免探针依赖需要认证的业务页面。
 */
export function buildWebHealthPayload(now: Date = new Date()): WebHealthPayload {
  return {
    service: '@ai-native-os/web',
    status: 'ok',
    timestamp: now.toISOString(),
  }
}

/**
 * 提供只读健康检查路由，供 Docker 与反向代理判断 Next.js 运行时是否就绪。
 */
export async function GET(): Promise<Response> {
  return Response.json(buildWebHealthPayload(), {
    headers: {
      'cache-control': 'no-store',
    },
  })
}
