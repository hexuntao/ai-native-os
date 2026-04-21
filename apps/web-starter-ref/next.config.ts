import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

function resolveWorkspaceRoot(): string {
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDirectory = path.dirname(currentFilePath);

  return path.join(currentDirectory, '../..');
}

const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  outputFileTracingRoot: resolveWorkspaceRoot(),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.slingacademy.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: 'clerk.com',
        port: ''
      }
    ]
  },
  transpilePackages: ['geist', '@ai-native-os/shared'],
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  },
  turbopack: {
    root: resolveWorkspaceRoot()
  },
  typedRoutes: true
};

export default nextConfig;
