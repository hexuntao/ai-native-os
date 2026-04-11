'use server'

import {
  createKnowledgeInputSchema,
  deleteKnowledgeInputSchema,
  updateKnowledgeInputSchema,
} from '@ai-native-os/shared'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { resolveWebEnvironment } from '@/lib/env'

interface ApiErrorPayload {
  code?: string
  message?: string
}

const knowledgeDirectoryPath = '/ai/knowledge'
type RedirectTarget = Parameters<typeof redirect>[0]

/**
 * 规范化回跳地址，只允许当前站内的知识库路径，避免表单回跳被污染。
 */
function resolveReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string' || !value.startsWith(knowledgeDirectoryPath)) {
    return knowledgeDirectoryPath
  }

  return value
}

/**
 * 把表单动作结果编码回列表页 query，便于服务端页面输出统一反馈。
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
 * 读取当前服务端请求携带的 cookie 头，确保写操作仍复用 Better Auth 会话。
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
 * 解析元数据 JSON 文本，统一把空字符串归一化为空对象。
 */
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

/**
 * 把表单中的知识写入字段规范化为统一请求载荷。
 */
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

/**
 * 创建知识文档，并立即触发整文档索引。
 */
export async function createKnowledgeAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))
  let normalizedInput: ReturnType<typeof readKnowledgeMutationInput>

  try {
    normalizedInput = readKnowledgeMutationInput(formData)
  } catch (error) {
    const message = error instanceof Error ? error.message : '知识元数据解析失败。'

    redirect(createRedirectTarget(returnTo, 'error', message))
  }

  const parsedInput = createKnowledgeInputSchema.safeParse(normalizedInput)

  if (!parsedInput.success) {
    redirect(createRedirectTarget(returnTo, 'error', '创建知识文档表单校验失败，请检查输入内容。'))
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/ai/knowledge`,
    await createManagementRequestInit('POST', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
  }

  revalidatePath(knowledgeDirectoryPath)
  redirect(createRedirectTarget(returnTo, 'success', '知识文档已创建并完成索引。'))
}

/**
 * 用新的完整正文替换知识文档，并重建全部 chunk 与 embedding。
 */
export async function updateKnowledgeAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))
  const documentId = String(formData.get('id') ?? '')
  let normalizedInput: ReturnType<typeof readKnowledgeMutationInput>

  try {
    normalizedInput = readKnowledgeMutationInput(formData)
  } catch (error) {
    const message = error instanceof Error ? error.message : '知识元数据解析失败。'

    redirect(createRedirectTarget(returnTo, 'error', message))
  }

  const parsedInput = updateKnowledgeInputSchema.safeParse({
    ...normalizedInput,
    id: documentId,
  })

  if (!parsedInput.success) {
    redirect(createRedirectTarget(returnTo, 'error', '更新知识文档表单校验失败，请检查输入内容。'))
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/ai/knowledge/${parsedInput.data.id}`,
    await createManagementRequestInit('PUT', JSON.stringify(parsedInput.data)),
  )

  if (!response.ok) {
    redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
  }

  revalidatePath(knowledgeDirectoryPath)
  redirect(createRedirectTarget(returnTo, 'success', '知识文档已完成重建索引。'))
}

/**
 * 删除整份知识文档，并清理其全部 chunk 记录。
 */
export async function deleteKnowledgeAction(formData: FormData): Promise<never> {
  const returnTo = resolveReturnTo(formData.get('returnTo'))
  const parsedInput = deleteKnowledgeInputSchema.safeParse({
    id: String(formData.get('id') ?? ''),
  })

  if (!parsedInput.success) {
    redirect(createRedirectTarget(returnTo, 'error', '删除知识文档请求无效，请刷新后重试。'))
  }

  const environment = resolveWebEnvironment()
  const response = await fetch(
    `${environment.apiUrl}/api/v1/ai/knowledge/${parsedInput.data.id}`,
    await createManagementRequestInit('DELETE'),
  )

  if (!response.ok) {
    redirect(createRedirectTarget(returnTo, 'error', await readApiErrorMessage(response)))
  }

  revalidatePath(knowledgeDirectoryPath)
  redirect(createRedirectTarget(returnTo, 'success', '知识文档已删除。'))
}
