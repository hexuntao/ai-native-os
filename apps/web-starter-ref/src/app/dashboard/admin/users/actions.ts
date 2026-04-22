'use server'

import {
  createUserInputSchema,
  deleteUserInputSchema,
  updateUserInputSchema,
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

const usersDirectoryPath = '/dashboard/admin/users'

function readRoleCodes(formData: FormData): string[] {
  return formData
    .getAll('roleCodes')
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
}

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

export async function createUserAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), usersDirectoryPath)
  const parsedInput = createUserInputSchema.safeParse({
    ...readUserMutationInput(formData),
    password: String(formData.get('password') ?? ''),
  })

  if (!parsedInput.success) {
    redirectWithMessage(returnTo, 'error', '创建用户表单校验失败，请检查输入内容。')
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/users`,
    await createManagementRequestInit('POST', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
  }

  const createdUserId = await readCreatedEntityId(response)
  revalidatePath(usersDirectoryPath)
  redirectWithMessage(returnTo, 'success', '用户已创建并同步到认证体系。', {
    action: 'created',
    targetId: createdUserId ?? undefined,
  })
}

export async function updateUserAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), usersDirectoryPath)
  const userId = String(formData.get('id') ?? '')
  const parsedInput = updateUserInputSchema.safeParse({
    ...readUserMutationInput(formData),
    id: userId,
  })

  if (!parsedInput.success) {
    redirectWithMessage(returnTo, 'error', '更新用户表单校验失败，请检查输入内容。')
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/users/${parsedInput.data.id}`,
    await createManagementRequestInit('PUT', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
  }

  revalidatePath(usersDirectoryPath)
  redirectWithMessage(returnTo, 'success', '用户信息已更新。', {
    action: 'updated',
    targetId: parsedInput.data.id,
  })
}

export async function deleteUserAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), usersDirectoryPath)
  const parsedInput = deleteUserInputSchema.safeParse({
    id: String(formData.get('id') ?? ''),
  })

  if (!parsedInput.success) {
    redirectWithMessage(returnTo, 'error', '删除用户请求无效，请刷新后重试。')
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/users/${parsedInput.data.id}`,
    await createManagementRequestInit('DELETE'),
  )

  if (!response.ok) {
    redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
  }

  revalidatePath(usersDirectoryPath)
  redirectWithMessage(returnTo, 'success', '用户已删除。', {
    action: 'deleted',
    targetId: parsedInput.data.id,
  })
}
