import type { PromptEvalEvidence, PromptReleasePolicy } from '@ai-native-os/shared'
import {
  boolean,
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

export const aiPromptVersions = pgTable(
  'ai_prompt_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    promptKey: varchar('prompt_key', { length: 120 }).notNull(),
    version: integer('version').notNull(),
    promptText: text('prompt_text').notNull(),
    notes: text('notes'),
    releasePolicy: jsonb('release_policy').$type<PromptReleasePolicy>().notNull(),
    evalEvidence: jsonb('eval_evidence').$type<PromptEvalEvidence>(),
    status: varchar('status', { length: 20 }).notNull(),
    isActive: boolean('is_active').notNull().default(false),
    createdByAuthUserId: varchar('created_by_auth_user_id', { length: 255 }).notNull(),
    createdByRbacUserId: uuid('created_by_rbac_user_id'),
    activatedByAuthUserId: varchar('activated_by_auth_user_id', { length: 255 }),
    activatedByRbacUserId: uuid('activated_by_rbac_user_id'),
    activatedAt: timestamp('activated_at', { mode: 'date' }),
    rolledBackFromVersionId: uuid('rolled_back_from_version_id'),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('ai_prompt_versions_prompt_key_idx').on(table.promptKey),
    index('ai_prompt_versions_status_idx').on(table.status),
    index('ai_prompt_versions_active_idx').on(table.promptKey, table.isActive),
    index('ai_prompt_versions_version_idx').on(table.promptKey, table.version),
    uniqueIndex('ai_prompt_versions_prompt_key_version_uidx').on(table.promptKey, table.version),
  ],
)
