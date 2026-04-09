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
 * 负责渲染未登录入口页，并验证共享表单与卡片原语已可在 web 侧消费。
 */
export function SignInPage({ defaultCredentialsHint, errorMessage }: SignInPageProps): ReactNode {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
        <Card className="rounded-[2rem]">
          <CardHeader className="gap-4 p-8">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Next.js App Shell
            </p>
            <CardTitle className="max-w-4xl text-5xl leading-[0.94] sm:text-6xl lg:text-7xl">
              Sign in to materialize your control surface.
            </CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7">
              Phase 4 now runs on the Next.js App Router baseline. Authentication remains delegated
              to Better Auth, while server-rendered ability filtering still decides which modules
              should appear.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Seeded Role Expectations
            </p>
            <CardTitle className="text-2xl">Role previews</CardTitle>
            <CardDescription>
              Baseline navigation is already filtered by server-side ability data.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">viewer</Badge> sees audit and role surfaces
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">admin</Badge> gains broader system management
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="accent">super_admin</Badge> receives full access
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Sign in</p>
            <CardTitle className="text-3xl">Access the dashboard</CardTitle>
            <CardDescription>
              Shared form primitives now live in <code>@ai-native-os/ui</code> and are consumed
              here.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                <FieldHint>Use any Better Auth account whose email maps to an RBAC user.</FieldHint>
              )}
              {defaultCredentialsHint ? (
                <FieldHint>
                  Local bootstrap admin (dev/test only): <code>{defaultCredentialsHint.email}</code>{' '}
                  / <code>{defaultCredentialsHint.password}</code>
                </FieldHint>
              ) : null}
              <Button className="w-full sm:w-auto" size="lg" type="submit">
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Phase 4 Scope
            </p>
            <CardTitle className="text-3xl">What lands in this milestone</CardTitle>
            <CardDescription>
              This task upgrades the shared design system and web baseline, not the business
              modules.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-muted-foreground">
            <p>
              Phase 4 now runs on the Next.js App Router baseline. Authentication remains delegated
              to Better Auth, while server-rendered ability filtering still decides which modules
              should appear.
            </p>
            <p>
              This task only establishes the web shell, providers, and authenticated layout. CRUD
              pages, Copilot UI, and generative interactions remain separate tasks.
            </p>
            <p>
              Navigation targets are already routable so smoke tests can verify the shell boots and
              moves between pages without 404 gaps.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
