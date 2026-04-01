import { aiAuditLogs, db, menus, operationLogs, permissions, roles, users } from '@ai-native-os/db'
import { count } from 'drizzle-orm'
import { z } from 'zod'

import { defineProtectedMastraTool } from './base'

/**
 * 系统报表快照 Tool。
 *
 * 职责边界：
 * - 仅生成核心实体数量的只读快照，供 Agent/Workflow 生成概览报表
 * - 不执行任何写操作，也不暴露原始敏感记录
 *
 * 权限与审计：
 * - 权限固定为 `export:Report`
 * - 每次调用都通过基座写入 AI 审计日志
 */
export const reportDataSnapshotInputSchema = z.object({})

export const reportDataSnapshotOutputSchema = z.object({
  counts: z.object({
    aiAuditLogs: z.number().int().nonnegative(),
    menus: z.number().int().nonnegative(),
    operationLogs: z.number().int().nonnegative(),
    permissions: z.number().int().nonnegative(),
    roles: z.number().int().nonnegative(),
    users: z.number().int().nonnegative(),
  }),
  generatedAt: z.string(),
})

export const reportDataSnapshotRegistration = defineProtectedMastraTool({
  description: 'Generate an export-ready system data snapshot with core entity counts.',
  execute: async (input) => {
    reportDataSnapshotInputSchema.parse(input)
    const [userCount, roleCount, permissionCount, menuCount, operationLogCount, aiAuditLogCount] =
      await Promise.all([
        db.select({ value: count() }).from(users),
        db.select({ value: count() }).from(roles),
        db.select({ value: count() }).from(permissions),
        db.select({ value: count() }).from(menus),
        db.select({ value: count() }).from(operationLogs),
        db.select({ value: count() }).from(aiAuditLogs),
      ])

    return {
      counts: {
        aiAuditLogs: aiAuditLogCount[0]?.value ?? 0,
        menus: menuCount[0]?.value ?? 0,
        operationLogs: operationLogCount[0]?.value ?? 0,
        permissions: permissionCount[0]?.value ?? 0,
        roles: roleCount[0]?.value ?? 0,
        users: userCount[0]?.value ?? 0,
      },
      generatedAt: new Date().toISOString(),
    }
  },
  id: 'report-data-snapshot',
  inputSchema: reportDataSnapshotInputSchema,
  outputSchema: reportDataSnapshotOutputSchema,
  permission: {
    action: 'export',
    subject: 'Report',
  },
})
