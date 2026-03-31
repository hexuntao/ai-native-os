export type AppSubjects =
  | 'User'
  | 'Role'
  | 'Permission'
  | 'Menu'
  | 'Dict'
  | 'Config'
  | 'OperationLog'
  | 'OnlineUser'
  | 'AiAgent'
  | 'AiWorkflow'
  | 'AiKnowledge'
  | 'AiAuditLog'
  | 'Approval'
  | 'Report'
  | 'all'

export type AppActions =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage'
  | 'export'
  | 'import'
  | 'approve'
  | 'assign'

export const appActions = [
  'create',
  'read',
  'update',
  'delete',
  'manage',
  'export',
  'import',
  'approve',
  'assign',
] as const satisfies readonly AppActions[]

export const appSubjects = [
  'User',
  'Role',
  'Permission',
  'Menu',
  'Dict',
  'Config',
  'OperationLog',
  'OnlineUser',
  'AiAgent',
  'AiWorkflow',
  'AiKnowledge',
  'AiAuditLog',
  'Approval',
  'Report',
  'all',
] as const satisfies readonly AppSubjects[]
