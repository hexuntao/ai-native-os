'use server'

import {
  createRoleInputSchema,
  deleteRoleInputSchema,
  updateRoleInputSchema,
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

const rolesDirectoryPath = '/dashboard/admin/roles'

function readPermissionIds(formData: FormData): string[] {
  return formData
    .getAll('permissionIds')
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
}

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

export async function createRoleAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), rolesDirectoryPath)
  const parsedInput = createRoleInputSchema.safeParse(readRoleMutationInput(formData))

  if (!parsedInput.success) {
    redirectWithMessage(returnTo, 'error', '创建角色表单校验失败，请检查输入内容。')
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/roles`,
    await createManagementRequestInit('POST', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
  }

  const createdRoleId = await readCreatedEntityId(response)
  revalidatePath(rolesDirectoryPath)
  redirectWithMessage(returnTo, 'success', '角色已创建并写入权限绑定。', {
    action: 'created',
    targetId: createdRoleId ?? undefined,
  })
}

export async function updateRoleAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), rolesDirectoryPath)
  const roleId = String(formData.get('id') ?? '')
  const parsedInput = updateRoleInputSchema.safeParse({
    ...readRoleMutationInput(formData),
    id: roleId,
  })

  if (!parsedInput.success) {
    redirectWithMessage(returnTo, 'error', '更新角色表单校验失败，请检查输入内容。')
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/roles/${parsedInput.data.id}`,
    await createManagementRequestInit('PUT', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
  }

  revalidatePath(rolesDirectoryPath)
  redirectWithMessage(returnTo, 'success', '角色信息已更新。', {
    action: 'updated',
    targetId: parsedInput.data.id,
  })
}

export async function deleteRoleAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), rolesDirectoryPath)
  const parsedInput = deleteRoleInputSchema.safeParse({
    id: String(formData.get('id') ?? ''),
  })

  if (!parsedInput.success) {
    redirectWithMessage(returnTo, 'error', '删除角色请求无效，请刷新后重试。')
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/roles/${parsedInput.data.id}`,
    await createManagementRequestInit('DELETE'),
  )

  if (!response.ok) {
    redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
  }

  revalidatePath(rolesDirectoryPath)
  redirectWithMessage(returnTo, 'success', '角色已删除。', {
    action: 'deleted',
    targetId: parsedInput.data.id,
  })
}
