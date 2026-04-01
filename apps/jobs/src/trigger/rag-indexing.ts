import {
  indexKnowledgeDocument,
  type RagIndexingDocumentInput,
} from '@ai-native-os/api/mastra/rag/indexing'
import { task } from '@trigger.dev/sdk/v3'

export interface RagIndexingTaskResult {
  documentId: string
  taskId: 'rag-indexing'
  title: string
  chunkCount: number
}

/**
 * 执行知识文档索引任务。
 *
 * 职责边界：
 * - 只调用 API 包里受控的索引逻辑，不在 jobs 侧复制 embedding / chunking 细节
 * - 任务本身不提供外部匿名入口，所有审计由索引逻辑统一落库
 */
export async function executeRagIndexingTask(
  input: RagIndexingDocumentInput,
): Promise<RagIndexingTaskResult> {
  const result = await indexKnowledgeDocument({
    input,
  })

  return {
    chunkCount: result.chunkCount,
    documentId: result.documentId,
    taskId: 'rag-indexing',
    title: result.title,
  }
}

/**
 * 知识库索引任务。
 *
 * 当前阶段先提供按需触发能力，等 Phase 5/6 再决定是否接入上传事件或队列。
 */
export const ragIndexingTask = task({
  id: 'rag-indexing',
  run: async (payload: RagIndexingDocumentInput) => executeRagIndexingTask(payload),
})
