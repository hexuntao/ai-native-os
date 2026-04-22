import type { LocalBootstrapCredentials } from '@ai-native-os/shared'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface SignInPageProps {
  defaultCredentialsHint?: LocalBootstrapCredentials
  errorMessage?: string
}

export function SignInPage({ defaultCredentialsHint, errorMessage }: SignInPageProps): ReactNode {
  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-6">
        <section className="grid gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="gap-6 p-8 lg:p-10">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">AI Native OS</Badge>
                <Badge variant="outline">控制平面</Badge>
              </div>
              <div className="grid max-w-4xl gap-4">
                <p className="text-muted-foreground text-[11px] tracking-[0.2em] uppercase">
                  已认证操作员工作台
                </p>
                <CardTitle className="text-5xl leading-[0.95] tracking-tight sm:text-6xl">
                  登录后才能真正操作系统，而不只是旁观。
                </CardTitle>
                <CardDescription className="max-w-3xl text-base leading-7">
                  这个控制台围绕 RBAC 管理、AI 治理、审计复核与运行分诊进行优化。
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="gap-3">
                <p className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">
                  系统控制
                </p>
                <CardTitle className="text-xl">身份与 RBAC</CardTitle>
                <CardDescription>管理主体、角色拓扑、权限与导航策略。</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="gap-3">
                <p className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">
                  可观测性
                </p>
                <CardTitle className="text-xl">健康与审计</CardTitle>
                <CardDescription>查看运行健康、在线会话、审计轨迹与操作信号。</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="gap-3">
                <p className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">
                  AI 治理
                </p>
                <CardTitle className="text-xl">Prompt、评测与知识</CardTitle>
                <CardDescription>用证据、发布门禁和面向助手的工作流治理 AI 行为。</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="flex items-start lg:items-center">
          <Card className="w-full">
            <CardHeader className="gap-4 border-b">
              <p className="text-muted-foreground text-[11px] tracking-[0.18em] uppercase">登录</p>
              <CardTitle className="text-3xl tracking-tight">进入操作员工作台</CardTitle>
              <CardDescription>使用已映射到 RBAC 用户目录的 Better Auth 凭证登录。</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 p-6">
              <form action="/auth/sign-in" className="grid gap-5" method="POST">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="email">
                    邮箱
                  </label>
                  <Input autoComplete="email" id="email" name="email" required type="email" />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="password">
                    密码
                  </label>
                  <Input
                    autoComplete="current-password"
                    id="password"
                    name="password"
                    required
                    type="password"
                  />
                </div>

                {errorMessage ? (
                  <p className="text-destructive text-sm">{errorMessage}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    登录后，导航、AI 能力和写操作都会按同一套权限上下文过滤。
                  </p>
                )}

                {defaultCredentialsHint ? (
                  <div className="bg-muted rounded-lg border px-4 py-3 text-sm leading-6">
                    <p className="font-medium">Local bootstrap (dev/test only)</p>
                    <p className="mt-1">
                      邮箱：<code>{defaultCredentialsHint.email}</code>
                    </p>
                    <p>
                      密码：<code>{defaultCredentialsHint.password}</code>
                    </p>
                  </div>
                ) : null}

                <Button className="w-full" size="lg" type="submit">
                  登录
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
