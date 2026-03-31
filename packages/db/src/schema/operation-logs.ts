import { jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const operationLogs = pgTable('operation_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  module: varchar('module', { length: 100 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  operatorId: uuid('operator_id').notNull(),
  targetId: uuid('target_id'),
  detail: text('detail').notNull(),
  requestInfo: jsonb('request_info').$type<Record<string, string> | null>().default(null),
  status: varchar('status', { length: 20 }).default('success').notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})
