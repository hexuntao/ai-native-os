import type { ReactNode } from 'react'
import {
  createKnowledgeAction,
  deleteKnowledgeAction,
  updateKnowledgeAction,
} from '@/app/dashboard/knowledge/collections/actions'
import { DestructiveActionDialog } from '@/components/management/destructive-action-dialog'
import { ManagementDialog } from '@/components/management/management-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

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

function stringifyMetadata(metadata: Record<string, string | number | boolean | null>): string {
  return JSON.stringify(metadata, null, 2)
}

function resolveDialogCopy(mode: 'create' | 'replace'): {
  description: string
  submitLabel: string
  title: string
  triggerLabel: string
  triggerVariant: 'default' | 'secondary'
} {
  if (mode === 'create') {
    return {
      description: '创建知识文档并触发完整 chunking、embedding 与整文档索引。',
      submitLabel: '创建文档',
      title: '创建知识文档',
      triggerLabel: '新建文档',
      triggerVariant: 'default',
    }
  }

  return {
    description: '提交完整新正文并重建索引，不会自动从旧 chunk 还原原文。',
    submitLabel: '替换并重建索引',
    title: '替换知识索引',
    triggerLabel: '替换索引',
    triggerVariant: 'secondary',
  }
}

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
      contentClassName="sm:max-w-4xl"
      description={dialogCopy.description}
      title={dialogCopy.title}
      triggerLabel={dialogCopy.triggerLabel}
      triggerVariant={dialogCopy.triggerVariant}
    >
      <form action={action} aria-label={`${dialogCopy.title}表单`} className="grid gap-4">
        <input name="returnTo" type="hidden" value={returnTo} />
        {mode === 'replace' && row ? (
          <input name="id" type="hidden" value={row.documentId} />
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${mode}-knowledge-title`}>标题</FieldLabel>
            <Input
              defaultValue={mode === 'replace' && row ? row.title : ''}
              id={`${mode}-knowledge-title`}
              minLength={3}
              name="title"
              required
            />
            <FieldDescription>
              标题至少 3 个字符，便于在知识工作台和审计日志中稳定识别。
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor={`${mode}-knowledge-source-type`}>来源类型</FieldLabel>
            <Input
              defaultValue={mode === 'replace' && row ? row.sourceType : 'manual'}
              id={`${mode}-knowledge-source-type`}
              minLength={2}
              name="sourceType"
              required
            />
            <FieldDescription>
              建议使用稳定来源类型，例如 `manual`、`wiki`、`notion`。
            </FieldDescription>
          </Field>

          <Field className="xl:col-span-2">
            <FieldLabel htmlFor={`${mode}-knowledge-source-uri`}>来源 URI</FieldLabel>
            <Input
              defaultValue={mode === 'replace' && row ? (row.sourceUri ?? '') : ''}
              id={`${mode}-knowledge-source-uri`}
              name="sourceUri"
              placeholder="https://internal.example.com/wiki/finance"
            />
            <FieldDescription>没有外部来源时可留空，系统会归一化为 `null`。</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor={`${mode}-knowledge-chunk-size`}>分块大小</FieldLabel>
            <Input
              defaultValue="512"
              id={`${mode}-knowledge-chunk-size`}
              max={2048}
              min={128}
              name="chunkSize"
              type="number"
            />
            <FieldDescription>建议范围 128-2048，过大 chunk 会降低检索粒度。</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor={`${mode}-knowledge-chunk-overlap`}>分块重叠</FieldLabel>
            <Input
              defaultValue="64"
              id={`${mode}-knowledge-chunk-overlap`}
              max={512}
              min={0}
              name="chunkOverlap"
              type="number"
            />
            <FieldDescription>
              建议不超过 chunk size 的一半，避免重复索引过多文本。
            </FieldDescription>
          </Field>

          <Field className="xl:col-span-2">
            <FieldLabel htmlFor={`${mode}-knowledge-metadata`}>元数据（JSON）</FieldLabel>
            <Textarea
              defaultValue={
                mode === 'replace' && row
                  ? stringifyMetadata(row.metadata)
                  : '{\n  "category": "finance"\n}'
              }
              id={`${mode}-knowledge-metadata`}
              name="metadata"
            />
            <FieldDescription>必须是 JSON 对象；空对象请显式填写 `{}`。</FieldDescription>
          </Field>

          <Field className="xl:col-span-2">
            <FieldLabel htmlFor={`${mode}-knowledge-content`}>
              {mode === 'create' ? '文档内容' : '替换内容'}
            </FieldLabel>
            <Textarea
              id={`${mode}-knowledge-content`}
              minLength={32}
              name="content"
              placeholder={
                mode === 'create' ? '在这里粘贴完整文档内容。' : '在这里粘贴完整替换内容。'
              }
              required
            />
            <FieldDescription>
              创建和更新都需要提交完整正文；系统不会自动从旧 chunk 还原原文。
            </FieldDescription>
          </Field>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="submit">{dialogCopy.submitLabel}</Button>
        </div>
      </form>

      {mode === 'replace' && row ? (
        <div className="mt-4 flex justify-start border-t pt-4">
          <DestructiveActionDialog
            action={deleteKnowledgeAction}
            consequences="删除会移除该文档的全部 chunk 与索引结果；知识检索结果会立即失去这份语料。"
            description="确认后将永久删除该知识文档，并写入标准化 AI 审计日志。"
            hiddenFields={[
              { name: 'id', value: row.documentId },
              { name: 'returnTo', value: returnTo },
            ]}
            title={`删除 ${row.title}？`}
            triggerLabel="删除文档"
            triggerVariant="secondary"
          />
        </div>
      ) : null}
    </ManagementDialog>
  )
}
