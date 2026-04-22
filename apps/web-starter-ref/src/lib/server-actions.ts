import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveWebEnvironment } from '@/lib/env'

interface ApiErrorPayload {
  code?: string
  message?: string
}

export type RedirectTarget = Parameters<typeof redirect>[0]

export interface MutationRedirectState {
  action: 'created' | 'deleted' | 'updated'
  targetId?: string | undefined
}

async function readCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()

  return cookieStore.toString() || undefined
}

export function resolveDashboardReturnTo(
  value: FormDataEntryValue | null,
  pathname: string,
): string {
  if (typeof value !== 'string' || !value.startsWith(pathname)) {
    return pathname
  }

  return value
}

export function createActionRedirectTarget(
  returnTo: string,
  status: 'error' | 'success',
  message: string,
  mutation?: MutationRedirectState,
): RedirectTarget {
  const url = new URL(returnTo, 'http://localhost')

  url.searchParams.delete('error')
  url.searchParams.delete('success')
  url.searchParams.delete('mutation')
  url.searchParams.delete('target')
  url.searchParams.set(status, message)

  if (status === 'success' && mutation) {
    url.searchParams.set('mutation', mutation.action)

    if (mutation.targetId) {
      url.searchParams.set('target', mutation.targetId)
    }
  }

  return `${url.pathname}${url.search}` as RedirectTarget
}

export async function createManagementRequestInit(
  method: 'DELETE' | 'POST' | 'PUT',
  body?: string,
): Promise<RequestInit> {
  const environment = resolveWebEnvironment()
  const headers = new Headers({
    accept: 'application/json',
    'content-type': 'application/json',
    origin: environment.appUrl,
  })
  const cookieHeader = await readCookieHeader()

  if (cookieHeader) {
    headers.set('cookie', cookieHeader)
  }

  const requestInit: RequestInit = {
    cache: 'no-store',
    headers,
    method,
  }

  if (body !== undefined) {
    requestInit.body = body
  }

  return requestInit
}

export async function readApiErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null

  return payload?.message?.trim() || `Request failed with status ${response.status}`
}

export async function readCreatedEntityId(response: Response): Promise<string | null> {
  const payload = (await response.json().catch(() => null)) as { id?: string } | null

  return payload?.id ?? null
}

export function redirectWithMessage(
  returnTo: string,
  status: 'error' | 'success',
  message: string,
  mutation?: MutationRedirectState,
): never {
  redirect(createActionRedirectTarget(returnTo, status, message, mutation))
}
