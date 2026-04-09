import { resolveLocalBootstrapAdminCredentials } from '@ai-native-os/shared'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { SignInPage } from '@/components/auth/sign-in-page'
import { loadCurrentShellState } from '@/lib/server-shell'
import { resolveDashboardLandingHref, resolveLoginErrorMessage } from '@/lib/shell'

interface IndexPageProps {
  searchParams: Promise<{
    error?: string
  }>
}

/**
 * 根路由负责在登录页与已登录 dashboard 之间做服务端分流。
 */
export default async function IndexPage({ searchParams }: IndexPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const defaultCredentialsHint = resolveLocalBootstrapAdminCredentials()
  const errorMessage = resolveLoginErrorMessage(resolvedSearchParams.error)
  const shellState = await loadCurrentShellState(errorMessage)

  if (shellState.kind === 'authenticated') {
    redirect(resolveDashboardLandingHref(shellState) as Route)
  }

  return shellState.errorMessage ? (
    <SignInPage
      defaultCredentialsHint={defaultCredentialsHint}
      errorMessage={shellState.errorMessage}
    />
  ) : (
    <SignInPage defaultCredentialsHint={defaultCredentialsHint} />
  )
}
