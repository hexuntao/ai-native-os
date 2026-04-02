import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

interface RootPackageJsonShape {
  scripts?: Record<string, string>
}

/**
 * 读取仓库根目录文件。
 */
function readRepositoryFile(relativePath: string): string {
  const repositoryRoot = resolve(process.cwd(), '..', '..')

  return readFileSync(resolve(repositoryRoot, relativePath), 'utf8')
}

/**
 * 读取根 package.json，校验 release 脚本合同。
 */
function readRootPackageJson(): RootPackageJsonShape {
  return JSON.parse(readRepositoryFile('package.json')) as RootPackageJsonShape
}

test('release playbook documents security, backup, rollback, and smoke procedures', () => {
  const releasePlaybook = readRepositoryFile('docs/release-playbook.md')

  assert.match(releasePlaybook, /发布加固手册/)
  assert.match(releasePlaybook, /安全放行清单/)
  assert.match(releasePlaybook, /备份与恢复验证/)
  assert.match(releasePlaybook, /回滚流程/)
  assert.match(releasePlaybook, /烟雾验证/)
  assert.match(releasePlaybook, /演练记录模板/)
  assert.match(releasePlaybook, /pnpm release:smoke/)
  assert.match(releasePlaybook, /pnpm release:backup:verify/)
  assert.match(releasePlaybook, /docker compose -f docker\/docker-compose\.prod\.yml exec -T jobs/)
})

test('root package exposes release smoke and backup verification scripts', () => {
  const packageJson = readRootPackageJson()

  assert.equal(
    packageJson.scripts?.['release:smoke'],
    'tsx apps/api/src/lib/release/smoke-check.cli.ts',
  )
  assert.equal(
    packageJson.scripts?.['release:backup:verify'],
    'tsx apps/api/src/lib/release/backup-verify.cli.ts',
  )
})
