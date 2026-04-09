import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import { jobsRuntime } from './runtime'

export interface JobsServerEnvironment {
  host: string
  port: number
}

export interface JobsHealthPayload {
  runtime: typeof jobsRuntime
  service: typeof jobsRuntime.name
  status: 'ok'
  timestamp: string
}

interface JobsErrorPayload {
  code: 'method_not_allowed' | 'not_found'
  message: string
}

/**
 * 解析 jobs 服务监听端口，避免容器配置传入非法值后静默启动失败。
 */
function parseJobsServerPort(rawPort: string | undefined): number {
  const port = Number.parseInt(rawPort ?? '3040', 10)

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('JOBS_PORT must be a positive integer for @ai-native-os/jobs')
  }

  return port
}

/**
 * 解析 jobs 自托管服务运行环境。
 */
export function resolveJobsServerEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): JobsServerEnvironment {
  return {
    host: environment.HOST?.trim() || '0.0.0.0',
    port: parseJobsServerPort(environment.JOBS_PORT),
  }
}

/**
 * 生成 jobs 健康检查响应，供 Docker / 反向代理探测最小运行面。
 */
export function buildJobsHealthPayload(now: Date = new Date()): JobsHealthPayload {
  return {
    runtime: jobsRuntime,
    service: jobsRuntime.name,
    status: 'ok',
    timestamp: now.toISOString(),
  }
}

/**
 * 向调用方写入统一 JSON 响应，避免健康端点和错误响应格式漂移。
 */
function writeJsonResponse(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
  payload: JobsErrorPayload | JobsHealthPayload,
): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

/**
 * 解析原始 Node 请求 URL，确保健康服务不依赖外层框架也能稳定路由。
 */
function resolveRequestUrl(request: IncomingMessage): URL {
  const host = request.headers.host ?? 'localhost'
  const pathname = request.url ?? '/'

  return new URL(pathname, `http://${host}`)
}

/**
 * 处理 jobs 自托管 HTTP 请求。
 *
 * 职责边界：
 * - 只暴露最小健康与运行时摘要
 * - 不提供 Trigger 任务执行入口，不在这里扩展正式业务 API
 */
export function handleJobsRequest(
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
): void {
  const requestUrl = resolveRequestUrl(request)
  const method = request.method ?? 'GET'
  const isHealthPath = requestUrl.pathname === '/' || requestUrl.pathname === '/health'

  if (isHealthPath && method !== 'GET') {
    writeJsonResponse(response, 405, {
      code: 'method_not_allowed',
      message: 'Only GET is allowed on jobs health endpoints.',
    })

    return
  }

  if (isHealthPath) {
    writeJsonResponse(response, 200, buildJobsHealthPayload())

    return
  }

  writeJsonResponse(response, 404, {
    code: 'not_found',
    message: 'Unknown jobs runtime route.',
  })
}

/**
 * 创建 jobs 自托管 HTTP server。
 */
export function createJobsServer(): Server {
  return createServer((request, response) => {
    handleJobsRequest(request, response)
  })
}

/**
 * 启动 jobs 自托管 HTTP server，供 Docker 自托管模式与健康探测复用。
 */
export function startJobsServer(environment: NodeJS.ProcessEnv = process.env): Promise<Server> {
  const { host, port } = resolveJobsServerEnvironment(environment)

  return new Promise<Server>((resolve, reject) => {
    const server = createJobsServer()

    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      console.info(`[jobs] self-hosted runtime listening on http://${host}:${port}`)
      resolve(server)
    })
  })
}

/**
 * 优雅关闭 jobs HTTP server，避免容器退出时留下悬挂连接。
 */
async function shutdownJobsServer(server: Server, signal: NodeJS.Signals): Promise<void> {
  console.info(`[jobs] received ${signal}, shutting down self-hosted runtime`)

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

if (import.meta.main) {
  const server = await startJobsServer()

  process.once('SIGINT', () => {
    void shutdownJobsServer(server, 'SIGINT').finally(() => {
      process.exit(0)
    })
  })

  process.once('SIGTERM', () => {
    void shutdownJobsServer(server, 'SIGTERM').finally(() => {
      process.exit(0)
    })
  })
}
