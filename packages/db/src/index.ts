import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

export const defaultLocalDatabaseUrl = 'postgresql://postgres:postgres@localhost:5433/ai_native_os'

export function resolveDatabaseUrl(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): string {
  if (databaseUrl) {
    return databaseUrl
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required to initialize @ai-native-os/db in production')
  }

  return defaultLocalDatabaseUrl
}

export const pool = new Pool({
  connectionString: resolveDatabaseUrl(),
})

export const db = drizzle({
  client: pool,
  schema,
})

export type Database = typeof db

export * from './schema'
