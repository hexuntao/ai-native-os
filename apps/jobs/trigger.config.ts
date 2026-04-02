import { defineConfig } from '@trigger.dev/sdk/v3'

/**
 * 解析 Trigger.dev 项目引用。
 *
 * 说明：
 * - Trigger.dev v4 部署要求使用 dashboard 提供的 `proj_*` 项目引用
 * - 本地未配置时保留显式占位值，避免继续沿用错误的项目名字符串
 */
function resolveTriggerProjectRef(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.TRIGGER_PROJECT_REF?.trim() || 'proj_replace_me'
}

/**
 * Trigger.dev worker 配置。
 *
 * 当前阶段补齐部署所需的 project ref、machine、maxDuration 与 dry-run 友好配置，
 * 但不把未完成的任务目录暴露给 worker。
 */
export default defineConfig({
  project: resolveTriggerProjectRef(),
  runtime: 'node',
  logLevel: 'info',
  machine: 'small-1x',
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
  compatibilityFlags: ['run_engine_v2'],
  build: {
    autoDetectExternal: true,
    keepNames: true,
  },
  dirs: ['src/trigger'],
})
