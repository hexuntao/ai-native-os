import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  type FinalRegressionDependencies,
  type FinalRegressionEnvironment,
  FinalRegressionError,
  finalizeRegressionSummary,
  type RegressionStepResult,
  resolveFinalRegressionEnvironment,
  runApplicationRegressionBundle,
  runReleaseSmokeRegressionStep,
} from './e2e-regression'

interface CommandExecutionResult {
  detail: string
}

const repositoryRootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../')

/**
 * 启动子进程执行仓库命令，并把退出码透明传回当前 CLI。
 */
async function runCommand(command: string, args: string[]): Promise<CommandExecutionResult> {
  const child = spawn(command, args, {
    cwd: repositoryRootDirectory,
    env: process.env,
    shell: false,
    stdio: 'inherit',
  })

  const exitCode = await new Promise<number>((resolvePromise, rejectPromise) => {
    child.once('error', rejectPromise)
    child.once('exit', (code, signal) => {
      if (signal) {
        resolvePromise(1)
        return
      }

      resolvePromise(code ?? 0)
    })
  })

  if (exitCode !== 0) {
    throw new Error(`Command failed with exit code ${exitCode}: ${command} ${args.join(' ')}`)
  }

  return {
    detail: `${command} ${args.join(' ')}`.trim(),
  }
}

/**
 * 统一记录命令类步骤的耗时和状态。
 */
async function runCommandStep(
  name: string,
  command: string,
  args: string[],
): Promise<RegressionStepResult> {
  const startedAt = performance.now()

  try {
    const result = await runCommand(command, args)

    return {
      detail: result.detail,
      durationMs: Math.round(performance.now() - startedAt),
      name,
      status: 'passed',
      warnings: [],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    return {
      detail: message,
      durationMs: Math.round(performance.now() - startedAt),
      name,
      status: 'failed',
      warnings: [],
    }
  }
}

/**
 * 执行最终 E2E 回归 CLI。
 *
 * 设计目标：
 * - 固化 migrate / seed / 应用内权限回归 / test / build / release smoke 的标准顺序
 * - 输出结构化 JSON，便于人工复核和后续自动化消费
 */
async function main(
  dependencies: FinalRegressionDependencies = {
    now: () => new Date(),
    runReleaseSmoke: async () => {
      const { runReleaseSmokeChecks } = await import('./smoke-check')

      return await runReleaseSmokeChecks()
    },
  },
): Promise<void> {
  const environment: FinalRegressionEnvironment = resolveFinalRegressionEnvironment()
  const steps: RegressionStepResult[] = []

  steps.push(await runCommandStep('lint', 'pnpm', ['lint']))
  steps.push(await runCommandStep('typecheck', 'pnpm', ['typecheck']))
  steps.push(await runCommandStep('db-migrate', 'pnpm', ['db:migrate']))
  steps.push(await runCommandStep('db-seed', 'pnpm', ['db:seed']))
  steps.push(...(await runApplicationRegressionBundle()))
  steps.push(await runCommandStep('test', 'pnpm', ['test']))
  steps.push(await runCommandStep('build', 'pnpm', ['build']))
  steps.push(await runReleaseSmokeRegressionStep(environment, dependencies))

  try {
    const summary = finalizeRegressionSummary(steps, {
      now: dependencies.now,
    })

    console.info(JSON.stringify(summary, null, 2))
  } catch (error) {
    if (error instanceof FinalRegressionError) {
      console.error(JSON.stringify(error.summary, null, 2))
      process.exitCode = 1
      return
    }

    throw error
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
