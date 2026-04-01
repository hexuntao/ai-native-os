import type { AiEvalItemScoreMap } from '@ai-native-os/shared'
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { aiEvalRuns } from './ai-eval-runs'

export const aiEvalRunItems = pgTable(
  'ai_eval_run_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => aiEvalRuns.id, {
        onDelete: 'cascade',
      }),
    datasetItemId: varchar('dataset_item_id', { length: 255 }).notNull(),
    itemIndex: integer('item_index').notNull(),
    input: jsonb('input').notNull(),
    output: jsonb('output'),
    groundTruth: jsonb('ground_truth'),
    errorMessage: text('error_message'),
    scores: jsonb('scores').$type<AiEvalItemScoreMap>().notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('ai_eval_run_items_run_id_idx').on(table.runId),
    uniqueIndex('ai_eval_run_items_run_item_uidx').on(table.runId, table.datasetItemId),
  ],
)
