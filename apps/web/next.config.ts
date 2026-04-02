import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { NextConfig } from 'next'

/**
 * 为 Turbopack 显式声明 monorepo 根目录，避免 Vercel 构建时把 `src/app` 误判为项目根。
 */
function resolveWorkspaceRoot(): string {
  const currentFilePath = fileURLToPath(import.meta.url)
  const currentDirectory = path.dirname(currentFilePath)

  return path.join(currentDirectory, '../..')
}

// Phase 4 的首要目标是把 web 恢复到文档要求的 Next.js App Router 基线。
const nextConfig: NextConfig = {
  outputFileTracingRoot: resolveWorkspaceRoot(),
  reactStrictMode: true,
  turbopack: {
    root: resolveWorkspaceRoot(),
  },
  transpilePackages: ['@ai-native-os/shared', '@ai-native-os/ui'],
  typedRoutes: true,
}

export default nextConfig
