import type { ReactNode } from 'react'
import PageContainer from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { InfobarContent } from '@/components/ui/infobar'

function createInfoContent(): InfobarContent {
  return {
    title: 'Reports Workspace',
    sections: [
      {
        title: 'What this page is for',
        description:
          'Keep report workflow navigation coherent while the export and schedule surfaces migrate into the starter-based shell.',
      },
    ],
  }
}

export default function WorkspaceReportsPage(): ReactNode {
  return (
    <PageContainer
      pageTitle="Reports Workspace"
      pageDescription="Starter-based placeholder for export workflow and report schedule surfaces."
      infoContent={createInfoContent()}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader>
            <CardDescription>Workflow status</CardDescription>
            <CardTitle>Migration placeholder</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-7">
            <p>
              The backend report workflow already exists. This starter-based route preserves
              workspace navigation while report-specific export history and schedule UI are still
              being refined.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">route shell ready</Badge>
              <Badge variant="outline">export history pending</Badge>
              <Badge variant="outline">schedule UI pending</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Next milestones</CardDescription>
            <CardTitle>Follow-on work</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-7">
            <p>1. Connect report schedule workflow status to the page.</p>
            <p>2. Expose export history and latest snapshot metadata.</p>
            <p>3. Enable operator-triggered report actions inside the starter shell.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
