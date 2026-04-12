import type { LocalBootstrapCredentials } from '@ai-native-os/shared'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  Input,
} from '@ai-native-os/ui'
import type { ReactNode } from 'react'

interface SignInPageProps {
  defaultCredentialsHint?: LocalBootstrapCredentials | undefined
  errorMessage?: string | undefined
}

/**
 * 渲染控制台入口页，并把未登录态也纳入同一套 AI Ops Console 视觉语言。
 */
export function SignInPage({ defaultCredentialsHint, errorMessage }: SignInPageProps): ReactNode {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-6">
        <section className="grid gap-6">
          <Card className="overflow-hidden border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.84))]">
            <CardHeader className="gap-6 p-8 lg:p-10">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">AI Native OS</Badge>
                <Badge variant="secondary">Control Console</Badge>
              </div>
              <div className="grid max-w-4xl gap-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Authenticated operator workspace
                </p>
                <CardTitle className="text-5xl leading-[0.95] tracking-tight sm:text-6xl">
                  Sign in to operate the system, not just look at it.
                </CardTitle>
                <CardDescription className="max-w-3xl text-base leading-7">
                  This console is optimized for RBAC-controlled administration, AI governance, audit
                  review, and operational triage. The shell, permissions, and Copilot runtime all
                  resolve from the same authenticated request context.
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/80 bg-card/94 shadow-[var(--shadow-soft)]">
              <CardHeader className="gap-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  System control
                </p>
                <CardTitle className="text-xl">Identity and RBAC</CardTitle>
                <CardDescription>
                  Manage principals, role topology, permissions, and navigation policy.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/80 bg-card/94 shadow-[var(--shadow-soft)]">
              <CardHeader className="gap-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Observability
                </p>
                <CardTitle className="text-xl">Health and audit</CardTitle>
                <CardDescription>
                  Review runtime health, online sessions, audit trails, and operational signals.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/80 bg-card/94 shadow-[var(--shadow-soft)]">
              <CardHeader className="gap-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  AI governance
                </p>
                <CardTitle className="text-xl">Prompts, evals, knowledge</CardTitle>
                <CardDescription>
                  Govern AI behavior with evidence, release gates, and assistant-aware workflows.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="flex items-start lg:items-center">
          <Card className="w-full border-border/80 bg-card/96 shadow-[var(--shadow-panel)]">
            <CardHeader className="gap-4 border-b border-border/70">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Sign in
              </p>
              <CardTitle className="text-3xl tracking-tight">
                Access the operator workspace
              </CardTitle>
              <CardDescription>
                Sign in with a Better Auth credential that is mapped into the RBAC user directory.
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 p-6">
              <form action="/auth/sign-in" className="grid gap-5" method="POST">
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input autoComplete="email" id="email" name="email" required type="email" />
                </Field>

                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    autoComplete="current-password"
                    id="password"
                    name="password"
                    required
                    type="password"
                  />
                </Field>

                {errorMessage ? (
                  <FieldError>{errorMessage}</FieldError>
                ) : (
                  <FieldHint>
                    登录后，导航、AI 能力、Copilot 发现面与写操作都会按同一套权限上下文过滤。
                  </FieldHint>
                )}

                {defaultCredentialsHint ? (
                  <div className="rounded-[var(--radius-lg)] border border-border/80 bg-secondary/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
                    <p className="font-medium text-foreground">Local bootstrap (dev/test only)</p>
                    <p className="mt-1">
                      Email: <code>{defaultCredentialsHint.email}</code>
                    </p>
                    <p>
                      Password: <code>{defaultCredentialsHint.password}</code>
                    </p>
                  </div>
                ) : null}

                <Button className="w-full" size="lg" type="submit">
                  Sign in
                </Button>
              </form>

              <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border/80 bg-background/80 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Access model
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">viewer</Badge>
                  <Badge variant="secondary">admin</Badge>
                  <Badge variant="secondary">editor</Badge>
                  <Badge variant="accent">super_admin</Badge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Different roles see different modules, different write surfaces, and different AI
                  capability exposure. The login page does not promise access that RBAC will later
                  deny.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
