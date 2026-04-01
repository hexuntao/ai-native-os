import { defineConfig } from '@trigger.dev/sdk/v3'

/**
 * Trigger.dev worker 配置。
 *
 * 当前只启用最小目录与重试策略，避免把未完成的任务目录暴露给 worker。
 */
export default defineConfig({
  project: 'ai-native-os',
  runtime: 'node',
  logLevel: 'info',
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
  dirs: ['src/trigger'],
})
