import { createHash, randomUUID } from 'node:crypto'

import { replaceKnowledgeDocument, writeAiAuditLog, writeOperationLog } from '@ai-native-os/db'
import {
  type AiKnowledgeDocumentInput,
  type AiKnowledgeIndexResult,
  aiKnowledgeDocumentInputSchema,
  aiKnowledgeIndexResultSchema,
} from '@ai-native-os/shared'

import { createMastraRequestContext, readMastraRequestContext } from '../request-context'
import { chunkKnowledgeDocument } from './chunking'
import { embedKnowledgeChunks } from './embeddings'

const ragIndexingAuditToolId = 'task:rag-indexing'
const ragIndexingOperationModule = 'ai_knowledge'

export type RagIndexingDocumentInput = AiKnowledgeDocumentInput

function buildChunkHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * 为内部 RAG 索引任务创建最小权限上下文。
 *
 * 这个主体只代表受控后台任务，不代表任何人工管理员账号。
 */
export function createRagIndexingTaskRequestContext(
  requestId: string = `trigger-rag-indexing-${randomUUID()}`,
): ReturnType<typeof createMastraRequestContext> {
  return createMastraRequestContext({
    authUserId: 'system:trigger-jobs',
    permissionRules: [
      {
        action: 'import',
        subject: 'AiKnowledge',
      },
      {
        action: 'read',
        subject: 'AiKnowledge',
      },
    ],
    rbacUserId: null,
    requestId,
    roleCodes: ['system_scheduler'],
    userEmail: null,
  })
}

/**
 * 执行知识文档索引，并记录任务级审计。
 */
export async function indexKnowledgeDocument(args: {
  input: AiKnowledgeDocumentInput
  requestContext?: ReturnType<typeof createMastraRequestContext>
}): Promise<AiKnowledgeIndexResult> {
  const input = aiKnowledgeDocumentInputSchema.parse(args.input)
  const requestContext = args.requestContext ?? createRagIndexingTaskRequestContext()
  const contextValues = readMastraRequestContext(requestContext)

  try {
    const chunks = chunkKnowledgeDocument(input.content, {
      chunkOverlap: input.chunkOverlap,
      chunkSize: input.chunkSize,
    })

    if (chunks.length === 0) {
      throw new Error(`Knowledge document ${input.documentId} produced no chunks`)
    }

    const embeddings = await embedKnowledgeChunks(chunks.map((chunk) => chunk.content))
    const result = await replaceKnowledgeDocument({
      chunks: chunks.map((chunk, index) => ({
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        contentHash: buildChunkHash(chunk.content),
        embedding: embeddings[index] ?? [],
        tokenCount: chunk.tokenCount,
      })),
      documentId: input.documentId,
      metadata: input.metadata,
      sourceType: input.sourceType,
      sourceUri: input.sourceUri ?? null,
      title: input.title,
    })
    const parsedResult = aiKnowledgeIndexResultSchema.parse(result)

    await writeAiAuditLog({
      action: 'import',
      actorAuthUserId: contextValues.authUserId,
      actorRbacUserId: contextValues.rbacUserId,
      input,
      output: parsedResult,
      requestInfo: {
        requestId: contextValues.requestId,
        sourceType: input.sourceType,
      },
      roleCodes: contextValues.roleCodes,
      status: 'success',
      subject: 'AiKnowledge',
      toolId: ragIndexingAuditToolId,
    })

    try {
      await writeOperationLog({
        action: 'update_document_index',
        detail: `Indexed knowledge document ${input.title} with ${parsedResult.chunkCount} chunks.`,
        fallbackActorKind: 'system',
        module: ragIndexingOperationModule,
        operatorId: contextValues.rbacUserId,
        requestInfo: {
          requestId: contextValues.requestId,
          sourceType: input.sourceType,
          sourceUri: input.sourceUri ?? 'internal',
        },
        targetId: input.documentId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      console.error(`Failed to persist knowledge operation log: ${message}`)
    }

    return parsedResult
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await writeAiAuditLog({
      action: 'import',
      actorAuthUserId: contextValues.authUserId,
      actorRbacUserId: contextValues.rbacUserId,
      errorMessage: message,
      input,
      requestInfo: {
        requestId: contextValues.requestId,
        sourceType: input.sourceType,
      },
      roleCodes: contextValues.roleCodes,
      status: 'error',
      subject: 'AiKnowledge',
      toolId: ragIndexingAuditToolId,
    })

    try {
      await writeOperationLog({
        action: 'update_document_index',
        detail: `Failed to index knowledge document ${input.title}.`,
        errorMessage: message,
        fallbackActorKind: 'system',
        module: ragIndexingOperationModule,
        operatorId: contextValues.rbacUserId,
        requestInfo: {
          requestId: contextValues.requestId,
          sourceType: input.sourceType,
          sourceUri: input.sourceUri ?? 'internal',
        },
        status: 'error',
        targetId: input.documentId,
      })
    } catch (operationLogError) {
      const operationLogMessage =
        operationLogError instanceof Error ? operationLogError.message : String(operationLogError)

      console.error(`Failed to persist knowledge operation log: ${operationLogMessage}`)
    }

    throw error
  }
}
