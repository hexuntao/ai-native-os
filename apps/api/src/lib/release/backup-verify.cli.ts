import { verifyBackupArtifact } from './backup-verify'

/**
 * 执行备份校验 CLI，并以 JSON 结果供 CI/CD 或人工审阅复用。
 */
async function main(): Promise<void> {
  const summary = await verifyBackupArtifact()

  console.info(JSON.stringify(summary, null, 2))
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
