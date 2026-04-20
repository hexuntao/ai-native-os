import {
  type BackupVerificationSummary,
  resolveBackupVerificationEnvironment,
  verifyBackupArtifact,
} from './backup-verify'
import {
  type ReleaseSmokeSummary,
  resolveReleaseSmokeEnvironment,
  runReleaseSmokeChecks,
} from './smoke-check'

export interface ReleasePreflightEnvironment {
  backupFileConfigured: boolean
  requireBackupVerification: boolean
}

export interface ReleasePreflightDependencies {
  now: () => Date
  runBackupVerification: () => Promise<BackupVerificationSummary>
  runReleaseSmoke: () => Promise<ReleaseSmokeSummary>
}

export interface ReleasePreflightSummary {
  backupVerification:
    | {
        status: 'passed'
        summary: BackupVerificationSummary
      }
    | {
        reason: string
        status: 'skipped'
      }
  checkedAt: string
  releaseSmoke: ReleaseSmokeSummary
  status: 'ok'
  warnings: string[]
}

const defaultReleasePreflightDependencies: ReleasePreflightDependencies = {
  now: () => new Date(),
  runBackupVerification: () => verifyBackupArtifact(resolveBackupVerificationEnvironment()),
  runReleaseSmoke: () => runReleaseSmokeChecks(resolveReleaseSmokeEnvironment()),
}

/**
 * 解析发布预检环境。
 *
 * 行为约束：
 * - 若显式要求备份校验，则缺少 `BACKUP_FILE` 直接报错
 * - 若未显式要求，但提供了 `BACKUP_FILE`，则自动执行备份校验
 */
export function resolveReleasePreflightEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): ReleasePreflightEnvironment {
  const requireBackupVerification = ['1', 'true', 'yes', 'on'].includes(
    environment.RELEASE_REQUIRE_BACKUP_VERIFY?.trim().toLowerCase() ?? '',
  )

  if (requireBackupVerification && !environment.BACKUP_FILE?.trim()) {
    throw new Error('BACKUP_FILE is required when RELEASE_REQUIRE_BACKUP_VERIFY=true')
  }

  return {
    backupFileConfigured: Boolean(environment.BACKUP_FILE?.trim()),
    requireBackupVerification,
  }
}

/**
 * 运行统一发布预检，把备份校验和 release smoke 收敛为一个标准入口。
 */
export async function runReleasePreflight(
  environment: ReleasePreflightEnvironment = resolveReleasePreflightEnvironment(),
  dependencies: ReleasePreflightDependencies = defaultReleasePreflightDependencies,
): Promise<ReleasePreflightSummary> {
  const shouldVerifyBackup =
    environment.requireBackupVerification || environment.backupFileConfigured

  const backupVerification = shouldVerifyBackup
    ? {
        status: 'passed' as const,
        summary: await dependencies.runBackupVerification(),
      }
    : {
        reason: 'backup verification skipped because BACKUP_FILE is not configured',
        status: 'skipped' as const,
      }
  const releaseSmoke = await dependencies.runReleaseSmoke()
  const warnings = [...releaseSmoke.warnings]

  if (backupVerification.status === 'skipped') {
    warnings.push(backupVerification.reason)
  }

  return {
    backupVerification,
    checkedAt: dependencies.now().toISOString(),
    releaseSmoke,
    status: 'ok',
    warnings,
  }
}
