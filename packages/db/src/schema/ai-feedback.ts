import { boolean, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { aiAuditLogs } from './ai-audit-logs'

export const aiFeedback = pgTable('ai_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  auditLogId: uuid('audit_log_id')
    .notNull()
    .references(() => aiAuditLogs.id, {
      onDelete: 'cascade',
    }),
  actorAuthUserId: varchar('actor_auth_user_id', { length: 255 }).notNull(),
  actorRbacUserId: uuid('actor_rbac_user_id'),
  userAction: varchar('user_action', { length: 20 }).notNull(),
  accepted: boolean('accepted').notNull(),
  correction: text('correction'),
  feedbackText: text('feedback_text'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})
