import type { NextConfig } from 'next'

// Phase 4 的首要目标是把 web 恢复到文档要求的 Next.js App Router 基线。
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ai-native-os/shared', '@ai-native-os/ui'],
  typedRoutes: true,
}

export default nextConfig
