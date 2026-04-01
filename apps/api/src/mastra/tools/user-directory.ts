import { db, roles, userRoles, users } from '@ai-native-os/db'
import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm'
import { z } from 'zod'

import { defineProtectedMastraTool } from './base'

const userDirectoryInputSchema = z.object({
  includeInactive: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(20).optional().default(10),
  query: z.string().trim().min(1).max(100).optional(),
})

const userDirectoryOutputSchema = z.object({
  users: z.array(
    z.object({
      email: z.string().email(),
      id: z.string().uuid(),
      nickname: z.string().nullable(),
      roleCodes: z.array(z.string()),
      status: z.boolean(),
      username: z.string(),
    }),
  ),
})

export const userDirectoryRegistration = defineProtectedMastraTool({
  description: 'List application users together with their current RBAC role codes.',
  execute: async (input) => {
    const parsedInput = userDirectoryInputSchema.parse(input)
    const conditions: SQL<unknown>[] = []

    if (!parsedInput.includeInactive) {
      conditions.push(eq(users.status, true))
    }

    if (parsedInput.query) {
      const normalizedQuery = `%${parsedInput.query}%`
      const queryCondition = or(
        ilike(users.username, normalizedQuery),
        ilike(users.email, normalizedQuery),
        ilike(users.nickname, normalizedQuery),
      )

      if (queryCondition) {
        conditions.push(queryCondition)
      }
    }

    const whereClause =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions)

    const rows = await db
      .select({
        email: users.email,
        id: users.id,
        nickname: users.nickname,
        roleCode: roles.code,
        status: users.status,
        username: users.username,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(userRoles.roleId, roles.id))
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(parsedInput.limit)

    const usersById = new Map<
      string,
      {
        email: string
        id: string
        nickname: string | null
        roleCodes: string[]
        status: boolean
        username: string
      }
    >()

    for (const row of rows) {
      const existingUser = usersById.get(row.id)

      if (existingUser) {
        if (row.roleCode && !existingUser.roleCodes.includes(row.roleCode)) {
          existingUser.roleCodes.push(row.roleCode)
        }

        continue
      }

      usersById.set(row.id, {
        email: row.email,
        id: row.id,
        nickname: row.nickname,
        roleCodes: row.roleCode ? [row.roleCode] : [],
        status: row.status,
        username: row.username,
      })
    }

    return {
      users: [...usersById.values()].map((user) => ({
        ...user,
        roleCodes: [...user.roleCodes].sort(),
      })),
    }
  },
  id: 'user-directory',
  inputSchema: userDirectoryInputSchema,
  outputSchema: userDirectoryOutputSchema,
  permission: {
    action: 'read',
    subject: 'User',
  },
})
