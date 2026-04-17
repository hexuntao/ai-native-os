import { Button, Field, FieldHint, FieldLabel, Input } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import {
  createKnowledgeAction,
  deleteKnowledgeAction,
  updateKnowledgeAction,
} from '@/app/(dashboard)/ai/knowledge/actions'
import { ManagementDialog } from '@/components/management/management-dialog'

interface KnowledgeDocumentRow {
  chunkCount: number
  documentId: string
  lastIndexedAt: string
  metadata: Record<string, string | number | boolean | null>
  sourceType: string
  sourceUri: string | null
  title: string
}

interface KnowledgeMutationDialogProps {
  mode: 'create' | 'replace'
  returnTo: string
  row?: KnowledgeDocumentRow
}

const textAreaClassName =
  'min-h-28 w-full rounded-[var(--radius-md)] border border-border/80 bg-background/70 px-4 py-3 text-sm text-foreground shadow-[var(--shadow-soft)] outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2'

/**
 * 将元数据对象格式化为 JSON 文本，供知识库写表单回显使用。
 */
function stringifyMetadata(metadata: Record<string, string | number | boolean | null>): string {
  return JSON.stringify(metadata, null, 2)
}

/**
 * 生成知识库写表单的标题和说明，确保创建与替换动作使用不同语义。
 */
function resolveDialogCopy(mode: 'create' | 'replace'): {
  description: string
  submitLabel: string
  title: string
  triggerLabel: string
} {
  if (mode === 'create') {
    return {
      description: '创建知识文档并触发完整 chunking、embedding 与整文档索引。',
      submitLabel: 'Create document',
      title: 'Create knowledge document',
      triggerLabel: 'New document',
    }
  }

  return {
    description: '提交完整新正文并重建索引，不会自动从旧 chunk 还原原文。',
    submitLabel: 'Replace and reindex',
    title: 'Replace knowledge index',
    triggerLabel: 'Replace index',
  }
}

/**
 * 为知识库工作台提供弹层式创建与替换表单，避免长表单持续占用主工作区。
 */
export function KnowledgeMutationDialog({
  mode,
  returnTo,
  row,
}: KnowledgeMutationDialogProps): ReactNode {
  const dialogCopy = resolveDialogCopy(mode)
  const action = mode === 'create' ? createKnowledgeAction : updateKnowledgeAction

  if (mode === 'replace' && !row) {
    return null
  }

  return (
    <ManagementDialog
      contentClassName="max-w-4xl"
      description={dialogCopy.description}
      title={dialogCopy.title}
      triggerLabel={dialogCopy.triggerLabel}
      triggerVariant={mode === 'create' ? 'default' : 'secondary'}
    >
      <form action={action} className="grid gap-4">
        <input name="returnTo" type="hidden" value={returnTo} />
        {mode === 'replace' && row ? (
          <input name="id" type="hidden" value={row.documentId} />
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${mode}-knowledge-title`}>Title</FieldLabel>
            <Input
              defaultValue={mode === 'replace' && row ? row.title : ''}
              id={`${mode}-knowledge-title`}
              name="title"
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor={`${mode}-knowledge-source-type`}>Source type</FieldLabel>
            <Input
              defaultValue={mode === 'replace' && row ? row.sourceType : 'manual'}
              id={`${mode}-knowledge-source-type`}
              name="sourceType"
              required
            />
          </Field>

          <Field className="xl:col-span-2">
            <FieldLabel htmlFor={`${mode}-knowledge-source-uri`}>Source URI</FieldLabel>
            <Input
              defaultValue={mode === 'replace' && row ? (row.sourceUri ?? '') : ''}
              id={`${mode}-knowledge-source-uri`}
              name="sourceUri"
              placeholder="https://internal.example.com/wiki/finance"
            />
            <FieldHint>没有外部来源时可留空，系统会归一化为 `null`。</FieldHint>
          </Field>

          <Field>
            <FieldLabel htmlFor={`${mode}-knowledge-chunk-size`}>Chunk size</FieldLabel>
            <Input
              defaultValue="512"
              id={`${mode}-knowledge-chunk-size`}
              name="chunkSize"
              type="number"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor={`${mode}-knowledge-chunk-overlap`}>Chunk overlap</FieldLabel>
            <Input
              defaultValue="64"
              id={`${mode}-knowledge-chunk-overlap`}
              name="chunkOverlap"
              type="number"
            />
          </Field>

          <Field className="xl:col-span-2">
            <FieldLabel htmlFor={`${mode}-knowledge-metadata`}>Metadata (JSON)</FieldLabel>
            <textarea
              className={textAreaClassName}
              defaultValue={
                mode === 'replace' && row
                  ? stringifyMetadata(row.metadata)
                  : '{\n  "category": "finance"\n}'
              }
              id={`${mode}-knowledge-metadata`}
              name="metadata"
            />
          </Field>

          <Field className="xl:col-span-2">
            <FieldLabel htmlFor={`${mode}-knowledge-content`}>
              {mode === 'create' ? 'Document content' : 'Replacement content'}
            </FieldLabel>
            <textarea
              className={textAreaClassName}
              id={`${mode}-knowledge-content`}
              name="content"
              placeholder={
                mode === 'create'
                  ? 'Paste the full document content here.'
                  : 'Paste the full replacement content here.'
              }
              required
            />
            <FieldHint>创建和更新都需要提交完整正文；系统不会自动从旧 chunk 还原原文。</FieldHint>
          </Field>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="submit">{dialogCopy.submitLabel}</Button>
        </div>
      </form>

      {mode === 'replace' && row ? (
        <form
          action={deleteKnowledgeAction}
          className="mt-4 flex justify-start border-t border-border/70 pt-4"
        >
          <input name="id" type="hidden" value={row.documentId} />
          <input name="returnTo" type="hidden" value={returnTo} />
          <Button
            className="border-red-200 text-red-700 hover:bg-red-50"
            type="submit"
            variant="secondary"
          >
            Delete document
          </Button>
        </form>
      ) : null}
    </ManagementDialog>
  )
}
