import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ReadBoundaryCard } from '@/components/control-plane/read-boundary-card'
import PageContainer from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { InfobarContent } from '@/components/ui/infobar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime } from '@/lib/format'
import { loadReportWorkspace, loadServerSummary } from '@/lib/server-ai-management'

function createInfoContent(): InfobarContent {
  return {
    title: 'Reports Workspace',
    sections: [
      {
        title: 'When to use this page',
        description:
          'Check schedule health first, then inspect export history and jump into workflow traces when the report pipeline looks stale or degraded.',
        links: [
          {
            title: 'Open report workflow traces',
            url: '/dashboard/observe/runs?toolId=workflow%3Areport-schedule',
          },
          {
            title: 'Open report eval posture',
            url: '/dashboard/improve/evals?search=report-schedule',
          },
        ],
      },
      {
        title: 'Assistant boundary',
        description:
          'The assistant may explain schedule gaps, failed exports, and missing snapshots, but this starter shell still keeps report execution read-only.',
      },
    ],
  }
}

function resolveStatusBadgeVariant(
  status: 'error' | 'forbidden' | 'success',
): 'default' | 'destructive' | 'secondary' {
  if (status === 'success') {
    return 'default'
  }

  if (status === 'error') {
    return 'destructive'
  }

  return 'secondary'
}

export default async function WorkspaceReportsPage(): Promise<ReactNode> {
  const [serverSummary, reportWorkspace] = await Promise.all([
    loadServerSummary(),
    loadReportWorkspace(),
  ])

  const latestSnapshotHref = reportWorkspace.latestExport
    ? (`/dashboard/observe/runs?auditId=${reportWorkspace.latestExport.value.id}&toolId=workflow%3Areport-schedule` as Route)
    : ('/dashboard/observe/runs?toolId=workflow%3Areport-schedule' as Route)

  return (
    <PageContainer
      pageTitle="Reports Workspace"
      pageDescription="Schedule health, export history, and workflow evidence for the report pipeline."
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Report schedule</CardDescription>
              <CardTitle>{reportWorkspace.schedule.name}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6">
              <div className="rounded-lg border px-4 py-3">
                <span className="text-muted-foreground block text-xs tracking-[0.16em] uppercase">
                  Cron
                </span>
                <span className="mt-2 block font-medium">
                  {reportWorkspace.schedule.schedule ?? 'manual'}
                </span>
              </div>
              <div className="rounded-lg border px-4 py-3">
                <span className="text-muted-foreground block text-xs tracking-[0.16em] uppercase">
                  Trigger health
                </span>
                <span className="mt-2 block font-medium">
                  {serverSummary.health.trigger.status}
                </span>
                <p className="text-muted-foreground mt-2">{serverSummary.health.jobs.detail}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Latest run</CardDescription>
              <CardTitle>
                {reportWorkspace.latestRun
                  ? formatDateTime(reportWorkspace.latestRun.value.createdAt)
                  : 'No visible runs'}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6">
              {reportWorkspace.latestRun ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={resolveStatusBadgeVariant(reportWorkspace.latestRun.value.status)}
                    >
                      {reportWorkspace.latestRun.value.status}
                    </Badge>
                    <Badge variant="outline">{reportWorkspace.latestRun.label}</Badge>
                  </div>
                  <p>{reportWorkspace.latestRun.value.toolId}</p>
                  <p className="text-muted-foreground">
                    Request ID: {reportWorkspace.latestRun.value.requestId ?? 'not captured'}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  The report workflow has not produced a visible audit row yet for this subject.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Latest export result</CardDescription>
              <CardTitle>
                {reportWorkspace.latestExport
                  ? reportWorkspace.latestExport.label
                  : 'No success yet'}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6">
              {reportWorkspace.latestExport ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={resolveStatusBadgeVariant(reportWorkspace.latestExport.value.status)}
                    >
                      {reportWorkspace.latestExport.value.status}
                    </Badge>
                    <Badge variant="secondary">
                      {formatDateTime(reportWorkspace.latestExport.value.createdAt)}
                    </Badge>
                  </div>
                  <p>
                    {reportWorkspace.latestExport.value.action}:
                    {reportWorkspace.latestExport.value.subject}
                  </p>
                  <p className="text-muted-foreground">
                    {reportWorkspace.latestExport.value.errorMessage ??
                      'Latest export evidence is healthy.'}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  No successful workflow export is visible yet. Inspect scheduled trigger rows
                  first.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
          <Card>
            <CardHeader>
              <CardDescription>Export history</CardDescription>
              <CardTitle>Recent report evidence</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reportWorkspace.exportHistory.length === 0 ? (
                <div className="text-muted-foreground p-6 text-sm leading-7">
                  No report workflow evidence is visible yet. Start with schedule health, then
                  confirm whether report audit rows are being written at all.
                </div>
              ) : (
                <div className="overflow-x-auto px-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tool</TableHead>
                        <TableHead>Request</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportWorkspace.exportHistory.map((entry) => (
                        <TableRow key={entry.value.id}>
                          <TableCell>
                            <Link
                              className="underline-offset-4 hover:underline"
                              href={
                                `/dashboard/observe/runs?auditId=${entry.value.id}&toolId=${encodeURIComponent(entry.value.toolId)}` as Route
                              }
                            >
                              {formatDateTime(entry.value.createdAt)}
                            </Link>
                          </TableCell>
                          <TableCell>{entry.label}</TableCell>
                          <TableCell>
                            <Badge variant={resolveStatusBadgeVariant(entry.value.status)}>
                              {entry.value.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{entry.value.toolId}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {entry.value.requestId ?? 'not captured'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Operator actions</CardDescription>
              <CardTitle>Next entry points</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ReadBoundaryCard
                description="Read-only execution boundary"
                links={[
                  {
                    href: '/dashboard/observe/runs?toolId=workflow%3Areport-schedule',
                    label: 'Open workflow traces',
                  },
                ]}
                nextStep="Use schedule health and workflow traces to confirm that the report pipeline is stable before introducing any write trigger."
                reason="Manual export remains backend-owned in this starter shell, so the reports workspace only exposes evidence, snapshots, and workflow drill-down."
                title="Manual export is not exposed here"
              />

              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">Primary next step</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  Start with the latest successful export evidence, then move into workflow traces
                  only if the snapshot is stale or degraded.
                </p>
                <div className="mt-4">
                  <Link
                    className="bg-primary text-primary-foreground inline-flex h-9 w-full items-center justify-center rounded-md px-4 text-sm font-medium"
                    href={latestSnapshotHref}
                  >
                    Open latest snapshot
                  </Link>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">Secondary drill-downs</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  Inspect scheduled trigger rows, workflow execution rows, and report eval posture
                  in the canonical dashboard routes.
                </p>
                <div className="mt-4 grid gap-2">
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm"
                    href="/dashboard/observe/runs?toolId=task%3Areport-schedule-trigger"
                  >
                    Scheduled trigger traces
                  </Link>
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm"
                    href="/dashboard/improve/evals?search=report-schedule"
                  >
                    Report eval posture
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
