import { type HonoBindings, type HonoVariables, MastraServer } from '@mastra/hono'
import type { MiddlewareHandler } from 'hono'

import { createMastraRequestContextFromAppContext } from '@/mastra/request-context'
import { type ApiEnv, applyResolvedAuthContext, resolveAuthContext } from '@/middleware/auth'
import { createAppContext } from '@/orpc/context'

type BaseMastraServerOptions = ConstructorParameters<typeof MastraServer>[0]

interface MastraApiEnv extends ApiEnv {
  Bindings: HonoBindings
  Variables: ApiEnv['Variables'] & HonoVariables
}

function isMastraRoutePath(pathname: string, routePrefix: string): boolean {
  return pathname === routePrefix || pathname.startsWith(`${routePrefix}/`)
}

export class SecureMastraServer extends MastraServer {
  private readonly routePrefix: string

  constructor(options: BaseMastraServerOptions) {
    super(options)
    this.routePrefix = options.prefix ?? '/api'
  }

  // 在 Mastra 自带 requestContext 初始化之后注入统一认证态，保证 AI 通道与 oRPC 使用同一套主体与权限信息。
  override createContextMiddleware(): MiddlewareHandler<MastraApiEnv> {
    const baseContextMiddleware = super.createContextMiddleware() as MiddlewareHandler<MastraApiEnv>

    return async (c, next) => {
      let unauthorizedResponse: Response | null = null

      await baseContextMiddleware(c, async () => {
        if (!isMastraRoutePath(c.req.path, this.routePrefix)) {
          await next()
          return
        }

        const resolvedAuthContext = await resolveAuthContext(c.req.raw.headers)

        applyResolvedAuthContext(c, resolvedAuthContext)

        if (!resolvedAuthContext.authSession) {
          unauthorizedResponse = c.json(
            {
              code: 'UNAUTHORIZED',
              message: 'Authentication required for Mastra routes',
            },
            401,
          )
          return
        }

        const appContext = await createAppContext(c)

        c.set(
          'requestContext',
          createMastraRequestContextFromAppContext(appContext) as HonoVariables['requestContext'],
        )

        await next()
      })

      return unauthorizedResponse ?? undefined
    }
  }
}
