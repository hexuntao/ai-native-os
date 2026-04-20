import {
  listPrincipalRepairCandidates as listPrincipalRepairCandidatesFromDb,
  repairPrincipalBindings,
  writeOperationLog,
} from '@ai-native-os/db'
import {
  type ListPrincipalRepairCandidatesInput,
  listPrincipalRepairCandidatesInputSchema,
  type PrincipalRepairCandidateListResponse,
  type PrincipalRepairResult,
  principalRepairCandidateListResponseSchema,
  principalRepairResultSchema,
  type RepairPrincipalBindingsInput,
  repairPrincipalBindingsInputSchema,
} from '@ai-native-os/shared'

import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination, paginateArray } from '@/routes/lib/pagination'

const principalRepairPermissions = [
  { action: 'manage', subject: 'User' },
  { action: 'manage', subject: 'all' },
] as const

interface PrincipalRepairCommandContext {
  actorRbacUserId: string | null
  requestId: string
}

/**
 * 返回仍未绑定 `auth_user_id`、但已能按同邮箱匹配 Better Auth 主体的候选用户。
 */
export async function listPrincipalRepairCandidates(
  input: ListPrincipalRepairCandidatesInput,
): Promise<PrincipalRepairCandidateListResponse> {
  const candidateRows = await listPrincipalRepairCandidatesFromDb(input.search)
  const total = candidateRows.length

  return {
    data: paginateArray(candidateRows, input.page, input.pageSize),
    pagination: createPagination(input.page, input.pageSize, total),
  }
}

/**
 * 显式执行主体修复，并把每个目标的处理结果写入操作审计日志。
 */
export async function repairPrincipalBindingsEntry(
  input: RepairPrincipalBindingsInput,
  context: PrincipalRepairCommandContext,
): Promise<PrincipalRepairResult> {
  const resultItems = await repairPrincipalBindings(input.userIds)

  for (const resultItem of resultItems) {
    await writeOperationLog({
      action: 'repair_principal_binding',
      detail:
        resultItem.status === 'repaired'
          ? `Repaired auth_user_id binding for ${resultItem.username || resultItem.userId}.`
          : `Skipped auth_user_id repair for ${resultItem.username || resultItem.userId}: ${resultItem.reason}.`,
      module: 'identity_principal_repair',
      operatorId: context.actorRbacUserId,
      requestInfo: {
        repairReason: resultItem.reason,
        repairStatus: resultItem.status,
        requestId: context.requestId,
        userEmail: resultItem.email || null,
      },
      targetId: resultItem.userId,
    })
  }

  const repaired = resultItems.filter((resultItem) => resultItem.status === 'repaired')
  const skipped = resultItems.filter((resultItem) => resultItem.status === 'skipped')

  return {
    repaired,
    repairedCount: repaired.length,
    skipped,
    skippedCount: skipped.length,
  }
}

/**
 * 对外暴露主体修复候选查询 procedure。
 */
export const usersPrincipalRepairCandidatesProcedure = requireAnyPermission(
  principalRepairPermissions,
)
  .route({
    method: 'GET',
    path: '/api/v1/system/users/principal-repair-candidates',
    tags: ['System:Users'],
    summary: '查询主体修复候选列表',
    description:
      '分页返回仍未绑定 `auth_user_id`、但已可按同邮箱匹配 Better Auth 主体的后台用户，供运维执行显式修复。',
  })
  .input(listPrincipalRepairCandidatesInputSchema)
  .output(principalRepairCandidateListResponseSchema)
  .handler(async ({ input }) => listPrincipalRepairCandidates(input))

/**
 * 对外暴露主体修复命令 procedure。
 */
export const usersPrincipalRepairProcedure = requireAnyPermission(principalRepairPermissions)
  .route({
    method: 'POST',
    path: '/api/v1/system/users/principal-repair',
    tags: ['System:Users'],
    summary: '执行主体绑定修复',
    description:
      '按用户主键列表显式回填 `auth_user_id`，不再在正常登录链路中隐式按邮箱回补主体绑定。',
  })
  .input(repairPrincipalBindingsInputSchema)
  .output(principalRepairResultSchema)
  .handler(async ({ context, input }) =>
    repairPrincipalBindingsEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )
