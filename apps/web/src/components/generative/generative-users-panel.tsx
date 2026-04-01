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

import { formatDateTime } from '@/lib/format'
import { applyUserDirectoryGenerativePrompt, type UserGenerativeResult } from '@/lib/generative'

import { GenerativeBarChart } from './generative-bar-chart'

interface GenerativeUsersPanelProps {
  rows: UserGenerativeResult['filteredRows']
}

const userPromptSuggestions = [
  'Show inactive users with viewer access',
  'Focus on admins',
  'Find operators related to "viewer@ai-native-os.local"',
] as const

/**
 * 在用户目录页提供自然语言筛选与生成式摘要，但结果严格限制在当前页已可见的用户数据之内。
 */
export function GenerativeUsersPanel({ rows }: GenerativeUsersPanelProps): ReactNode {
  const [prompt, setPrompt] = useState<string>('Show active admins')
  const [result, setResult] = useState<UserGenerativeResult>(() =>
    applyUserDirectoryGenerativePrompt('Show active admins', rows),
  )

  const applyPrompt = (nextPrompt: string): void => {
    startTransition(() => {
      setPrompt(nextPrompt)
      setResult(applyUserDirectoryGenerativePrompt(nextPrompt, rows))
    })
  }

  return (
    <section className="grid gap-4">
      <Card className="overflow-hidden border-primary/12 bg-[linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,255,255,0.92))]">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Generative lens
              </p>
              <CardTitle className="text-2xl">Natural-language user slicing</CardTitle>
            </div>
            <Badge variant="accent">Read-only</Badge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            This panel converts operator intent into a constrained local lens. It does not request
            additional data or unlock write paths.
          </p>
        </CardHeader>
        <CardContent className="grid gap-5 p-6">
          <Field>
            <FieldLabel htmlFor="generative-user-prompt">Prompt</FieldLabel>
            <div className="flex flex-col gap-3 lg:flex-row">
              <Input
                id="generative-user-prompt"
                onChange={(event) => {
                  setPrompt(event.target.value)
                }}
                placeholder='For example: "Show inactive viewers"'
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
            {userPromptSuggestions.map((suggestion) => (
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
                    <FieldLabel>Status</FieldLabel>
                    <Input readOnly value={result.draft.status} />
                  </Field>
                  <Field className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-3">
                    <FieldLabel>Search</FieldLabel>
                    <Input readOnly value={result.draft.search ?? 'none'} />
                  </Field>
                  <Field className="rounded-[var(--radius-lg)] border border-border/70 bg-background/75 p-3">
                    <FieldLabel>Role</FieldLabel>
                    <Input readOnly value={result.draft.roleCode ?? 'none'} />
                  </Field>
                </div>
              </CardContent>
            </Card>

            <GenerativeBarChart
              data={result.chartData}
              emptyMessage="The current prompt did not leave enough visible rows to build a role distribution."
              title="Role distribution"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-background/82 shadow-[var(--shadow-soft)]">
        <CardHeader className="gap-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Generative table
          </p>
          <CardTitle className="text-xl">Focused operator slice</CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.filteredRows.slice(0, 6).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">{row.username}</span>
                      <span className="text-sm text-muted-foreground">{row.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {row.roleCodes.length === 0 ? (
                        <Badge variant="secondary">unassigned</Badge>
                      ) : (
                        row.roleCodes.map((roleCode) => (
                          <Badge key={roleCode} variant="outline">
                            {roleCode}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.status ? 'accent' : 'secondary'}>
                      {row.status ? 'active' : 'inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(row.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
              {result.filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground" colSpan={4}>
                    The generated lens matched no visible operators in the current page slice.
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
