import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

interface LocalEnvResolution {
  filePath: string
  loadedKeys: string[]
}

interface CommandInput {
  args: string[]
  command: string
}

/**
 * 解析仓库根目录，确保脚本在任意工作目录下都能定位到 `.env.local`。
 */
function resolveRepositoryRoot(): string {
  const scriptDirectory = fileURLToPath(new URL('.', import.meta.url))

  return resolve(scriptDirectory, '..')
}

/**
 * 按优先级读取本地环境文件。
 *
 * 顺序约定：
 * - `.env.local` 作为开发者本地副本优先
 * - `.env` 作为手工导出的备选
 */
function resolveLocalEnvFile(repositoryRoot: string): string | null {
  const candidateFiles = ['.env.local', '.env']

  for (const candidateFile of candidateFiles) {
    const filePath = resolve(repositoryRoot, candidateFile)

    try {
      readFileSync(filePath, 'utf8')
      return filePath
    } catch {}
  }

  return null
}

/**
 * 将本地环境文件加载进当前进程，但不覆盖调用方显式传入的 shell 变量。
 */
function loadLocalEnv(repositoryRoot: string): LocalEnvResolution | null {
  const envFile = resolveLocalEnvFile(repositoryRoot)

  if (!envFile) {
    return null
  }

  const parsedEnvironment = parseEnv(readFileSync(envFile, 'utf8'))
  const loadedKeys: string[] = []

  for (const [key, value] of Object.entries(parsedEnvironment)) {
    if (process.env[key] !== undefined) {
      continue
    }

    process.env[key] = value
    loadedKeys.push(key)
  }

  return {
    filePath: envFile,
    loadedKeys,
  }
}

/**
 * 解析命令行输入，避免在未提供目标命令时静默退出。
 */
function resolveCommandInput(argv: string[]): CommandInput {
  const [command, ...args] = argv

  if (!command) {
    throw new Error('with-local-env requires a command to execute')
  }

  return {
    args,
    command,
  }
}

/**
 * 启动目标子进程，并把退出码透明传回调用方。
 */
async function runCommand(commandInput: CommandInput): Promise<number> {
  const child = spawn(commandInput.command, commandInput.args, {
    env: process.env,
    shell: false,
    stdio: 'inherit',
  })

  return await new Promise<number>((resolvePromise, rejectPromise) => {
    child.once('error', rejectPromise)
    child.once('exit', (code, signal) => {
      if (signal) {
        resolvePromise(1)
        return
      }

      resolvePromise(code ?? 0)
    })
  })
}

/**
 * 加载本地环境后执行目标命令，供根脚本复用。
 */
async function main(): Promise<void> {
  const repositoryRoot = resolveRepositoryRoot()
  const envResolution = loadLocalEnv(repositoryRoot)
  const commandInput = resolveCommandInput(process.argv.slice(2))

  if (envResolution) {
    console.info(
      `[local-env] loaded ${envResolution.loadedKeys.length} keys from ${envResolution.filePath}`,
    )
  } else {
    console.info('[local-env] no .env.local or .env file found, using current shell environment')
  }

  const exitCode = await runCommand(commandInput)

  process.exitCode = exitCode
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
