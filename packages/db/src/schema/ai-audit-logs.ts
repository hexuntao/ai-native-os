import { jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const aiAuditLogs = pgTable('ai_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  toolId: varchar('tool_id', { length: 100 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  subject: varchar('subject', { length: 50 }).notNull(),
  actorAuthUserId: varchar('actor_auth_user_id', { length: 255 }).notNull(),
  actorRbacUserId: uuid('actor_rbac_user_id'),
  roleCodes: text('role_codes').array().notNull(),
  input: jsonb('input').$type<unknown>().default(null),
  output: jsonb('output').$type<unknown>().default(null),
  requestInfo: jsonb('request_info').$type<Record<string, string> | null>().default(null),
  status: varchar('status', { length: 20 }).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})
