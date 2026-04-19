import { index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

import { systemDicts } from './system-dicts'

export const systemDictEntries = pgTable(
  'system_dict_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dictId: uuid('dict_id')
      .notNull()
      .references(() => systemDicts.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 80 }).notNull(),
    value: varchar('value', { length: 120 }).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('system_dict_entries_dict_id_idx').on(table.dictId),
    uniqueIndex('system_dict_entries_dict_id_value_uidx').on(table.dictId, table.value),
  ],
)
