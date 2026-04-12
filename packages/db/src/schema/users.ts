import { boolean, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { user as authUsers } from './auth'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  authUserId: text('auth_user_id')
    .unique()
    .references(() => authUsers.id, {
      onDelete: 'set null',
    }),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  nickname: varchar('nickname', { length: 50 }),
  status: boolean('status').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
})
