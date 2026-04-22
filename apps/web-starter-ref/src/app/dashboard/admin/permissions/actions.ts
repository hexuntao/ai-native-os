'use server'

import {
  createPermissionInputSchema,
  deletePermissionInputSchema,
  updatePermissionInputSchema,
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

const permissionsDirectoryPath = '/dashboard/admin/permissions'

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

export async function createPermissionAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), permissionsDirectoryPath)

  try {
    const parsedInput = createPermissionInputSchema.safeParse(readPermissionMutationInput(formData))

    if (!parsedInput.success) {
      redirectWithMessage(returnTo, 'error', '创建权限表单校验失败，请检查输入内容。')
    }

    const environment = resolveWebEnvironment()
    const response = await fetch(
      `${environment.apiUrl}/api/v1/system/permissions`,
      await createManagementRequestInit('POST', JSON.stringify(parsedInput.data)),
    )

    if (!response.ok) {
      redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
    }

    const createdPermissionId = await readCreatedEntityId(response)
    revalidatePath(permissionsDirectoryPath)
    redirectWithMessage(returnTo, 'success', '权限规则已创建。', {
      action: 'created',
      targetId: createdPermissionId ?? undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建权限请求无效，请检查条件 JSON。'

    redirectWithMessage(returnTo, 'error', message)
  }
}

export async function updatePermissionAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), permissionsDirectoryPath)

  try {
    const parsedInput = updatePermissionInputSchema.safeParse({
      ...readPermissionMutationInput(formData),
      id: String(formData.get('id') ?? ''),
    })

    if (!parsedInput.success) {
      redirectWithMessage(returnTo, 'error', '更新权限表单校验失败，请检查输入内容。')
    }

    const environment = resolveWebEnvironment()
    const response = await fetch(
      `${environment.apiUrl}/api/v1/system/permissions/${parsedInput.data.id}`,
      await createManagementRequestInit('PUT', JSON.stringify(parsedInput.data)),
    )

    if (!response.ok) {
      redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
    }

    revalidatePath(permissionsDirectoryPath)
    redirectWithMessage(returnTo, 'success', '权限规则已更新。', {
      action: 'updated',
      targetId: parsedInput.data.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新权限请求无效，请检查条件 JSON。'

    redirectWithMessage(returnTo, 'error', message)
  }
}

export async function deletePermissionAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), permissionsDirectoryPath)
  const parsedInput = deletePermissionInputSchema.safeParse({
    id: String(formData.get('id') ?? ''),
  })

  if (!parsedInput.success) {
    redirectWithMessage(returnTo, 'error', '删除权限请求无效，请刷新后重试。')
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/system/permissions/${parsedInput.data.id}`,
    await createManagementRequestInit('DELETE'),
  )

  if (!response.ok) {
    redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
  }

  revalidatePath(permissionsDirectoryPath)
  redirectWithMessage(returnTo, 'success', '权限规则已删除。', {
    action: 'deleted',
    targetId: parsedInput.data.id,
  })
}
