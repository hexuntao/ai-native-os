import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
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
  createAiGovernanceFilterState,
  createDashboardHref,
  type DashboardSearchParams,
} from '@/lib/management'
import { loadAiGovernanceOverview, loadPromptGovernanceReview } from '@/lib/server-management'

interface GovernApprovalsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function createInfoContent(): InfobarContent {
  return {
    title: 'Approval Queue',
    sections: [
      {
        title: 'What this page is for',
        description:
          'Review governance queue pressure, then inspect one evidence bundle at a time before deciding whether the prompt is ready for activation or further investigation.',
      },
      {
        title: 'Operator boundary',
        description:
          'This queue does not execute release writes. It aggregates release gate, eval evidence, failure audit, and rollback chain into a human review surface.',
      },
    ],
  }
}

function resolveApprovalLabel(action: string): string {
  switch (action) {
    case 'activate_ready_version':
      return 'Activate'
    case 'attach_eval_evidence':
      return 'Attach eval'
    case 'investigate_exception':
      return 'Investigate'
    case 'review_override':
      return 'Review override'
    case 'review_release_gate':
      return 'Review gate'
    default:
      return 'Watch'
  }
}

function resolveSelectedPromptKey(
  searchParams: DashboardSearchParams,
  promptKeys: readonly string[],
): string | null {
  const promptKeyValue = searchParams.promptKey
  const promptKey = Array.isArray(promptKeyValue) ? promptKeyValue[0] : promptKeyValue

  if (promptKey && promptKeys.includes(promptKey)) {
    return promptKey
  }

  return promptKeys[0] ?? null
}

export default async function GovernApprovalsPage({
  searchParams,
}: GovernApprovalsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createAiGovernanceFilterState(resolvedSearchParams)
  const overview = await loadAiGovernanceOverview(filters)
  const selectedPromptKey = resolveSelectedPromptKey(
    resolvedSearchParams,
    overview.reviewQueue.map((entry) => entry.promptKey),
  )
  const selectedReview = selectedPromptKey
    ? await loadPromptGovernanceReview(selectedPromptKey)
    : null

  return (
    <PageContainer
      pageTitle="Approval Queue"
      pageDescription="Release gate, eval evidence, failure audit, and rollback chain in one governance review surface."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="queue"
            detail="Prompt governance items waiting for human review."
            label="Approval items"
            value={formatCount(overview.reviewQueue.length)}
            variant={overview.reviewQueue.length > 0 ? 'secondary' : 'outline'}
          />
          <MetricCard
            badge="release-ready"
            detail="Prompt versions currently satisfying release gate checks."
            label="Ready versions"
            value={formatCount(overview.summary.releaseReadyPromptVersions)}
          />
          <MetricCard
            badge="failures"
            detail="Failure events contributing pressure to the current queue slice."
            label="Failure pressure"
            value={formatCount(overview.summary.promptFailureEvents)}
            variant={overview.summary.promptFailureEvents > 0 ? 'secondary' : 'outline'}
          />
          <MetricCard
            badge="human-loop"
            detail="Human override count captured in the current governance slice."
            label="Overrides"
            value={formatCount(overview.summary.humanOverrideCount)}
            variant={overview.summary.humanOverrideCount > 0 ? 'secondary' : 'outline'}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardDescription>Filters</CardDescription>
                <CardTitle>Queue search</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action="/dashboard/govern/approvals"
                  className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_auto]"
                  method="GET"
                >
                  <input name="page" type="hidden" value="1" />
                  <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
                  {selectedPromptKey ? (
                    <input name="promptKey" type="hidden" value={selectedPromptKey} />
                  ) : null}

                  <Field>
                    <FieldLabel htmlFor="search">Prompt key search</FieldLabel>
                    <Input
                      defaultValue={filters.search}
                      id="search"
                      name="search"
                      placeholder="admin.copilot.answer"
                    />
                  </Field>

                  <div className="flex items-end gap-3">
                    <Link
                      className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
                      href="/dashboard/govern/approvals"
                    >
                      Reset
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Approval queue</CardDescription>
                <CardTitle>Governance review priorities</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {overview.reviewQueue.length === 0 ? (
                  <div className="text-muted-foreground p-6 text-sm leading-7">
                    No approval items are visible in this slice. Reset the search first, then decide
                    whether the empty queue is healthy or a governance visibility gap.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto px-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Prompt key</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Version</TableHead>
                            <TableHead>Failures</TableHead>
                            <TableHead>Linked eval</TableHead>
                            <TableHead>Updated</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {overview.reviewQueue.map((entry) => (
                            <TableRow key={entry.promptKey}>
                              <TableCell>
                                <Link
                                  className="font-medium underline-offset-4 hover:underline"
                                  href={
                                    createDashboardHref(
                                      '/dashboard/govern/approvals',
                                      resolvedSearchParams,
                                      {
                                        page: undefined,
                                        promptKey: entry.promptKey,
                                      },
                                    ) as Route
                                  }
                                >
                                  {entry.promptKey}
                                </Link>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {resolveApprovalLabel(entry.reviewAction)}
                                </Badge>
                              </TableCell>
                              <TableCell>v{entry.latestVersion.version}</TableCell>
                              <TableCell>{formatCount(entry.failureCount)}</TableCell>
                              <TableCell>
                                {entry.latestVersion.evalEvidence?.evalKey ?? 'not linked'}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDateTime(entry.latestVersion.updatedAt)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <PagePagination
                      nextHref={
                        overview.pagination.page < overview.pagination.totalPages
                          ? createDashboardHref(
                              '/dashboard/govern/approvals',
                              resolvedSearchParams,
                              {
                                page: String(overview.pagination.page + 1),
                                promptKey: selectedPromptKey ?? undefined,
                              },
                            )
                          : undefined
                      }
                      page={overview.pagination.page}
                      pageSize={overview.pagination.pageSize}
                      previousHref={
                        overview.pagination.page > 1
                          ? createDashboardHref(
                              '/dashboard/govern/approvals',
                              resolvedSearchParams,
                              {
                                page: String(overview.pagination.page - 1),
                                promptKey: selectedPromptKey ?? undefined,
                              },
                            )
                          : undefined
                      }
                      total={overview.pagination.total}
                      totalPages={overview.pagination.totalPages}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardDescription>Evidence bundle</CardDescription>
              <CardTitle>{selectedReview?.promptKey ?? 'Select an approval item'}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {selectedReview ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {resolveApprovalLabel(selectedReview.reviewItem.reviewAction)}
                    </Badge>
                    <Badge variant="outline">
                      latest:v{selectedReview.reviewItem.latestVersion.version}
                    </Badge>
                    <Badge variant="outline">
                      eval:
                      {selectedReview.linkedEval.lastRunStatus ??
                        selectedReview.linkedEval.evidenceStatus ??
                        'none'}
                    </Badge>
                  </div>

                  <p className="text-muted-foreground text-sm leading-7">
                    {selectedReview.reviewItem.reviewReason}
                  </p>

                  <div className="grid gap-4 text-sm leading-6">
                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        Policy checks
                      </p>
                      <div className="grid gap-2">
                        <p>
                          linked eval configured:{' '}
                          {selectedReview.linkedEval.configured ? 'yes' : 'no'}
                        </p>
                        <p>
                          release gate rejection:{' '}
                          {selectedReview.failureAudit.summary.hasReleaseGateRejection
                            ? 'yes'
                            : 'no'}
                        </p>
                        <p>
                          rollback events:{' '}
                          {formatCount(selectedReview.rollbackChain.summary.totalRollbackEvents)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        Evidence
                      </p>
                      <div className="grid gap-2">
                        <p>
                          latest eval:{' '}
                          {selectedReview.linkedEval.evalName ??
                            selectedReview.linkedEval.evalKey ??
                            'not linked'}
                        </p>
                        <p>
                          latest release action:{' '}
                          {selectedReview.latestReleaseAudit?.summary.latestAction ??
                            'not recorded'}
                        </p>
                        <p>
                          compare changed fields:{' '}
                          {selectedReview.compareToPrevious?.summary.changedFields.join(', ') ??
                            'none'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        Recommendation
                      </p>
                      <p>
                        Review failure audit and linked eval first, then decide whether the prompt
                        is ready for activation or needs more evidence.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm leading-7">
                  Select an approval item from the queue to inspect policy checks, evidence, and a
                  minimum safe next step.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
