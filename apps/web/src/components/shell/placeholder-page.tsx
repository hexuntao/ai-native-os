import {
  Badge,
  Button,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import { ModulePreviewDialog } from './module-preview-dialog'

interface PlaceholderRow {
  label: string
  note: string
  status: 'blocked' | 'ready' | 'scaffolded'
}

interface PlaceholderPageProps {
  eyebrow: string
  milestones: readonly string[]
  rows: readonly PlaceholderRow[]
  summary: string
  title: string
}

/**
 * 用共享卡片、表格和弹层原语承载模块占位内容，避免 Phase 4 前期继续散落页面样式。
 */
export function PlaceholderPage({
  eyebrow,
  milestones,
  rows,
  summary,
  title,
}: PlaceholderPageProps): ReactNode {
  return (
    <article className="grid gap-8">
      <CardHeader className="gap-4 px-0 pt-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
            <CardTitle className="text-5xl leading-none">{title}</CardTitle>
          </div>
          <ModulePreviewDialog milestones={milestones} summary={summary} title={title} />
        </div>
        <CardDescription className="max-w-3xl text-base leading-7">{summary}</CardDescription>
      </CardHeader>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-[var(--radius-xl)] border border-border/70 bg-card-strong/70 p-4 shadow-[var(--shadow-soft)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Surface</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'ready' ? 'accent' : 'secondary'}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-[var(--radius-xl)] border border-border/70 bg-card/80 p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Implementation notes
          </p>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-muted-foreground">
            <p>
              Shared UI primitives are now sourced from <code>@ai-native-os/ui</code>.
            </p>
            <p>
              This placeholder remains intentionally non-CRUD until the contract-first route work
              lands.
            </p>
          </div>
          <div className="mt-5">
            <Button size="sm" variant="secondary">
              Waiting for module implementation
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}
