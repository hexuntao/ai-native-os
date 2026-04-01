import {
  semanticKnowledgeSearchInputSchema,
  semanticKnowledgeSearchOutputSchema,
} from '@ai-native-os/shared'

import { semanticSearchKnowledgeBase } from '../rag/retrieval'
import { defineProtectedMastraTool } from './base'

/**
 * 知识库语义检索 Tool。
 *
 * 职责边界：
 * - 仅提供受 RBAC 保护的知识检索能力，不负责知识导入
 * - 检索结果仍走统一 Tool 审计链路，便于追踪 Agent 使用了哪些知识片段
 */
export const knowledgeSemanticSearchRegistration = defineProtectedMastraTool({
  description: 'Run semantic search across indexed AI knowledge chunks.',
  execute: async (input) =>
    semanticSearchKnowledgeBase(semanticKnowledgeSearchInputSchema.parse(input)),
  id: 'knowledge-semantic-search',
  inputSchema: semanticKnowledgeSearchInputSchema,
  outputSchema: semanticKnowledgeSearchOutputSchema,
  permission: {
    action: 'read',
    subject: 'AiKnowledge',
  },
})
