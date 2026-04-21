export interface StarterRefNavItem {
  description?: string
  items?: StarterRefNavItem[]
  title: string
  url: string
}

export interface StarterRefNavGroup {
  items: StarterRefNavItem[]
  label: string
}

export const navGroups: readonly StarterRefNavGroup[] = [
  {
    label: 'Home',
    items: [
      {
        description: 'System-wide AI operating picture.',
        title: 'AI Operations Center',
        url: '/dashboard/home',
      },
    ],
  },
  {
    label: 'Build',
    items: [
      {
        description: 'Prompt engineering and release gates.',
        title: 'Prompt Studio',
        url: '/dashboard/build/prompts',
      },
    ],
  },
  {
    label: 'Observe',
    items: [
      {
        description: 'Runtime inspection and trace review.',
        title: 'Runs & Traces',
        url: '/dashboard/observe/runs',
      },
      {
        description: 'Platform health and worker status.',
        title: 'Runtime Monitor',
        url: '/dashboard/observe/monitor',
      },
    ],
  },
  {
    label: 'Improve',
    items: [
      {
        description: 'Eval suites and quality posture.',
        title: 'Eval Registry',
        url: '/dashboard/improve/evals',
      },
    ],
  },
  {
    label: 'Knowledge',
    items: [
      {
        description: 'Retrieval inputs and collections.',
        title: 'Knowledge Collections',
        url: '/dashboard/knowledge/collections',
      },
    ],
  },
  {
    label: 'Govern',
    items: [
      {
        description: 'Approval queue and governance review.',
        title: 'Approval Queue',
        url: '/dashboard/govern/approvals',
      },
      {
        description: 'Audit evidence and operator ledger.',
        title: 'Audit Ledger',
        url: '/dashboard/govern/audit',
      },
    ],
  },
  {
    label: 'Workspace',
    items: [
      {
        description: 'Exports and reporting surfaces.',
        title: 'Reports Workspace',
        url: '/dashboard/workspace/reports',
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        description: 'Authenticated principals and roles.',
        title: 'Users Directory',
        url: '/dashboard/admin/users',
      },
      {
        description: 'Role topology.',
        title: 'Roles Matrix',
        url: '/dashboard/admin/roles',
      },
      {
        description: 'Permission contracts.',
        title: 'Permission Center',
        url: '/dashboard/admin/permissions',
      },
    ],
  },
] as const
