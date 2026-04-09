'use server'

import {
  createUserInputSchema,
  deleteUserInputSchema,
  updateUserInputSchema,
} from '@ai-native-os/shared'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { resolveWebEnvironment } from '@/lib/env'

interface ApiErrorPayload {
  code?: string
  message?: string
}

const usersDirectoryPath = '/system/users'
type RedirectTarget = Parameters<typeof redirect>[0]

/**
 * 规范化回跳地址，只允许当前站内的 `/system/users` 路径，避免表单回跳被污染。
 */
function resolveReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string' || !value.startsWith(usersDirectoryPath)) {
    return usersDirectoryPath
  }

  return value
}

/**
 * 把表单动作结果编码回列表页 query，便于服务端页面输出统一提示。
 */
function createRedirectTarget(
  returnTo: string,
  status: 'error' | 'success',
  message: string,
): RedirectTarget {
  const url = new URL(returnTo, 'http://localhost')

  url.searchParams.delete('error')
  url.searchParams.delete('success')
  url.searchParams.set(status, message)

  return `${url.pathname}${url.search}` as RedirectTarget
}

/**
 * 读取当前服务端请求携带的 cookie 头，确保写操作仍复用同一套 Better Auth 会话。
 */
async function readCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()

  return cookieStore.toString() || undefined
}

/**
 * 创建指向 API 服务的 JSON 请求配置，避免每个动作重复拼接认证头。
 */
async function createManagementRequestInit(
  method: 'DELETE' | 'POST' | 'PUT',
  body?: string,
): Promise<RequestInit> {
  const environment = resolveWebEnvironment()
  const headers = new Headers({
    'content-type': 'application/json',
    accept: 'application/json',
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

/**
 * 统一解析上游 API 错误消息，保证表单失败时能给出稳定反馈。
 */
async function readApiErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null

  return payload?.message?.trim() || `Request failed with status ${response.status}`
}

/**
 * 从表单中提取多选角色编码，并过滤掉空值。
 */
function readRoleCodes(formData: FormData): string[] {
  return formData
    .getAll('roleCodes')
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
}

/**
 * 从表单中读取规范化的用户写入载荷，避免页面层重复处理空字符串与布尔值。
 */
function readUserMutationInput(formData: FormData): {
  email: string
  nickname: string
  password: string | undefined
  roleCodes: string[]
  status: boolean
  username: string
} {
  const passwordValue = formData.get('password')

  return {
    email: String(formData.get('email') ?? ''),
    nickname: String(formData.get('nickname') ?? ''),
    password:
      typeof passwordValue === 'string' && passwordValue.trim().length > 0
        ? passwordValue
        : undefined,
    roleCodes: readRoleCodes(formData),
    status: String(formData.get('status') ?? 'active') === 'active',
    username: String(formData.get('username') ?? ''),
  }
}

/**
 * 提交创建用户动作，并在成功后回跳列表页刷新结果。
 */
export async function createUserAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))
  const parsedInput = createUserInputSchema.safeParse({
    ...readUserMutationInput(formData),
    password: String(formData.get('password') ?? ''),
  })

  if (!parsedInput.success) {
    redirect(createRedirectTarget(returnTo, 'error', '创建用户表单校验失败，请检查输入内容。'))
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/users`,
    await createManagementRequestInit('POST', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
  }

  revalidatePath(usersDirectoryPath)
  redirect(createRedirectTarget(returnTo, 'success', '用户已创建并同步到认证体系。'))
}

/**
 * 提交更新用户动作，并在成功后刷新列表页展示。
 */
export async function updateUserAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))
  const userId = String(formData.get('id') ?? '')
  const parsedInput = updateUserInputSchema.safeParse({
    ...readUserMutationInput(formData),
    id: userId,
  })

  if (!parsedInput.success) {
    redirect(createRedirectTarget(returnTo, 'error', '更新用户表单校验失败，请检查输入内容。'))
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/users/${parsedInput.data.id}`,
    await createManagementRequestInit('PUT', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
  }

  revalidatePath(usersDirectoryPath)
  redirect(createRedirectTarget(returnTo, 'success', '用户信息已更新。'))
}

/**
 * 提交删除用户动作，并在成功后回到列表页确认结果。
 */
export async function deleteUserAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))
  const parsedInput = deleteUserInputSchema.safeParse({
    id: String(formData.get('id') ?? ''),
  })

  if (!parsedInput.success) {
    redirect(createRedirectTarget(returnTo, 'error', '删除用户请求无效，请刷新后重试。'))
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/users/${parsedInput.data.id}`,
    await createManagementRequestInit('DELETE'),
  )

  if (!response.ok) {
    redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
  }

  revalidatePath(usersDirectoryPath)
  redirect(createRedirectTarget(returnTo, 'success', '用户已删除。'))
}
