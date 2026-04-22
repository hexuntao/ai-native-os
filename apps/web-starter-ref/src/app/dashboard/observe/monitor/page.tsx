import type { ReactNode } from 'react'
import { MetricCard } from '@/components/control-plane/metric-card'
import PageContainer from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { InfobarContent } from '@/components/ui/infobar'
import { formatCount } from '@/lib/format'
import { loadOnlineUsersList, loadServerSummary } from '@/lib/server-management'

function createInfoContent(): InfobarContent {
  return {
    title: '运行监控',
    sections: [
      {
        title: '页面用途',
        description:
          '把 API、任务、Worker 和已认证会话态势放到同一个操作面里，方便在进入追踪前先分诊运行压力。',
      },
      {
        title: '操作边界',
        description:
          '这个页面是观测中心。它用于解释健康与会话态势，但不能替代更深入的追踪或审批证据。',
      },
    ],
  }
}

function resolveHealthVariant(status: string): 'default' | 'destructive' | 'secondary' {
  if (status === 'ok') {
    return 'default'
  }

  return 'secondary'
}

export default async function ObserveMonitorPage(): Promise<ReactNode> {
  const [serverSummary, onlinePayload] = await Promise.all([
    loadServerSummary(),
    loadOnlineUsersList({ page: 1, pageSize: 5, search: undefined }),
  ])

  const distinctRoles = new Set(onlinePayload.data.flatMap((row) => row.roleCodes)).size
  const unmappedCount = onlinePayload.data.filter((row) => row.roleCodes.length === 0).length

  return (
    <PageContainer
      pageTitle="运行监控"
      pageDescription="在同一个控制台工作面中查看服务健康、AI 能力态势与当前已认证在线情况。"
      infoContent={createInfoContent()}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            badge={serverSummary.health.status}
            detail={`ai:${serverSummary.health.ai.status} · jobs:${serverSummary.health.jobs.status} · worker:${serverSummary.health.worker.status}`}
            label="运行状态"
            value={serverSummary.health.status}
            variant={serverSummary.health.status === 'ok' ? 'default' : 'secondary'}
          />
          <MetricCard
            badge="agents"
            detail={`${serverSummary.runtime.enabledAgentCount}/${serverSummary.runtime.agentCount} 个代理已启用`}
            label="AI 运行时"
            value={formatCount(serverSummary.runtime.toolCount)}
          />
          <MetricCard
            badge="sessions"
            detail="当前页面切片中可见的已认证会话。"
            label="活跃会话"
            value={formatCount(onlinePayload.pagination.total)}
          />
          <MetricCard
            badge={unmappedCount === 0 ? 'mapped' : 'attention'}
            detail="在线但没有映射 RBAC 角色编码的用户。"
            label="未映射用户"
            value={formatCount(unmappedCount)}
            variant={unmappedCount === 0 ? 'outline' : 'secondary'}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardDescription>依赖概览</CardDescription>
              <CardTitle>运行健康</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={resolveHealthVariant(serverSummary.health.database)}>
                  database:{serverSummary.health.database}
                </Badge>
                <Badge variant={resolveHealthVariant(serverSummary.health.redis)}>
                  redis:{serverSummary.health.redis}
                </Badge>
                <Badge variant={resolveHealthVariant(serverSummary.health.jobs.status)}>
                  jobs:{serverSummary.health.jobs.status}
                </Badge>
                <Badge variant={resolveHealthVariant(serverSummary.health.worker.status)}>
                  worker:{serverSummary.health.worker.status}
                </Badge>
                <Badge variant={resolveHealthVariant(serverSummary.health.ai.status)}>
                  ai:{serverSummary.health.ai.status}
                </Badge>
              </div>

              <div className="grid gap-3 text-sm leading-6">
                <div className="rounded-lg border p-4">
                  代理：{serverSummary.runtime.enabledAgentCount} 个启用 /{' '}
                  {serverSummary.runtime.agentCount} 个注册
                </div>
                <div className="rounded-lg border p-4">
                  工具：{serverSummary.runtime.toolCount} 个工具面
                </div>
                <div className="rounded-lg border p-4">
                  工作流：{serverSummary.runtime.workflowCount} 个工作流条目
                </div>
                <div className="rounded-lg border p-4">
                  环境：{serverSummary.environment.nodeEnv} · 端口 {serverSummary.environment.port}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>在线情况概览</CardDescription>
              <CardTitle>会话与 RBAC 映射</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    不同角色数
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{formatCount(distinctRoles)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    可见用户数
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {formatCount(onlinePayload.pagination.total)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                {onlinePayload.data.length === 0 ? (
                  <p className="text-muted-foreground text-sm leading-7">
                    当前切片中没有可见活跃会话。
                  </p>
                ) : (
                  onlinePayload.data.map((row) => (
                    <div className="rounded-lg border p-4 text-sm leading-6" key={row.sessionId}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{row.name}</span>
                        <Badge variant={row.roleCodes.length > 0 ? 'outline' : 'secondary'}>
                          {row.roleCodes.length > 0 ? row.roleCodes.join(', ') : '未映射'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-2">{row.email}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
