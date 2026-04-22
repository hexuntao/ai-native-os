import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
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
  createAiGovernanceFilterState,
  createDashboardHref,
  type DashboardSearchParams,
  readSearchParam,
} from '@/lib/management'
import { loadAiGovernanceOverview, loadPromptGovernanceReview } from '@/lib/server-management'
import { cn } from '@/lib/utils'

interface BuildPromptsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function createInfoContent(): InfobarContent {
  return {
    title: 'Prompt Studio',
    sections: [
      {
        title: 'What this page is for',
        description:
          'Bring prompt release posture, linked eval evidence, and version pressure into one builder-facing workbench.',
      },
      {
        title: 'Operator boundary',
        description:
          'This page explains which prompt should be reviewed next and why. Activation still belongs to governance workflows.',
      },
    ],
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

function resolveReviewToneLabel(tone: 'critical' | 'neutral' | 'warning'): string {
  if (tone === 'critical') {
    return 'Critical'
  }

  if (tone === 'warning') {
    return 'Warning'
  }

  return 'Stable'
}

function resolveReviewActionLabel(action: string): string {
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

export default async function BuildPromptsPage({
  searchParams,
}: BuildPromptsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createAiGovernanceFilterState(resolvedSearchParams)
  const overview = await loadAiGovernanceOverview(filters)
  const requestedPromptKey = readSearchParam(resolvedSearchParams, 'promptKey')
  const selectedPromptKey = resolveSelectedPromptKey(
    resolvedSearchParams,
    overview.reviewQueue.map((entry) => entry.promptKey),
  )
  const selectedReview = selectedPromptKey
    ? await loadPromptGovernanceReview(selectedPromptKey)
    : null
  const hasActiveFilters = Boolean(filters.search)
  const selectionFellBack = Boolean(
    requestedPromptKey &&
      overview.reviewQueue.length > 0 &&
      !overview.reviewQueue.some((entry) => entry.promptKey === requestedPromptKey),
  )

  return (
    <PageContainer
      pageTitle="Prompt Studio"
      pageDescription="Builder-facing prompt governance surface with review queue, version posture, and linked evidence."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge="prompt-keys"
            detail="Prompt governance keys visible in the current slice."
            label="Prompt keys"
            value={formatCount(overview.summary.totalPromptKeys)}
          />
          <MetricCard
            badge="release-ready"
            detail="Prompt versions that currently satisfy release gate checks."
            label="Ready versions"
            value={formatCount(overview.summary.releaseReadyPromptVersions)}
          />
          <MetricCard
            badge="failure-audit"
            detail="Failure events linked to prompt review pressure."
            label="Failure events"
            value={formatCount(overview.summary.promptFailureEvents)}
            variant={overview.summary.promptFailureEvents > 0 ? 'secondary' : 'outline'}
          />
          <MetricCard
            badge="human-loop"
            detail="Human override count attached to the current prompt slice."
            label="Human overrides"
            value={formatCount(overview.summary.humanOverrideCount)}
            variant={overview.summary.humanOverrideCount > 0 ? 'secondary' : 'outline'}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(21rem,1fr)]">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardDescription>Filters</CardDescription>
                <CardTitle>Prompt queue search</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action="/dashboard/build/prompts"
                  className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_auto]"
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
                      href="/dashboard/build/prompts"
                    >
                      Reset
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Review queue</CardDescription>
                <CardTitle>Prompt review priorities</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {selectionFellBack ? (
                  <div className="px-4 pt-4">
                    <Alert>
                      <AlertTitle>Selection moved to the first visible prompt</AlertTitle>
                      <AlertDescription>
                        The previously selected prompt key is outside the current slice, so the
                        builder inspector fell back to the first visible row.
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : null}
                {overview.reviewQueue.length === 0 ? (
                  <div className="p-4">
                    <EmptyStateCard
                      action={{ href: '/dashboard/build/prompts', label: 'Reset prompt search' }}
                      description={
                        hasActiveFilters
                          ? 'The current prompt key query does not expose any builder-facing review items. Reset the search first, then decide whether the queue is genuinely clear.'
                          : 'No prompt governance items are visible yet in this slice. Wait for the next review item or confirm that prompt evidence is being emitted.'
                      }
                      title={
                        hasActiveFilters
                          ? 'No prompt items match this query'
                          : 'No prompt items are visible'
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
                            <TableHead>Prompt key</TableHead>
                            <TableHead>Review</TableHead>
                            <TableHead>Version</TableHead>
                            <TableHead>Failures</TableHead>
                            <TableHead>Linked eval</TableHead>
                            <TableHead>Updated</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {overview.reviewQueue.map((entry) => {
                            const isSelected = entry.promptKey === selectedPromptKey

                            return (
                              <TableRow
                                className={cn(isSelected && 'bg-sidebar-accent/45')}
                                key={entry.promptKey}
                              >
                                <TableCell>
                                  <Link
                                    className={cn(
                                      'font-medium underline-offset-4 hover:underline',
                                      isSelected && 'text-foreground',
                                    )}
                                    href={
                                      createDashboardHref(
                                        '/dashboard/build/prompts',
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
                                  <div className="grid gap-2">
                                    <Badge variant="secondary">
                                      {resolveReviewActionLabel(entry.reviewAction)}
                                    </Badge>
                                    <span className="text-muted-foreground text-xs">
                                      {resolveReviewToneLabel(entry.tone)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="grid gap-1">
                                    <span>v{entry.latestVersion.version}</span>
                                    <span className="text-muted-foreground text-xs">
                                      {entry.latestVersion.status}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>{formatCount(entry.failureCount)}</TableCell>
                                <TableCell>
                                  {entry.latestVersion.evalEvidence?.evalKey ?? 'not linked'}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDateTime(entry.latestVersion.updatedAt)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <PagePagination
                      nextHref={
                        overview.pagination.page < overview.pagination.totalPages
                          ? createDashboardHref('/dashboard/build/prompts', resolvedSearchParams, {
                              page: String(overview.pagination.page + 1),
                              promptKey: selectedPromptKey ?? undefined,
                            })
                          : undefined
                      }
                      page={overview.pagination.page}
                      pageSize={overview.pagination.pageSize}
                      previousHref={
                        overview.pagination.page > 1
                          ? createDashboardHref('/dashboard/build/prompts', resolvedSearchParams, {
                              page: String(overview.pagination.page - 1),
                              promptKey: selectedPromptKey ?? undefined,
                            })
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
              <CardDescription>Selected prompt</CardDescription>
              <CardTitle>{selectedReview?.promptKey ?? 'Select a prompt'}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {selectedReview ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {resolveReviewActionLabel(selectedReview.reviewItem.reviewAction)}
                    </Badge>
                    <Badge variant="outline">
                      v{selectedReview.reviewItem.latestVersion.version}
                    </Badge>
                    <Badge variant="outline">
                      eval:
                      {selectedReview.linkedEval.lastRunStatus ??
                        selectedReview.linkedEval.evidenceStatus ??
                        'none'}
                    </Badge>
                  </div>

                  <div className="grid gap-4 text-sm leading-6">
                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        Release posture
                      </p>
                      <div className="grid gap-2">
                        <p>review reason: {selectedReview.reviewItem.reviewReason}</p>
                        <p>
                          linked eval configured:{' '}
                          {selectedReview.linkedEval.configured ? 'yes' : 'no'}
                        </p>
                        <p>
                          latest release action:{' '}
                          {selectedReview.latestReleaseAudit?.summary.latestAction ??
                            'not recorded'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        Evidence posture
                      </p>
                      <div className="grid gap-2">
                        <p>
                          latest eval:{' '}
                          {selectedReview.linkedEval.evalName ??
                            selectedReview.linkedEval.evalKey ??
                            'not linked'}
                        </p>
                        <p>
                          rollback events:{' '}
                          {formatCount(selectedReview.rollbackChain.summary.totalRollbackEvents)}
                        </p>
                        <p>
                          changed fields:{' '}
                          {selectedReview.compareToPrevious?.summary.changedFields.join(', ') ??
                            'none'}
                        </p>
                        <p>
                          history versions:{' '}
                          {formatCount(selectedReview.history.summary.totalVersions)}
                        </p>
                        <p>
                          release-ready versions:{' '}
                          {formatCount(selectedReview.history.summary.releaseReadyCount)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                        Builder notes
                      </p>
                      <div className="grid gap-2">
                        <p>status: {selectedReview.reviewItem.latestVersion.status}</p>
                        <p>
                          active version id:{' '}
                          {selectedReview.history.summary.activeVersionId ?? 'none'}
                        </p>
                        <p>
                          release reason:{' '}
                          {selectedReview.reviewItem.latestVersion.releaseReason ?? 'release-ready'}
                        </p>
                        <p>
                          linked eval score:{' '}
                          {selectedReview.linkedEval.evidenceScoreAverage === null
                            ? 'n/a'
                            : `${Math.round(selectedReview.linkedEval.evidenceScoreAverage * 100)}%`}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyStateCard
                  description="Select a prompt key to inspect version posture, release pressure, and linked eval evidence."
                  title="No selected prompt"
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
