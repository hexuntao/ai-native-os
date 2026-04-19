import { boolean, index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

export const systemDicts = pgTable(
  'system_dicts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    description: varchar('description', { length: 200 }),
    source: varchar('source', { length: 20 }).notNull().default('custom'),
    status: boolean('status').default(true).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('system_dicts_code_uidx').on(table.code),
    index('system_dicts_source_idx').on(table.source),
    index('system_dicts_status_idx').on(table.status),
  ],
)
