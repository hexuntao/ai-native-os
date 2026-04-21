import type {
  AiAuditListResponse,
  AiEvalListResponse,
  AiGovernanceOverview,
  ServerSummary
} from '@ai-native-os/shared';
import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { InfobarContent } from '@/components/ui/infobar';
import {
  loadAiAuditLogsList,
  loadAiEvalsList,
  loadAiGovernanceOverview,
  loadServerSummary
} from '@/lib/server-ai-management';
import type { ReactNode } from 'react';

const infoContent: InfobarContent = {
  title: 'AI Operations Center',
  sections: [
    {
      title: 'What this page is for',
      description:
        'Compress runtime health, governance pressure, eval posture, and recent evidence into one operator entry surface.',
      links: [
        {
          title: 'Open the governance workbench next',
          url: '/dashboard/govern/approvals'
        }
      ]
    },
    {
      title: 'Operator boundary',
      description:
        'This page helps prioritize the next action, but detailed review still belongs in runs, approvals, evals, and audit workbenches.'
    }
  ]
};

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function createSignals(
  serverSummary: ServerSummary,
  governanceOverview: AiGovernanceOverview,
  evalPayload: AiEvalListResponse,
  auditPayload: AiAuditListResponse
): {
  badge: string;
  detail: string;
  label: string;
  value: string;
}[] {
  const degradedRuns = auditPayload.data.filter(
    (row) => row.status === 'error' || row.status === 'forbidden'
  ).length;
  const failedEvalSuites = evalPayload.data.filter((row) => row.lastRunStatus === 'failed').length;

  return [
    {
      badge: `${serverSummary.runtime.enabledAgentCount}/${serverSummary.runtime.agentCount}`,
      detail: 'Enabled agents over total registered agents.',
      label: 'Active agents',
      value: formatCount(serverSummary.runtime.enabledAgentCount)
    },
    {
      badge: degradedRuns === 0 ? 'clear' : 'attention',
      detail: 'Recent audit slice with error or forbidden outcomes.',
      label: 'Degraded runs',
      value: formatCount(degradedRuns)
    },
    {
      badge: failedEvalSuites === 0 ? 'stable' : 'regression',
      detail: 'Visible eval suites whose latest run failed.',
      label: 'Eval regressions',
      value: formatCount(failedEvalSuites)
    },
    {
      badge: 'review queue',
      detail: 'Governance items waiting for human approval.',
      label: 'Pending approvals',
      value: formatCount(governanceOverview.reviewQueue.length)
    }
  ];
}

export default async function OverViewPage(): Promise<ReactNode> {
  const [serverSummary, governanceOverview, evalPayload, auditPayload] = await Promise.all([
    loadServerSummary(),
    loadAiGovernanceOverview({ page: 1, pageSize: 5, search: undefined }),
    loadAiEvalsList({ page: 1, pageSize: 5, search: undefined }),
    loadAiAuditLogsList({
      page: 1,
      pageSize: 5,
      search: undefined,
      status: 'all',
      toolId: undefined
    })
  ]);

  const signals = createSignals(serverSummary, governanceOverview, evalPayload, auditPayload);

  return (
    <PageContainer
      pageTitle='AI Operations Center'
      pageDescription='System-wide AI operating picture with runtime, governance, eval, and recent evidence signals.'
      infoContent={infoContent}
    >
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {signals.map((signal) => (
            <Card
              className='@container/card *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs'
              key={signal.label}
            >
              <CardHeader>
                <CardDescription>{signal.label}</CardDescription>
                <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                  {signal.value}
                </CardTitle>
                <div className='pt-2'>
                  <Badge variant='outline'>{signal.badge}</Badge>
                </div>
              </CardHeader>
              <CardContent className='text-muted-foreground text-sm'>{signal.detail}</CardContent>
            </Card>
          ))}
        </div>

        <div className='grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]'>
          <Card>
            <CardHeader>
              <CardDescription>Runtime dependency posture</CardDescription>
              <CardTitle>Live system map</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3 text-sm leading-6'>
              <div className='rounded-lg border p-4'>
                Agents: {serverSummary.runtime.enabledAgentCount} enabled /{' '}
                {serverSummary.runtime.agentCount} registered
              </div>
              <div className='rounded-lg border p-4'>
                Tools: {serverSummary.runtime.toolCount} registered tool surfaces.
              </div>
              <div className='rounded-lg border p-4'>
                Workflows: {serverSummary.runtime.workflowCount} active workflow entries.
              </div>
              <div className='rounded-lg border p-4'>
                AI capability: {serverSummary.health.ai.status} · {serverSummary.health.ai.reason}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Current release posture</CardDescription>
              <CardTitle>Release pipeline</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3 text-sm leading-6'>
              <div className='rounded-lg border p-4'>Prompt draft → Eval → Approval → Release</div>
              <div className='rounded-lg border p-4'>
                Release-ready prompt versions:{' '}
                {formatCount(governanceOverview.summary.releaseReadyPromptVersions)}
              </div>
              <div className='rounded-lg border p-4'>
                Total eval experiments:{' '}
                {formatCount(governanceOverview.summary.totalEvalExperiments)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className='grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]'>
          <Card>
            <CardHeader>
              <CardDescription>Highest-pressure surfaces</CardDescription>
              <CardTitle>Attention queue</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3'>
              {governanceOverview.reviewQueue.slice(0, 4).map((entry) => (
                <div className='rounded-lg border p-4' key={entry.promptKey}>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='outline'>{entry.reviewAction}</Badge>
                    <Badge variant='secondary'>v{entry.latestVersion.version}</Badge>
                  </div>
                  <p className='mt-3 text-sm font-medium'>{entry.promptKey}</p>
                  <p className='text-muted-foreground mt-1 text-sm leading-6'>
                    {entry.reviewReason}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Latest evidence</CardDescription>
              <CardTitle>Recent high-impact events</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3'>
              {auditPayload.data.slice(0, 5).map((row) => (
                <div className='rounded-lg border p-4' key={row.id}>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant={row.status === 'success' ? 'secondary' : 'outline'}>
                      {row.status}
                    </Badge>
                    <span className='text-muted-foreground text-xs'>
                      {formatDateTime(row.createdAt)}
                    </span>
                  </div>
                  <p className='mt-3 text-sm font-medium'>
                    {row.action}:{row.subject}
                  </p>
                  <p className='text-muted-foreground mt-1 text-sm'>{row.toolId}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
