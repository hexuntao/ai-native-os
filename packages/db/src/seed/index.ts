import { pool } from '../client'

import { seedRbacDefaults } from './rbac'

export const seedEntrypoints = {
  phase1: 'workspace initialized',
  phase2: 'rbac defaults seeded',
} as const

async function main(): Promise<void> {
  const summary = await seedRbacDefaults()

  console.info('RBAC seed completed.', summary)
}

main()
  .then(async () => {
    await pool.end()
  })
  .catch(async (error: unknown) => {
    console.error(error)
    await pool.end()
    process.exitCode = 1
  })
