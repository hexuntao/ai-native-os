import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

import { db, pool } from './index'

const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url))

await migrate(db, {
  migrationsFolder,
})

await pool.end()
