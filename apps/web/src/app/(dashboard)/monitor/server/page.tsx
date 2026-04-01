import {
  Badge,
  Field,
  FieldHint,
  FieldLabel,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import { DataSurfacePage } from '@/components/management/data-surface-page'
import { formatCount } from '@/lib/format'
import { loadServerSummary } from '@/lib/server-management'

export default async function MonitorServerPage(): Promise<ReactNode> {
  const payload = await loadServerSummary()

  return (
    <DataSurfacePage
      description="Server and runtime summary from the monitor contract. This page keeps the deployment picture visible without reaching into worker or queue infrastructure that is still pending."
      eyebrow="Monitor Module"
      facts={[
        {
          label: 'Environment',
          value: payload.environment.nodeEnv,
        },
        {
          label: 'Port',
          value: String(payload.environment.port),
        },
      ]}
      metrics={[
        {
          detail: 'Registered Mastra tools visible to the runtime summary.',
          label: 'Tools',
          value: formatCount(payload.runtime.toolCount),
        },
        {
          detail: 'Registered agent count in the current runtime.',
          label: 'Agents',
          value: formatCount(payload.runtime.agentCount),
        },
        {
          detail: 'Registered workflow count in the current runtime.',
          label: 'Workflows',
          value: formatCount(payload.runtime.workflowCount),
        },
      ]}
      title="System Health"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
          <FieldLabel>Health status</FieldLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="accent">{payload.health.api}</Badge>
            <Badge variant={payload.health.database === 'ok' ? 'accent' : 'secondary'}>
              database:{payload.health.database}
            </Badge>
            <Badge variant="secondary">redis:{payload.health.redis}</Badge>
            <Badge variant={payload.health.status === 'ok' ? 'accent' : 'secondary'}>
              overall:{payload.health.status}
            </Badge>
          </div>
        </Field>

        <Field className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
          <FieldLabel>Runtime stage</FieldLabel>
          <FieldHint>
            Current Mastra stage: {payload.runtime.runtimeStage}. This reflects registry readiness,
            not queue or worker deployment completeness.
          </FieldHint>
        </Field>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">API status</TableCell>
                <TableCell>{payload.health.api}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Database status</TableCell>
                <TableCell>{payload.health.database}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Redis status</TableCell>
                <TableCell>{payload.health.redis}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-background/80">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Runtime stage</TableCell>
                <TableCell>{payload.runtime.runtimeStage}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Agent count</TableCell>
                <TableCell>{payload.runtime.agentCount}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Tool count</TableCell>
                <TableCell>{payload.runtime.toolCount}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Workflow count</TableCell>
                <TableCell>{payload.runtime.workflowCount}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </DataSurfacePage>
  )
}
