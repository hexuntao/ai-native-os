'use server'

import {
  createMenuInputSchema,
  deleteMenuInputSchema,
  updateMenuInputSchema,
} from '@ai-native-os/shared'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { resolveWebEnvironment } from '@/lib/env'

interface ApiErrorPayload {
  code?: string
  message?: string
}

const menusDirectoryPath = '/system/menus'
type RedirectTarget = Parameters<typeof redirect>[0]

/**
 * 规范化回跳地址，只允许当前站内的 `/system/menus` 路径，避免表单回跳被污染。
 */
function resolveReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string' || !value.startsWith(menusDirectoryPath)) {
    return menusDirectoryPath
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
 * 读取当前服务端请求携带的 cookie 头，确保菜单写操作继续复用同一套 Better Auth 会话。
 */
async function readCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()

  return cookieStore.toString() || undefined
}

/**
 * 创建指向 API 服务的 JSON 请求配置，避免每个菜单动作重复拼接认证头。
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
 * 统一解析上游 API 错误消息，保证菜单表单失败时能给出稳定反馈。
 */
async function readApiErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null

  return payload?.message?.trim() || `Request failed with status ${response.status}`
}

/**
 * 读取成功创建后的菜单主键，供列表页输出行级反馈锚点。
 */
async function readCreatedMenuId(response: Response): Promise<string | null> {
  const payload = (await response.json().catch(() => null)) as { id?: string } | null

  return payload?.id ?? null
}

/**
 * 解析可空字段值，兼容 `<option value="">` 和空白输入。
 */
function readNullableFieldValue(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()

  return normalizedValue.length > 0 ? normalizedValue : null
}

/**
 * 从表单中读取规范化的菜单写入载荷，避免页面层重复处理空字符串和可选绑定。
 */
function readMenuMutationInput(formData: FormData): {
  component: string | null
  icon: string | null
  name: string
  parentId: string | null
  path: string | null
  permissionAction: string | null
  permissionResource: string | null
  sortOrder: string
  status: boolean
  type: string
  visible: boolean
} {
  return {
    component: readNullableFieldValue(formData.get('component')),
    icon: readNullableFieldValue(formData.get('icon')),
    name: String(formData.get('name') ?? ''),
    parentId: readNullableFieldValue(formData.get('parentId')),
    path: readNullableFieldValue(formData.get('path')),
    permissionAction: readNullableFieldValue(formData.get('permissionAction')),
    permissionResource: readNullableFieldValue(formData.get('permissionResource')),
    sortOrder: String(formData.get('sortOrder') ?? '0'),
    status: String(formData.get('status') ?? 'active') === 'active',
    type: String(formData.get('type') ?? 'menu'),
    visible: String(formData.get('visible') ?? 'visible') === 'visible',
  }
}

/**
 * 提交创建菜单动作，并在成功后回跳列表页刷新结果。
 */
export async function createMenuAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))
  const parsedInput = createMenuInputSchema.safeParse(readMenuMutationInput(formData))

  if (!parsedInput.success) {
    redirect(createRedirectTarget(returnTo, 'error', '创建菜单表单校验失败，请检查输入内容。'))
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/menus`,
    await createManagementRequestInit('POST', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
  }

  const createdMenuId = await readCreatedMenuId(response)
  revalidatePath(menusDirectoryPath)
  redirect(
    createRedirectTarget(returnTo, 'success', '菜单节点已创建。', {
      action: 'created',
      targetId: createdMenuId ?? undefined,
    }),
  )
}

/**
 * 提交更新菜单动作，并在成功后刷新列表页展示。
 */
export async function updateMenuAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))
  const parsedInput = updateMenuInputSchema.safeParse({
    ...readMenuMutationInput(formData),
    id: String(formData.get('id') ?? ''),
  })

  if (!parsedInput.success) {
    redirect(createRedirectTarget(returnTo, 'error', '更新菜单表单校验失败，请检查输入内容。'))
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/menus/${parsedInput.data.id}`,
    await createManagementRequestInit('PUT', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
  }

  revalidatePath(menusDirectoryPath)
  redirect(
    createRedirectTarget(returnTo, 'success', '菜单节点已更新。', {
      action: 'updated',
      targetId: parsedInput.data.id,
    }),
  )
}

/**
 * 提交删除菜单动作，并在成功后回到列表页确认结果。
 */
export async function deleteMenuAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))
  const parsedInput = deleteMenuInputSchema.safeParse({
    id: String(formData.get('id') ?? ''),
  })

  if (!parsedInput.success) {
    redirect(createRedirectTarget(returnTo, 'error', '删除菜单请求无效，请刷新后重试。'))
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/menus/${parsedInput.data.id}`,
    await createManagementRequestInit('DELETE'),
  )

  if (!response.ok) {
    redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
  }

  revalidatePath(menusDirectoryPath)
  redirect(
    createRedirectTarget(returnTo, 'success', '菜单节点已删除。', {
      action: 'deleted',
      targetId: parsedInput.data.id,
    }),
  )
}
