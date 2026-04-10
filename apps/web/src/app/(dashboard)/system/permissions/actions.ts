'use server'

import {
  createPermissionInputSchema,
  deletePermissionInputSchema,
  updatePermissionInputSchema,
} from '@ai-native-os/shared'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { resolveWebEnvironment } from '@/lib/env'

interface ApiErrorPayload {
  code?: string
  message?: string
}

const permissionsDirectoryPath = '/system/permissions'
type RedirectTarget = Parameters<typeof redirect>[0]

/**
 * 规范化回跳地址，只允许当前站内的 `/system/permissions` 路径，避免表单回跳被污染。
 */
function resolveReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string' || !value.startsWith(permissionsDirectoryPath)) {
    return permissionsDirectoryPath
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
 * 读取当前服务端请求携带的 cookie 头，确保权限写操作继续复用同一套 Better Auth 会话。
 */
async function readCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()

  return cookieStore.toString() || undefined
}

/**
 * 创建指向 API 服务的 JSON 请求配置，避免每个权限动作重复拼接认证头。
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
 * 统一解析上游 API 错误消息，保证权限表单失败时能给出稳定反馈。
 */
async function readApiErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null

  return payload?.message?.trim() || `Request failed with status ${response.status}`
}

/**
 * 解析字段列表输入，兼容换行和逗号两种录入方式。
 */
function readFieldsValue(formData: FormData): string[] | null {
  const rawValue = String(formData.get('fields') ?? '').trim()

  if (!rawValue) {
    return null
  }

  const fields = rawValue
    .split(/[\n,]/u)
    .map((field) => field.trim())
    .filter(Boolean)

  return fields.length > 0 ? fields : null
}

/**
 * 解析条件 JSON 输入，空值返回 `null`，非法 JSON 直接抛出以输出稳定错误提示。
 */
function readConditionsValue(formData: FormData): Record<string, unknown> | null {
  const rawValue = String(formData.get('conditions') ?? '').trim()

  if (!rawValue) {
    return null
  }

  const parsedValue = JSON.parse(rawValue) as unknown

  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    throw new Error('Conditions JSON must be an object')
  }

  return parsedValue as Record<string, unknown>
}

/**
 * 从表单中读取规范化的权限写入载荷，避免页面层重复处理空字符串和 JSON 解析。
 */
function readPermissionMutationInput(formData: FormData): {
  action: string
  conditions: Record<string, unknown> | null
  description: string | null
  fields: string[] | null
  inverted: boolean
  resource: string
} {
  const description = String(formData.get('description') ?? '').trim()

  return {
    action: String(formData.get('action') ?? ''),
    conditions: readConditionsValue(formData),
    description: description.length > 0 ? description : null,
    fields: readFieldsValue(formData),
    inverted: String(formData.get('mode') ?? 'allow') === 'deny',
    resource: String(formData.get('resource') ?? ''),
  }
}

/**
 * 提交创建权限动作，并在成功后回跳列表页刷新结果。
 */
export async function createPermissionAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))

  try {
    const parsedInput = createPermissionInputSchema.safeParse(readPermissionMutationInput(formData))

    if (!parsedInput.success) {
      redirect(createRedirectTarget(returnTo, 'error', '创建权限表单校验失败，请检查输入内容。'))
    }

    const environment = resolveWebEnvironment()
    const response = await fetch(
      `${environment.apiUrl}/api/v1/system/permissions`,
      await createManagementRequestInit('POST', JSON.stringify(parsedInput.data)),
    )

    if (!response.ok) {
      redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建权限请求无效，请检查条件 JSON。'

    redirect(createRedirectTarget(returnTo, 'error', message))
  }

  revalidatePath(permissionsDirectoryPath)
  redirect(createRedirectTarget(returnTo, 'success', '权限规则已创建。'))
}

/**
 * 提交更新权限动作，并在成功后刷新列表页展示。
 */
export async function updatePermissionAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))

  try {
    const parsedInput = updatePermissionInputSchema.safeParse({
      ...readPermissionMutationInput(formData),
      id: String(formData.get('id') ?? ''),
    })

    if (!parsedInput.success) {
      redirect(createRedirectTarget(returnTo, 'error', '更新权限表单校验失败，请检查输入内容。'))
    }

    const environment = resolveWebEnvironment()
    const response = await fetch(
      `${environment.apiUrl}/api/v1/system/permissions/${parsedInput.data.id}`,
      await createManagementRequestInit('PUT', JSON.stringify(parsedInput.data)),
    )

    if (!response.ok) {
      redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新权限请求无效，请检查条件 JSON。'

    redirect(createRedirectTarget(returnTo, 'error', message))
  }

  revalidatePath(permissionsDirectoryPath)
  redirect(createRedirectTarget(returnTo, 'success', '权限规则已更新。'))
}

/**
 * 提交删除权限动作，并在成功后回到列表页确认结果。
 */
export async function deletePermissionAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))
  const parsedInput = deletePermissionInputSchema.safeParse({
    id: String(formData.get('id') ?? ''),
  })

  if (!parsedInput.success) {
    redirect(createRedirectTarget(returnTo, 'error', '删除权限请求无效，请刷新后重试。'))
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/permissions/${parsedInput.data.id}`,
    await createManagementRequestInit('DELETE'),
  )

  if (!response.ok) {
    redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
  }

  revalidatePath(permissionsDirectoryPath)
  redirect(createRedirectTarget(returnTo, 'success', '权限规则已删除。'))
}
