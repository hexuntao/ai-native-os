import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { NextConfig } from 'next'

function resolveWorkspaceRoot(): string {
  const currentFilePath = fileURLToPath(import.meta.url)
  const currentDirectory = path.dirname(currentFilePath)

  return path.join(currentDirectory, '../..')
}

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
