'use server'

import {
  createMenuInputSchema,
  deleteMenuInputSchema,
  updateMenuInputSchema,
} from '@ai-native-os/shared'
import { revalidatePath } from 'next/cache'
import { resolveWebEnvironment } from '@/lib/env'
import {
  createManagementRequestInit,
  readApiErrorMessage,
  readCreatedEntityId,
  redirectWithMessage,
  resolveDashboardReturnTo,
} from '@/lib/server-actions'

const menusDirectoryPath = '/dashboard/admin/menus'

function readNullableFieldValue(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()

  return normalizedValue.length > 0 ? normalizedValue : null
}

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

export async function createMenuAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), menusDirectoryPath)
  const parsedInput = createMenuInputSchema.safeParse(readMenuMutationInput(formData))

  if (!parsedInput.success) {
    redirectWithMessage(returnTo, 'error', '创建菜单表单校验失败，请检查输入内容。')
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/menus`,
    await createManagementRequestInit('POST', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
  }

  const createdMenuId = await readCreatedEntityId(response)
  revalidatePath(menusDirectoryPath)
  redirectWithMessage(returnTo, 'success', '菜单节点已创建。', {
    action: 'created',
    targetId: createdMenuId ?? undefined,
  })
}

export async function updateMenuAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), menusDirectoryPath)
  const parsedInput = updateMenuInputSchema.safeParse({
    ...readMenuMutationInput(formData),
    id: String(formData.get('id') ?? ''),
  })

  if (!parsedInput.success) {
    redirectWithMessage(returnTo, 'error', '更新菜单表单校验失败，请检查输入内容。')
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/menus/${parsedInput.data.id}`,
    await createManagementRequestInit('PUT', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
  }

  revalidatePath(menusDirectoryPath)
  redirectWithMessage(returnTo, 'success', '菜单节点已更新。', {
    action: 'updated',
    targetId: parsedInput.data.id,
  })
}

export async function deleteMenuAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), menusDirectoryPath)
  const parsedInput = deleteMenuInputSchema.safeParse({
    id: String(formData.get('id') ?? ''),
  })

  if (!parsedInput.success) {
    redirectWithMessage(returnTo, 'error', '删除菜单请求无效，请刷新后重试。')
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/menus/${parsedInput.data.id}`,
    await createManagementRequestInit('DELETE'),
  )

  if (!response.ok) {
    redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
  }

  revalidatePath(menusDirectoryPath)
  redirectWithMessage(returnTo, 'success', '菜单节点已删除。', {
    action: 'deleted',
    targetId: parsedInput.data.id,
  })
}
