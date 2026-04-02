import { runReleaseSmokeChecks } from './smoke-check'

/**
 * 执行发布 smoke CLI，并把结果打印为 JSON 供 CI/CD 或人工复核。
 */
async function main(): Promise<void> {
  const summary = await runReleaseSmokeChecks()

  console.info(JSON.stringify(summary, null, 2))
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
