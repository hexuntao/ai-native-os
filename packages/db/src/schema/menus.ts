import { boolean, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const menus = pgTable('menus', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id'),
  name: varchar('name', { length: 50 }).notNull(),
  path: varchar('path', { length: 200 }),
  component: varchar('component', { length: 200 }),
  icon: varchar('icon', { length: 50 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  type: varchar('type', { length: 10 }).notNull(),
  permissionResource: varchar('permission_resource', { length: 50 }),
  permissionAction: varchar('permission_action', { length: 50 }),
  visible: boolean('visible').default(true).notNull(),
  status: boolean('status').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})
