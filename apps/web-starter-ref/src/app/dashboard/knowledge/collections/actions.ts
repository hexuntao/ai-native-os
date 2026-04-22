'use server'

import {
  createKnowledgeInputSchema,
  deleteKnowledgeInputSchema,
  updateKnowledgeInputSchema,
} from '@ai-native-os/shared'
import { revalidatePath } from 'next/cache'
import { resolveWebEnvironment } from '@/lib/env'
import {
  createManagementRequestInit,
  readApiErrorMessage,
  redirectWithMessage,
  resolveDashboardReturnTo,
} from '@/lib/server-actions'

const knowledgeDirectoryPath = '/dashboard/knowledge/collections'

function parseMetadataInput(rawValue: FormDataEntryValue | null): Record<string, unknown> {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return {}
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown

    if (typeof parsedValue === 'object' && parsedValue !== null && !Array.isArray(parsedValue)) {
      return parsedValue as Record<string, unknown>
    }

    throw new Error('Metadata must be a JSON object')
  } catch {
    throw new Error('知识元数据必须是合法的 JSON 对象。')
  }
}

function readKnowledgeMutationInput(formData: FormData): {
  chunkOverlap: number
  chunkSize: number
  content: string
  metadata: Record<string, unknown>
  sourceType: string
  sourceUri: string | null
  title: string
} {
  const sourceUriValue = formData.get('sourceUri')

  return {
    chunkOverlap: Number(formData.get('chunkOverlap') ?? '64'),
    chunkSize: Number(formData.get('chunkSize') ?? '512'),
    content: String(formData.get('content') ?? ''),
    metadata: parseMetadataInput(formData.get('metadata')),
    sourceType: String(formData.get('sourceType') ?? ''),
    sourceUri:
      typeof sourceUriValue === 'string' && sourceUriValue.trim().length > 0
        ? sourceUriValue
        : null,
    title: String(formData.get('title') ?? ''),
  }
}

export async function createKnowledgeAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), knowledgeDirectoryPath)
  let normalizedInput: ReturnType<typeof readKnowledgeMutationInput>

  try {
    normalizedInput = readKnowledgeMutationInput(formData)
  } catch (error) {
    const message = error instanceof Error ? error.message : '知识元数据解析失败。'

    redirectWithMessage(returnTo, 'error', message)
  }

  const parsedInput = createKnowledgeInputSchema.safeParse(normalizedInput)

  if (!parsedInput.success) {
    redirectWithMessage(returnTo, 'error', '创建知识文档表单校验失败，请检查输入内容。')
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/ai/knowledge`,
    await createManagementRequestInit('POST', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
  }

  revalidatePath(knowledgeDirectoryPath)
  redirectWithMessage(returnTo, 'success', '知识文档已创建并完成索引。', {
    action: 'created',
  })
}

export async function updateKnowledgeAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), knowledgeDirectoryPath)
  const documentId = String(formData.get('id') ?? '')
  let normalizedInput: ReturnType<typeof readKnowledgeMutationInput>

  try {
    normalizedInput = readKnowledgeMutationInput(formData)
  } catch (error) {
    const message = error instanceof Error ? error.message : '知识元数据解析失败。'

    redirectWithMessage(returnTo, 'error', message)
  }

  const parsedInput = updateKnowledgeInputSchema.safeParse({
    ...normalizedInput,
    id: documentId,
  })

  if (!parsedInput.success) {
    redirectWithMessage(returnTo, 'error', '更新知识文档表单校验失败，请检查输入内容。')
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/ai/knowledge/${parsedInput.data.id}`,
    await createManagementRequestInit('PUT', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
  }

  revalidatePath(knowledgeDirectoryPath)
  redirectWithMessage(returnTo, 'success', '知识文档已完成重建索引。', {
    action: 'updated',
    targetId: parsedInput.data.id,
  })
}

export async function deleteKnowledgeAction(formData: FormData): Promise<never> {
  const returnTo = resolveDashboardReturnTo(formData.get('returnTo'), knowledgeDirectoryPath)
  const parsedInput = deleteKnowledgeInputSchema.safeParse({
    id: String(formData.get('id') ?? ''),
  })

  if (!parsedInput.success) {
    redirectWithMessage(returnTo, 'error', '删除知识文档请求无效，请刷新后重试。')
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/ai/knowledge/${parsedInput.data.id}`,
    await createManagementRequestInit('DELETE'),
  )

  if (!response.ok) {
    redirectWithMessage(returnTo, 'error', await readApiErrorMessage(response))
  }

  revalidatePath(knowledgeDirectoryPath)
  redirectWithMessage(returnTo, 'success', '知识文档已删除。', {
    action: 'deleted',
    targetId: parsedInput.data.id,
  })
}
