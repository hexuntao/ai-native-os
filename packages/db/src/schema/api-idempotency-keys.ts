import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export type ApiIdempotencyStatus = 'failed' | 'in_progress' | 'succeeded'

export const apiIdempotencyKeys = pgTable(
  'api_idempotency_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scope: varchar('scope', { length: 120 }).notNull(),
    actorAuthUserId: varchar('actor_auth_user_id', { length: 255 }).notNull(),
    actorRbacUserId: uuid('actor_rbac_user_id'),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    requestFingerprint: varchar('request_fingerprint', { length: 64 }).notNull(),
    status: varchar('status', { length: 20 }).$type<ApiIdempotencyStatus>().notNull(),
    responsePayload: jsonb('response_payload').$type<unknown>().default(null),
    errorCode: varchar('error_code', { length: 120 }),
    errorMessage: text('error_message'),
    errorStatus: varchar('error_status', { length: 10 }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { mode: 'date' }),
  },
  (table) => [
    uniqueIndex('api_idempotency_scope_actor_key_uidx').on(
      table.scope,
      table.actorAuthUserId,
      table.idempotencyKey,
    ),
    index('api_idempotency_status_idx').on(table.status),
    index('api_idempotency_scope_idx').on(table.scope),
  ],
)
