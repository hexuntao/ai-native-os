import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

interface RootPackageJsonShape {
  scripts?: Record<string, string>
}

/**
 * 读取仓库根目录文件，供本地启动合同测试复用。
 */
function readRepositoryFile(relativePath: string): string {
  const repositoryRoot = resolve(process.cwd(), '..', '..')

  return readFileSync(resolve(repositoryRoot, relativePath), 'utf8')
}

/**
 * 读取根 package.json，校验本地启动入口是否统一走 `.env.local`。
 */
function readRootPackageJson(): RootPackageJsonShape {
  return JSON.parse(readRepositoryFile('package.json')) as RootPackageJsonShape
}

test('root scripts auto-load .env.local for local bootstrap commands', () => {
  const packageJson = readRootPackageJson()
  const requiredScripts = ['dev', 'db:migrate', 'db:seed', 'jobs:start', 'release:smoke'] as const

  for (const scriptName of requiredScripts) {
    const script = packageJson.scripts?.[scriptName]

    assert.ok(script, `Expected root script ${scriptName} to exist`)
    assert.match(
      script,
      /scripts\/with-local-env\.ts/,
      `Expected root script ${scriptName} to load .env.local automatically`,
    )
  }
})

test('local bootstrap docs align env template, root scripts, and jobs health guidance', () => {
  const environmentExample = readRepositoryFile('.env.example')
  const environmentMatrix = readRepositoryFile('docs/environment-matrix.md')
  const deploymentGuide = readRepositoryFile('docs/deployment-guide.md')

  assert.match(environmentExample, /cp \.env\.example \.env\.local/)
  assert.match(environmentExample, /JOBS_PORT=3040/)
  assert.match(environmentExample, /pnpm db:seed/)
  assert.match(environmentExample, /pnpm jobs:start/)

  assert.match(environmentMatrix, /cp \.env\.example \.env\.local/)
  assert.match(environmentMatrix, /`JOBS_PORT`/)
  assert.match(environmentMatrix, /pnpm dev/)
  assert.match(environmentMatrix, /pnpm jobs:start/)
  assert.match(environmentMatrix, /jobs dev.*不提供该健康端点/)
  assert.match(environmentMatrix, /RELEASE_INCLUDE_JOBS=1/)

  assert.match(deploymentGuide, /当前仓库本地开发模板/)
  assert.match(deploymentGuide, /cp \.env\.example \.env\.local/)
  assert.match(deploymentGuide, /JOBS_PORT/)
  assert.match(deploymentGuide, /pnpm db:migrate/)
  assert.match(deploymentGuide, /pnpm db:seed/)
  assert.match(deploymentGuide, /pnpm jobs:start/)
  assert.match(deploymentGuide, /pnpm release:smoke/)
})
