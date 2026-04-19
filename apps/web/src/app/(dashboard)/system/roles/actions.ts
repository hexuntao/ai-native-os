'use server'

import {
  createRoleInputSchema,
  deleteRoleInputSchema,
  updateRoleInputSchema,
} from '@ai-native-os/shared'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { resolveWebEnvironment } from '@/lib/env'

interface ApiErrorPayload {
  code?: string
  message?: string
}

const rolesDirectoryPath = '/system/roles'
type RedirectTarget = Parameters<typeof redirect>[0]

/**
 * 规范化回跳地址，只允许当前站内的 `/system/roles` 路径，避免表单回跳被污染。
 */
function resolveReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string' || !value.startsWith(rolesDirectoryPath)) {
    return rolesDirectoryPath
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
  mutation?: {
    action: 'created' | 'deleted' | 'updated'
    targetId?: string | undefined
  },
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

/**
 * 读取当前服务端请求携带的 cookie 头，确保角色写操作继续复用同一套 Better Auth 会话。
 */
async function readCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()

  return cookieStore.toString() || undefined
}

/**
 * 创建指向 API 服务的 JSON 请求配置，避免每个角色动作重复拼接认证头。
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
 * 统一解析上游 API 错误消息，保证角色表单失败时能给出稳定反馈。
 */
async function readApiErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null

  return payload?.message?.trim() || `Request failed with status ${response.status}`
}

/**
 * 读取成功创建后的角色主键，供列表页输出行级反馈锚点。
 */
async function readCreatedRoleId(response: Response): Promise<string | null> {
  const payload = (await response.json().catch(() => null)) as { id?: string } | null

  return payload?.id ?? null
}

/**
 * 从表单中提取多选权限主键，并过滤掉空值。
 */
function readPermissionIds(formData: FormData): string[] {
  return formData
    .getAll('permissionIds')
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
}

/**
 * 从表单中读取规范化的角色写入载荷，避免页面层重复处理空字符串和数值转换。
 */
function readRoleMutationInput(formData: FormData): {
  code: string
  description: string
  name: string
  permissionIds: string[]
  sortOrder: string
  status: boolean
} {
  return {
    code: String(formData.get('code') ?? ''),
    description: String(formData.get('description') ?? ''),
    name: String(formData.get('name') ?? ''),
    permissionIds: readPermissionIds(formData),
    sortOrder: String(formData.get('sortOrder') ?? '0'),
    status: String(formData.get('status') ?? 'active') === 'active',
  }
}

/**
 * 提交创建角色动作，并在成功后回跳列表页刷新结果。
 */
export async function createRoleAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))
  const parsedInput = createRoleInputSchema.safeParse(readRoleMutationInput(formData))

  if (!parsedInput.success) {
    redirect(createRedirectTarget(returnTo, 'error', '创建角色表单校验失败，请检查输入内容。'))
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/roles`,
    await createManagementRequestInit('POST', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
  }

  const createdRoleId = await readCreatedRoleId(response)
  revalidatePath(rolesDirectoryPath)
  redirect(
    createRedirectTarget(returnTo, 'success', '角色已创建并写入权限绑定。', {
      action: 'created',
      targetId: createdRoleId ?? undefined,
    }),
  )
}

/**
 * 提交更新角色动作，并在成功后刷新列表页展示。
 */
export async function updateRoleAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))
  const roleId = String(formData.get('id') ?? '')
  const parsedInput = updateRoleInputSchema.safeParse({
    ...readRoleMutationInput(formData),
    id: roleId,
  })

  if (!parsedInput.success) {
    redirect(createRedirectTarget(returnTo, 'error', '更新角色表单校验失败，请检查输入内容。'))
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/roles/${parsedInput.data.id}`,
    await createManagementRequestInit('PUT', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
  }

  revalidatePath(rolesDirectoryPath)
  redirect(
    createRedirectTarget(returnTo, 'success', '角色信息已更新。', {
      action: 'updated',
      targetId: parsedInput.data.id,
    }),
  )
}

/**
 * 提交删除角色动作，并在成功后回到列表页确认结果。
 */
export async function deleteRoleAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))
  const parsedInput = deleteRoleInputSchema.safeParse({
    id: String(formData.get('id') ?? ''),
  })

  if (!parsedInput.success) {
    redirect(createRedirectTarget(returnTo, 'error', '删除角色请求无效，请刷新后重试。'))
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/roles/${parsedInput.data.id}`,
    await createManagementRequestInit('DELETE'),
  )

  if (!response.ok) {
    redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
  }

  revalidatePath(rolesDirectoryPath)
  redirect(
    createRedirectTarget(returnTo, 'success', '角色已删除。', {
      action: 'deleted',
      targetId: parsedInput.data.id,
    }),
  )
}
