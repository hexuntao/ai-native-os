import {
  type MastraEvalRunOutcome,
  runAllMastraEvalSuites,
} from '@ai-native-os/api/mastra/evals/runner'
import { writeAiAuditLog } from '@ai-native-os/db'
import { schedules } from '@trigger.dev/sdk/v3'

export interface AiEvalRunnerTaskResult {
  runCount: number
  runs: MastraEvalRunOutcome[]
  taskId: 'ai-eval-runner'
}

/**
 * 执行 AI eval runner。
 *
 * 职责边界：
 * - 只运行已注册的 eval suite，不直接调用高风险写操作
 * - 评估结果持久化由 API eval runner 完成，任务侧只负责调度与审计补充
 */
export async function executeAiEvalRunnerTask(): Promise<AiEvalRunnerTaskResult> {
  const requestId = `trigger-ai-eval-runner-${Date.now()}`

  try {
    const runs = await runAllMastraEvalSuites({
      actorAuthUserId: 'system:trigger-jobs',
      actorRbacUserId: null,
      requestId,
      triggerSource: 'schedule',
    })

    await writeAiAuditLog({
      action: 'read',
      actorAuthUserId: 'system:trigger-jobs',
      actorRbacUserId: null,
      input: {
        requestId,
      },
      output: {
        runCount: runs.length,
        runs: runs.map((run) => ({
          evalId: run.evalId,
          experimentId: run.experimentId,
          status: run.status,
        })),
      },
      requestInfo: {
        requestId,
      },
      roleCodes: ['system_scheduler'],
      status: 'success',
      subject: 'AiAuditLog',
      toolId: 'task:ai-eval-runner',
    })

    return {
      runCount: runs.length,
      runs,
      taskId: 'ai-eval-runner',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await writeAiAuditLog({
      action: 'read',
      actorAuthUserId: 'system:trigger-jobs',
      actorRbacUserId: null,
      errorMessage: message,
      input: {
        requestId,
      },
      requestInfo: {
        requestId,
      },
      roleCodes: ['system_scheduler'],
      status: 'error',
      subject: 'AiAuditLog',
      toolId: 'task:ai-eval-runner',
    })

    throw error
  }
}

/**
 * 周期性评估任务。
 *
 * 约束：
 * - 仅执行已注册的评估套件
 * - 任务与套件运行均会记录审计数据，便于回溯评估质量变化
 */
export const aiEvalRunnerTask = schedules.task({
  id: 'ai-eval-runner',
  cron: {
    pattern: '15 8 * * *',
    timezone: 'Asia/Shanghai',
  },
  run: async () => executeAiEvalRunnerTask(),
})
