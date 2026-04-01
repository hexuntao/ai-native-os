import {
  type AiKnowledgeChunk,
  aiKnowledgeChunkSchema,
  knowledgeChunkConfigSchema,
} from '@ai-native-os/shared'

export interface ChunkTextOptions {
  chunkOverlap?: number
  chunkSize?: number
}

function normalizeContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function estimateTokenCount(content: string): number {
  const wordMatches = content.match(/[\p{L}\p{N}_-]+/gu)

  if (!wordMatches) {
    return 0
  }

  return wordMatches.length
}

function findChunkBoundary(content: string, startOffset: number, preferredEnd: number): number {
  const searchWindow = content.slice(startOffset, preferredEnd)
  const breakpoints = ['\n\n', '\n', '。', '！', '？', '.', '!', '?', ';', '；', ' ']

  for (const breakpoint of breakpoints) {
    const breakpointIndex = searchWindow.lastIndexOf(breakpoint)

    if (breakpointIndex >= Math.floor(searchWindow.length * 0.6)) {
      return startOffset + breakpointIndex + breakpoint.length
    }
  }

  return preferredEnd
}

/**
 * 把原始文档切成可嵌入的稳定分块。
 *
 * 当前实现使用字符窗口 + 边界回退策略：
 * - 优先保证 deterministic，便于测试与重复索引
 * - 在窗口尾部尽量落在段落、句子或空格边界，减少语义撕裂
 */
export function chunkKnowledgeDocument(
  content: string,
  options: ChunkTextOptions = {},
): AiKnowledgeChunk[] {
  const normalizedContent = normalizeContent(content)
  const parsedOptions = knowledgeChunkConfigSchema.parse(options)

  if (normalizedContent.length === 0) {
    return []
  }

  const chunks: AiKnowledgeChunk[] = []
  let startOffset = 0
  let chunkIndex = 0

  while (startOffset < normalizedContent.length) {
    const preferredEnd = Math.min(normalizedContent.length, startOffset + parsedOptions.chunkSize)
    const endOffset =
      preferredEnd === normalizedContent.length
        ? preferredEnd
        : findChunkBoundary(normalizedContent, startOffset, preferredEnd)
    const chunkContent = normalizedContent.slice(startOffset, endOffset).trim()

    if (chunkContent.length === 0) {
      break
    }

    chunks.push(
      aiKnowledgeChunkSchema.parse({
        chunkIndex,
        content: chunkContent,
        endOffset,
        startOffset,
        tokenCount: estimateTokenCount(chunkContent),
      }),
    )

    if (endOffset >= normalizedContent.length) {
      break
    }

    startOffset = Math.max(endOffset - parsedOptions.chunkOverlap, startOffset + 1)
    chunkIndex += 1
  }

  return chunks
}
