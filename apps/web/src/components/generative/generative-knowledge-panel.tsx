'use client'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ai-native-os/ui'
import { type ReactNode, startTransition, useState } from 'react'

import { formatCount, formatDateTime } from '@/lib/format'
import { applyKnowledgeGenerativePrompt, type KnowledgeGenerativeResult } from '@/lib/generative'

import { GenerativeBarChart } from './generative-bar-chart'

interface GenerativeKnowledgePanelProps {
  rows: KnowledgeGenerativeResult['filteredRows']
}

const knowledgePromptSuggestions = [
  'Show recent markdown documents',
  'Find largest chunk-heavy policy sources',
  'Focus on docs from internal sources',
] as const

/**
 * 在知识库页提供基于当前结果集的生成式摘要与来源分布，避免直接在前端触发检索或重建索引。
 */
export function GenerativeKnowledgePanel({ rows }: GenerativeKnowledgePanelProps): ReactNode {
  const [prompt, setPrompt] = useState<string>('Show recent markdown documents')
  const [result, setResult] = useState<KnowledgeGenerativeResult>(() =>
    applyKnowledgeGenerativePrompt('Show recent markdown documents', rows),
  )

  const applyPrompt = (nextPrompt: string): void => {
    startTransition(() => {
      setPrompt(nextPrompt)
      setResult(applyKnowledgeGenerativePrompt(nextPrompt, rows))
    })
  }

  return (
    <section className="grid gap-4">
      <Card className="overflow-hidden border-primary/12 bg-[linear-gradient(135deg,rgba(239,246,255,0.98),rgba(255,255,255,0.92))]">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Generative lens
              </p>
              <CardTitle className="text-2xl">Knowledge coverage composer</CardTitle>
            </div>
            <Badge variant="accent">Read-only</Badge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            This lens reorganizes the currently visible knowledge inventory into summaries, ranking,
            and source distribution without leaving the page scope.
          </p>
        </CardHeader>
        <CardContent className="grid gap-5 p-6">
          <Field>
            <FieldLabel htmlFor="generative-knowledge-prompt">Prompt</FieldLabel>
            <div className="flex flex-col gap-3 lg:flex-row">
              <Input
                id="generative-knowledge-prompt"
                onChange={(event) => {
                  setPrompt(event.target.value)
                }}
                placeholder='For example: "Show recent policy documents"'
                value={prompt}
              />
              <Button
                onClick={() => {
                  applyPrompt(prompt)
                }}
                type="button"
              >
                Generate lens
              </Button>
            </div>
          </Field>

          <div className="flex flex-wrap gap-2">
            {knowledgePromptSuggestions.map((suggestion) => (
              <Button
                key={suggestion}
                onClick={() => {
                  applyPrompt(suggestion)
                }}
                type="button"
                variant="secondary"
              >
                {suggestion}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Card className="border-border/70 bg-background/82 shadow-[var(--shadow-soft)]">
              <CardHeader className="gap-2 pb-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Generated summary
                </p>
                <CardTitle className="text-xl">{result.headline}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <p className="text-sm leading-7 text-muted-foreground">{result.narrative}</p>

                <div className="grid gap-3 md:grid-cols-3">
                  <Field className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-3">
                    <FieldLabel>Lens</FieldLabel>
                    <Input readOnly value={result.draft.lens} />
                  </Field>
                  <Field className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-3">
                    <FieldLabel>Search</FieldLabel>
                    <Input readOnly value={result.draft.search ?? 'none'} />
                  </Field>
                  <Field className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-3">
                    <FieldLabel>Source type</FieldLabel>
                    <Input readOnly value={result.draft.sourceType ?? 'none'} />
                  </Field>
                </div>
              </CardContent>
            </Card>

            <GenerativeBarChart
              data={result.chartData}
              emptyMessage="The current prompt left no visible chunk distribution to summarize."
              title="Chunk coverage by source"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-background/82 shadow-[var(--shadow-soft)]">
        <CardHeader className="gap-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Generative table
          </p>
          <CardTitle className="text-xl">Focused knowledge slice</CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Indexed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.filteredRows.slice(0, 6).map((row) => (
                <TableRow key={row.documentId}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">{row.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {row.sourceUri ?? 'internal'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.sourceType}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{formatCount(row.chunkCount)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(row.lastIndexedAt)}
                  </TableCell>
                </TableRow>
              ))}
              {result.filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground" colSpan={4}>
                    The generated lens matched no visible knowledge documents in the current page
                    slice.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  )
}
