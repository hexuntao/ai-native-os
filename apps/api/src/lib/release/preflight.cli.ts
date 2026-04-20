import { runReleasePreflight } from './preflight'

/**
 * 执行发布预检 CLI，并输出结构化 JSON 供 CI/CD 或人工复核。
 */
async function main(): Promise<void> {
  const summary = await runReleasePreflight()

  console.info(JSON.stringify(summary, null, 2))
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
