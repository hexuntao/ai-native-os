import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

interface WorkflowContract {
  filePath: string
  requiredSnippets: string[]
}

/**
 * 读取仓库根目录下的 workflow 文件内容。
 */
function readWorkflowFile(filePath: string): string {
  const repositoryRoot = resolve(process.cwd(), '..', '..')

  return readFileSync(resolve(repositoryRoot, filePath), 'utf8')
}

/**
 * 校验 workflow 是否保留了当前阶段要求的关键片段。
 */
function verifyWorkflowContract(contract: WorkflowContract): void {
  const workflowSource = readWorkflowFile(contract.filePath)

  for (const requiredSnippet of contract.requiredSnippets) {
    assert.match(
      workflowSource,
      new RegExp(requiredSnippet.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `Expected ${contract.filePath} to include ${requiredSnippet}`,
    )
  }
}

/**
 * 返回本阶段必须存在的 GitHub Actions workflow 合同。
 */
function getWorkflowContracts(): WorkflowContract[] {
  return [
    {
      filePath: '.github/workflows/reusable-quality-gate.yml',
      requiredSnippets: [
        'workflow_call',
        'pnpm db:migrate',
        'pnpm lint',
        'pnpm typecheck',
        'pnpm test',
        'pnpm build',
        'deploy:cloudflare:staging:dry-run',
      ],
    },
    {
      filePath: '.github/workflows/ci.yml',
      requiredSnippets: ['pull_request', 'reusable-quality-gate.yml'],
    },
    {
      filePath: '.github/workflows/reusable-deploy.yml',
      requiredSnippets: [
        'workflow_call',
        'environment_name',
        'VERCEL_TOKEN',
        'CLOUDFLARE_API_TOKEN',
        'TRIGGER_ACCESS_TOKEN',
        'pnpm db:migrate',
        'vercel pull',
        'curl --fail --silent --show-error --location "$' + '{APP_URL%/}/healthz"',
      ],
    },
    {
      filePath: '.github/workflows/deploy-staging.yml',
      requiredSnippets: [
        'workflow_dispatch',
        'environment_name: staging',
        'deploy:vercel:preview',
        'deploy:cloudflare:staging',
        'deploy:trigger:staging',
      ],
    },
    {
      filePath: '.github/workflows/deploy-production.yml',
      requiredSnippets: [
        'workflow_dispatch',
        'environment_name: production',
        'build:vercel:prod',
        'deploy:vercel:prod',
        'deploy:cloudflare:prod',
        'deploy:trigger:prod',
      ],
    },
  ]
}

test('GitHub Actions workflows enforce the Phase 6 CI contract', () => {
  for (const workflowContract of getWorkflowContracts()) {
    verifyWorkflowContract(workflowContract)
  }
})
