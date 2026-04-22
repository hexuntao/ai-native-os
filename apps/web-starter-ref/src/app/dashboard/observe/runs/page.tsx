import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AiFeedbackDialog } from '@/components/ai/ai-feedback-dialog'
import { MetricCard } from '@/components/control-plane/metric-card'
import { PagePagination } from '@/components/control-plane/page-pagination'
import PageContainer from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import type { InfobarContent } from '@/components/ui/infobar'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCount, formatDateTime } from '@/lib/format'
import {
  createAiAuditFilterState,
  createDashboardHref,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadAiAuditDetail, loadAiAuditLogsList } from '@/lib/server-management'

interface ObserveRunsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function createInfoContent(): InfobarContent {
  return {
    title: 'Runs & Traces',
    sections: [
      {
        title: 'What this page is for',
        description:
          'Inspect runtime evidence one execution at a time, then decide whether the next step belongs in triage, approval, or prompt iteration.',
      },
      {
        title: 'Operator boundary',
        description:
          'This page is read-model only. It surfaces execution evidence and human overrides, but it does not directly mutate release or governance state.',
        links: [
          {
            title: 'Open Approval Queue',
            url: '/dashboard/govern/approvals',
          },
        ],
      },
    ],
  }
}

function resolveSelectedAuditId(
  searchParams: DashboardSearchParams,
  auditIds: readonly string[],
): string | null {
  const auditIdValue = searchParams.auditId
  const auditId = Array.isArray(auditIdValue) ? auditIdValue[0] : auditIdValue

  if (auditId && auditIds.includes(auditId)) {
    return auditId
  }

  return auditIds[0] ?? null
}

function resolveBadgeVariant(
  status: 'error' | 'forbidden' | 'success',
): 'default' | 'destructive' | 'secondary' {
  if (status === 'error') {
    return 'destructive'
  }

  if (status === 'forbidden') {
    return 'secondary'
  }

  return 'default'
}

const selectClassName =
  'border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none'

export default async function ObserveRunsPage({
  searchParams,
}: ObserveRunsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createAiAuditFilterState(resolvedSearchParams)
  const payload = await loadAiAuditLogsList(filters)
  const selectedAuditId = resolveSelectedAuditId(
    resolvedSearchParams,
    payload.data.map((row) => row.id),
  )
  const selectedEntry =
    payload.data.find((row) => row.id === selectedAuditId) ?? payload.data[0] ?? null
  const selectedDetail = selectedEntry ? await loadAiAuditDetail(selectedEntry.id) : null
  const degradedCount = payload.data.filter(
    (row) => row.status === 'error' || row.status === 'forbidden',
  ).length
  const overrideCount = payload.data.filter((row) => row.humanOverride).length
  const feedbackCount = payload.data.reduce((sum, row) => sum + row.feedbackCount, 0)

  return (
    <PageContainer
      pageTitle="Runs & Traces"
      pageDescription="Operator-visible execution slice with filters, runtime status, and trace-level evidence."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="runs"
            detail="Total visible audit events in the current runtime slice."
            label="Visible runs"
            value={formatCount(payload.pagination.total)}
          />
          <MetricCard
            badge={degradedCount === 0 ? 'clear' : 'triage'}
            detail="Rows in this slice with error or forbidden outcomes."
            label="Needs triage"
            value={formatCount(degradedCount)}
            variant={degradedCount === 0 ? 'outline' : 'secondary'}
          />
          <MetricCard
            badge={overrideCount === 0 ? 'none' : 'human-loop'}
            detail="Executions already touched by human override."
            label="Overrides"
            value={formatCount(overrideCount)}
            variant={overrideCount === 0 ? 'outline' : 'secondary'}
          />
          <MetricCard
            badge="feedback"
            detail="Human feedback records linked to the current page slice."
            label="Feedback links"
            value={formatCount(feedbackCount)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardDescription>Filters</CardDescription>
                <CardTitle>Trace query</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action="/dashboard/observe/runs"
                  className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                  method="GET"
                >
                  <input name="page" type="hidden" value="1" />
                  <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
                  {selectedEntry ? (
                    <input name="auditId" type="hidden" value={selectedEntry.id} />
                  ) : null}

                  <Field>
                    <FieldLabel htmlFor="search">Trace search</FieldLabel>
                    <Input
                      defaultValue={filters.search}
                      id="search"
                      name="search"
                      placeholder="request id or tool"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="status">Status</FieldLabel>
                    <select
                      className={selectClassName}
                      defaultValue={filters.status}
                      id="status"
                      name="status"
                    >
                      <option value="all">All statuses</option>
                      <option value="success">Success</option>
                      <option value="forbidden">Forbidden</option>
                      <option value="error">Error</option>
                    </select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="toolId">Tool ID</FieldLabel>
                    <Input
                      defaultValue={filters.toolId}
                      id="toolId"
                      name="toolId"
                      placeholder="knowledge-semantic-search"
                    />
                  </Field>

                  <div className="flex items-end gap-3">
                    <Link
                      className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
                      href="/dashboard/observe/runs"
                    >
                      Reset
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Run table</CardDescription>
                <CardTitle>Operator-visible execution slice</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {payload.data.length === 0 ? (
                  <div className="text-muted-foreground p-6 text-sm leading-7">
                    No runs matched the current filters. Reset the slice first, then decide whether
                    the missing evidence is expected or a runtime visibility gap.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto px-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Tool</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Feedback</TableHead>
                            <TableHead>Request</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payload.data.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="text-muted-foreground">
                                <Link
                                  className="underline-offset-4 hover:underline"
                                  href={
                                    createDashboardHref(
                                      '/dashboard/observe/runs',
                                      resolvedSearchParams,
                                      {
                                        auditId: row.id,
                                        page: undefined,
                                      },
                                    ) as Route
                                  }
                                >
                                  {formatDateTime(row.createdAt)}
                                </Link>
                              </TableCell>
                              <TableCell className="font-medium">{row.toolId}</TableCell>
                              <TableCell>
                                {row.action}:{row.subject}
                              </TableCell>
                              <TableCell>
                                <Badge variant={resolveBadgeVariant(row.status)}>
                                  {row.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{row.feedbackCount}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {row.requestId ?? 'no request id'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <PagePagination
                      nextHref={
                        payload.pagination.page < payload.pagination.totalPages
                          ? createDashboardHref('/dashboard/observe/runs', resolvedSearchParams, {
                              page: String(payload.pagination.page + 1),
                              auditId: selectedEntry?.id ?? undefined,
                            })
                          : undefined
                      }
                      page={payload.pagination.page}
                      pageSize={payload.pagination.pageSize}
                      previousHref={
                        payload.pagination.page > 1
                          ? createDashboardHref('/dashboard/observe/runs', resolvedSearchParams, {
                              page: String(payload.pagination.page - 1),
                              auditId: selectedEntry?.id ?? undefined,
                            })
                          : undefined
                      }
                      total={payload.pagination.total}
                      totalPages={payload.pagination.totalPages}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardDescription>Trace inspector</CardDescription>
              <CardTitle>{selectedEntry ? selectedEntry.toolId : 'Select a run'}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {selectedEntry ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={resolveBadgeVariant(selectedEntry.status)}>
                      {selectedEntry.status}
                    </Badge>
                    <Badge variant="outline">
                      {selectedEntry.action}:{selectedEntry.subject}
                    </Badge>
                    <Badge variant="outline">
                      override:{selectedEntry.humanOverride ? 'yes' : 'no'}
                    </Badge>
                  </div>

                  <AiFeedbackDialog
                    auditLogId={selectedEntry.id}
                    feedbackCount={selectedEntry.feedbackCount}
                    humanOverride={selectedEntry.humanOverride}
                    latestUserAction={selectedEntry.latestUserAction}
                    toolId={selectedEntry.toolId}
                  />

                  <div className="grid gap-4 text-sm leading-6">
                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        Step timeline
                      </p>
                      <div className="grid gap-2">
                        <p>1. Request captured at {formatDateTime(selectedEntry.createdAt)}</p>
                        <p>
                          2. Tool `{selectedEntry.toolId}` resolved for action `
                          {selectedEntry.action}`
                        </p>
                        <p>
                          3. Subject `{selectedEntry.subject}` evaluated under the current
                          permission boundary
                        </p>
                        <p>4. Runtime finished with status `{selectedEntry.status}`</p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        Metadata
                      </p>
                      <div className="grid gap-2">
                        <p>requestId: {selectedEntry.requestId ?? 'none'}</p>
                        <p>feedbackCount: {selectedEntry.feedbackCount}</p>
                        <p>errorMessage: {selectedEntry.errorMessage ?? 'none'}</p>
                        <p>
                          override:{' '}
                          {selectedEntry.humanOverride ? 'human-in-the-loop' : 'no override'}
                        </p>
                        <p>
                          latestUserAction: {selectedEntry.latestUserAction ?? 'no user action'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        Request context
                      </p>
                      <div className="grid gap-2">
                        <p>
                          actor:{' '}
                          {selectedEntry.actorRbacUserId ??
                            selectedEntry.actorAuthUserId ??
                            'system'}
                        </p>
                        <p>
                          roles:{' '}
                          {selectedEntry.roleCodes.length > 0
                            ? selectedEntry.roleCodes.join(', ')
                            : 'none'}
                        </p>
                        <p>sourceType: {selectedDetail?.requestInfo?.sourceType ?? 'none'}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        Evidence trail
                      </p>
                      {selectedDetail?.feedback.length ? (
                        <div className="grid gap-3">
                          {selectedDetail.feedback.map((feedback) => (
                            <div className="rounded-md border p-3" key={feedback.id}>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">{feedback.userAction}</Badge>
                                <Badge variant="outline">
                                  {feedback.accepted ? 'accepted' : 'corrected'}
                                </Badge>
                              </div>
                              <p className="mt-2 text-muted-foreground">
                                {feedback.feedbackText ??
                                  feedback.correction ??
                                  'No note recorded.'}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {formatDateTime(feedback.createdAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No feedback evidence linked yet.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm leading-7">
                  Select a run from the table to inspect execution evidence, request context, and
                  human override posture.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
