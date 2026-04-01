import {
  loadUserPermissionProfileByEmail,
  loadUserPermissionProfileByUserId,
} from '@ai-native-os/db'
import { z } from 'zod'

import { defineProtectedMastraTool } from './base'

const permissionProfileInputSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().uuid().optional(),
  })
  .refine((input) => Boolean(input.email || input.userId), {
    message: 'Either email or userId is required',
  })

const permissionProfileOutputSchema = z.object({
  found: z.boolean(),
  profile: z
    .object({
      roleCodes: z.array(z.string()),
      rules: z.array(
        z.object({
          action: z.string(),
          conditions: z.record(z.string(), z.unknown()).nullable().optional(),
          fields: z.array(z.string()).optional(),
          inverted: z.boolean().optional(),
          subject: z.string(),
        }),
      ),
      userId: z.string().uuid(),
    })
    .nullable(),
})

export const permissionProfileRegistration = defineProtectedMastraTool({
  description: 'Resolve an RBAC permission profile for a user by email or user id.',
  execute: async (input) => {
    const parsedInput = permissionProfileInputSchema.parse(input)
    const profile = parsedInput.userId
      ? await loadUserPermissionProfileByUserId(parsedInput.userId)
      : parsedInput.email
        ? await loadUserPermissionProfileByEmail(parsedInput.email)
        : null

    return {
      found: Boolean(profile),
      profile,
    }
  },
  id: 'permission-profile',
  inputSchema: permissionProfileInputSchema,
  outputSchema: permissionProfileOutputSchema,
  permission: {
    action: 'read',
    subject: 'Role',
  },
})
