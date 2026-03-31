import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  resource: varchar('resource', { length: 50 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  conditions: jsonb('conditions').$type<Record<string, unknown> | null>().default(null),
  fields: text('fields').array(),
  inverted: boolean('inverted').default(false).notNull(),
  description: varchar('description', { length: 200 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})
