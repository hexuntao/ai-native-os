import { boolean, index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

export const systemConfigs = pgTable(
  'system_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 120 }).notNull(),
    scope: varchar('scope', { length: 30 }).notNull(),
    description: varchar('description', { length: 200 }).notNull(),
    value: varchar('value', { length: 500 }).notNull(),
    source: varchar('source', { length: 20 }).notNull().default('custom'),
    status: boolean('status').default(true).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('system_configs_key_uidx').on(table.key),
    index('system_configs_scope_idx').on(table.scope),
    index('system_configs_status_idx').on(table.status),
    index('system_configs_source_idx').on(table.source),
  ],
)
