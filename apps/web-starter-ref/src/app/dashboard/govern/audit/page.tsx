import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AiFeedbackDialog } from '@/components/ai/ai-feedback-dialog'
import { EmptyStateCard } from '@/components/control-plane/empty-state-card'
import { MetricCard } from '@/components/control-plane/metric-card'
import { PagePagination } from '@/components/control-plane/page-pagination'
import PageContainer from '@/components/layout/page-container'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  readSearchParam,
} from '@/lib/management'
import { loadAiAuditDetail, loadAiAuditLogsList } from '@/lib/server-management'
import { cn } from '@/lib/utils'

interface GovernAuditPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function createInfoContent(): InfobarContent {
  return {
    title: 'Audit Ledger',
    sections: [
      {
        title: 'What this page is for',
        description:
          'Inspect tool-level governance evidence, including forbidden calls, runtime errors, and human overrides, in a single ledger.',
      },
      {
        title: 'Operator boundary',
        description:
          'This page explains audit pressure. It does not replace approval review or prompt release controls.',
      },
    ],
  }
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

const selectClassName =
  'border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none'

export default async function GovernAuditPage({
  searchParams,
}: GovernAuditPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createAiAuditFilterState(resolvedSearchParams)
  const payload = await loadAiAuditLogsList(filters)
  const requestedAuditId = readSearchParam(resolvedSearchParams, 'auditId')
  const forbiddenCount = payload.data.filter((row) => row.status === 'forbidden').length
  const overrideCount = payload.data.filter((row) => row.humanOverride).length
  const errorCount = payload.data.filter((row) => row.status === 'error').length
  const selectedAuditId = resolveSelectedAuditId(
    resolvedSearchParams,
    payload.data.map((row) => row.id),
  )
  const selectedEntry =
    payload.data.find((row) => row.id === selectedAuditId) ?? payload.data[0] ?? null
  const selectedDetail = selectedEntry ? await loadAiAuditDetail(selectedEntry.id) : null
  const hasActiveFilters = Boolean(filters.toolId || filters.status !== 'all')
  const selectionFellBack = Boolean(
    requestedAuditId &&
      payload.data.length > 0 &&
      !payload.data.some((row) => row.id === requestedAuditId),
  )

  return (
    <PageContainer
      pageTitle="Audit Ledger"
      pageDescription="Tool-level audit evidence with status filters, pressure signals, and selected event detail."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="ledger"
            detail="Visible AI audit events in the current governance slice."
            label="Audit events"
            value={formatCount(payload.pagination.total)}
          />
          <MetricCard
            badge={forbiddenCount === 0 ? 'clear' : 'attention'}
            detail="Rows blocked by policy or permission boundaries."
            label="Forbidden"
            value={formatCount(forbiddenCount)}
            variant={forbiddenCount === 0 ? 'outline' : 'secondary'}
          />
          <MetricCard
            badge={overrideCount === 0 ? 'none' : 'human-loop'}
            detail="Events already linked to human override."
            label="Overrides"
            value={formatCount(overrideCount)}
            variant={overrideCount === 0 ? 'outline' : 'secondary'}
          />
          <MetricCard
            badge={errorCount === 0 ? 'stable' : 'investigate'}
            detail="Runtime failures that are not simple permission denials."
            label="Errors"
            value={formatCount(errorCount)}
            variant={errorCount === 0 ? 'outline' : 'destructive'}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardDescription>Filters</CardDescription>
                <CardTitle>Audit query</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action="/dashboard/govern/audit"
                  className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]"
                  method="GET"
                >
                  <input name="page" type="hidden" value="1" />
                  <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
                  {selectedEntry ? (
                    <input name="auditId" type="hidden" value={selectedEntry.id} />
                  ) : null}

                  <Field>
                    <FieldLabel htmlFor="toolId">Tool ID</FieldLabel>
                    <Input
                      defaultValue={filters.toolId}
                      id="toolId"
                      name="toolId"
                      placeholder="knowledge-semantic-search"
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

                  <div className="flex items-end gap-3">
                    <Link
                      className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
                      href="/dashboard/govern/audit"
                    >
                      Reset
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Audit table</CardDescription>
                <CardTitle>Tool execution ledger</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {selectionFellBack ? (
                  <div className="px-4 pt-4">
                    <Alert>
                      <AlertTitle>Selection moved to the first visible audit event</AlertTitle>
                      <AlertDescription>
                        The previously selected audit row is outside the current slice, so the
                        evidence panel fell back to the first visible entry.
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : null}
                {payload.data.length === 0 ? (
                  <div className="p-4">
                    <EmptyStateCard
                      action={{ href: '/dashboard/govern/audit', label: 'Reset audit query' }}
                      description={
                        hasActiveFilters
                          ? 'The current audit query does not expose any visible governance events. Reset the slice first, then decide whether the empty result is expected.'
                          : 'No governance audit rows are visible yet. Wait for the next event or verify that tool-level audit evidence is being written.'
                      }
                      title={
                        hasActiveFilters
                          ? 'No audit rows match this query'
                          : 'No audit rows are visible'
                      }
                      tone={hasActiveFilters ? 'no-match' : 'no-data'}
                    />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto px-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tool</TableHead>
                            <TableHead>Scope</TableHead>
                            <TableHead>Actor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Feedback</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payload.data.map((row) => {
                            const isSelected = row.id === selectedEntry?.id

                            return (
                              <TableRow
                                className={cn(isSelected && 'bg-sidebar-accent/45')}
                                key={row.id}
                              >
                                <TableCell>
                                  <Link
                                    className={cn(
                                      'font-medium underline-offset-4 hover:underline',
                                      isSelected && 'text-foreground',
                                    )}
                                    href={
                                      createDashboardHref(
                                        '/dashboard/govern/audit',
                                        resolvedSearchParams,
                                        {
                                          auditId: row.id,
                                          page: undefined,
                                        },
                                      ) as Route
                                    }
                                  >
                                    {row.toolId}
                                  </Link>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {row.action}:{row.subject}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {row.actorRbacUserId ?? row.actorAuthUserId ?? 'system'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={resolveBadgeVariant(row.status)}>
                                    {row.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {row.feedbackCount} · {row.latestUserAction ?? 'no action'}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDateTime(row.createdAt)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <PagePagination
                      nextHref={
                        payload.pagination.page < payload.pagination.totalPages
                          ? createDashboardHref('/dashboard/govern/audit', resolvedSearchParams, {
                              page: String(payload.pagination.page + 1),
                              auditId: selectedEntry?.id ?? undefined,
                            })
                          : undefined
                      }
                      page={payload.pagination.page}
                      pageSize={payload.pagination.pageSize}
                      previousHref={
                        payload.pagination.page > 1
                          ? createDashboardHref('/dashboard/govern/audit', resolvedSearchParams, {
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
              <CardDescription>Selected evidence</CardDescription>
              <CardTitle>{selectedEntry?.toolId ?? 'Select an audit event'}</CardTitle>
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
                        Execution summary
                      </p>
                      <div className="grid gap-2">
                        <p>createdAt: {formatDateTime(selectedEntry.createdAt)}</p>
                        <p>toolId: {selectedEntry.toolId}</p>
                        <p>
                          scope: {selectedEntry.action}:{selectedEntry.subject}
                        </p>
                        <p>status: {selectedEntry.status}</p>
                        <p>requestId: {selectedEntry.requestId ?? 'none'}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        Evidence / metadata
                      </p>
                      <div className="grid gap-2">
                        <p>feedbackCount: {selectedEntry.feedbackCount}</p>
                        <p>latestUserAction: {selectedEntry.latestUserAction ?? 'none'}</p>
                        <p>latestFeedbackAt: {selectedEntry.latestFeedbackAt ?? 'none'}</p>
                        <p>
                          requestId:{' '}
                          {selectedDetail?.requestInfo?.requestId ??
                            selectedEntry.requestId ??
                            'none'}
                        </p>
                        <p>sourceType: {selectedDetail?.requestInfo?.sourceType ?? 'none'}</p>
                        <p>
                          actor:{' '}
                          {selectedEntry.actorRbacUserId ??
                            selectedEntry.actorAuthUserId ??
                            'system'}
                        </p>
                        <p>
                          role snapshot:{' '}
                          {selectedEntry.roleCodes.length > 0
                            ? selectedEntry.roleCodes.join(', ')
                            : 'none'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        Human feedback / override
                      </p>
                      <p className="text-muted-foreground mb-3 text-sm leading-6">
                        {selectedEntry.humanOverride
                          ? 'This event already crossed a human override boundary. Review the feedback trail before escalating to prompt review or runtime triage.'
                          : 'No human override is attached yet. Use this trail to determine whether the event should stay in audit review or move into another workbench.'}
                      </p>
                      {selectedDetail?.feedback.length ? (
                        <div className="grid gap-3">
                          {selectedDetail.feedback.map((feedback) => (
                            <div className="rounded-md border p-3" key={feedback.id}>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">{feedback.userAction}</Badge>
                                <Badge variant="outline">
                                  {feedback.accepted ? 'accepted' : 'human edit'}
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
                        <p className="text-muted-foreground">No feedback entries are linked yet.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <EmptyStateCard
                  description="Select an audit event to inspect execution summary, evidence metadata, and human feedback posture."
                  title="No selected audit event"
                  tone="no-data"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
