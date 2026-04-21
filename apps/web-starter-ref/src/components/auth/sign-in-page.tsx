import type { LocalBootstrapCredentials } from '@ai-native-os/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ReactNode } from 'react';

interface SignInPageProps {
  defaultCredentialsHint?: LocalBootstrapCredentials;
  errorMessage?: string;
}

export function SignInPage({ defaultCredentialsHint, errorMessage }: SignInPageProps): ReactNode {
  return (
    <main className='bg-background min-h-screen'>
      <div className='mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-6'>
        <section className='grid gap-6'>
          <Card className='overflow-hidden'>
            <CardHeader className='gap-6 p-8 lg:p-10'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='secondary'>AI Native OS</Badge>
                <Badge variant='outline'>Control Plane</Badge>
              </div>
              <div className='grid max-w-4xl gap-4'>
                <p className='text-muted-foreground text-[11px] tracking-[0.2em] uppercase'>
                  Authenticated operator workspace
                </p>
                <CardTitle className='text-5xl leading-[0.95] tracking-tight sm:text-6xl'>
                  Sign in to operate the system, not just look at it.
                </CardTitle>
                <CardDescription className='max-w-3xl text-base leading-7'>
                  This console is optimized for RBAC-controlled administration, AI governance, audit
                  review, and operational triage.
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          <div className='grid gap-4 md:grid-cols-3'>
            <Card>
              <CardHeader className='gap-3'>
                <p className='text-muted-foreground text-[11px] tracking-[0.16em] uppercase'>
                  System control
                </p>
                <CardTitle className='text-xl'>Identity and RBAC</CardTitle>
                <CardDescription>
                  Manage principals, role topology, permissions, and navigation policy.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className='gap-3'>
                <p className='text-muted-foreground text-[11px] tracking-[0.16em] uppercase'>
                  Observability
                </p>
                <CardTitle className='text-xl'>Health and audit</CardTitle>
                <CardDescription>
                  Review runtime health, online sessions, audit trails, and operational signals.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className='gap-3'>
                <p className='text-muted-foreground text-[11px] tracking-[0.16em] uppercase'>
                  AI governance
                </p>
                <CardTitle className='text-xl'>Prompts, evals, knowledge</CardTitle>
                <CardDescription>
                  Govern AI behavior with evidence, release gates, and assistant-aware workflows.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className='flex items-start lg:items-center'>
          <Card className='w-full'>
            <CardHeader className='gap-4 border-b'>
              <p className='text-muted-foreground text-[11px] tracking-[0.18em] uppercase'>
                Sign in
              </p>
              <CardTitle className='text-3xl tracking-tight'>
                Access the operator workspace
              </CardTitle>
              <CardDescription>
                Sign in with a Better Auth credential that is mapped into the RBAC user directory.
              </CardDescription>
            </CardHeader>

            <CardContent className='grid gap-5 p-6'>
              <form action='/auth/sign-in' className='grid gap-5' method='POST'>
                <div className='grid gap-2'>
                  <label className='text-sm font-medium' htmlFor='email'>
                    Email
                  </label>
                  <Input autoComplete='email' id='email' name='email' required type='email' />
                </div>

                <div className='grid gap-2'>
                  <label className='text-sm font-medium' htmlFor='password'>
                    Password
                  </label>
                  <Input
                    autoComplete='current-password'
                    id='password'
                    name='password'
                    required
                    type='password'
                  />
                </div>

                {errorMessage ? (
                  <p className='text-destructive text-sm'>{errorMessage}</p>
                ) : (
                  <p className='text-muted-foreground text-sm'>
                    登录后，导航、AI 能力和写操作都会按同一套权限上下文过滤。
                  </p>
                )}

                {defaultCredentialsHint ? (
                  <div className='bg-muted rounded-lg border px-4 py-3 text-sm leading-6'>
                    <p className='font-medium'>Local bootstrap (dev/test only)</p>
                    <p className='mt-1'>
                      Email: <code>{defaultCredentialsHint.email}</code>
                    </p>
                    <p>
                      Password: <code>{defaultCredentialsHint.password}</code>
                    </p>
                  </div>
                ) : null}

                <Button className='w-full' size='lg' type='submit'>
                  Sign in
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
