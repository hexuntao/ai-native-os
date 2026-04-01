
# 部署指南

> 本文档定义 AI Native OS 系统的三种部署模式和详细配置。

---

## 一、部署模式总览

| 模式 | 前端 | 后端 API | AI / 任务队列 | 数据库 | 适用场景 |
|------|------|---------|-------------|--------|---------|
| **模式 A: 全 Serverless** | Vercel | Cloudflare Workers | Trigger.dev Cloud | Neon + Upstash | MVP / 个人 |
| **模式 B: 混合** | Vercel | Docker (VPS) | Docker (VPS) | Neon / Docker | 小团队 |
| **模式 C: 全自托管** | Cloudflare Pages | Docker (VPS) | Docker (VPS) | Docker | 企业私有 |

---

## 二、环境变量配置

> 说明：
> - 本章的部署模板描述的是目标态架构。
> - 当前仓库已经落地并验证过的真实运行时合同，以 `docs/environment-matrix.md` 为准。
> - `apps/worker` 已完成 runtime / binding contract 对齐；`wrangler`、Cloudflare bindings 声明与 staging deploy 仍属于 `P6-T3` 范围。

### 2.1 统一环境变量模板

```bash
# .env.example

# ============ 基础配置 ============
NODE_ENV=production
APP_URL=https://admin.example.com
API_URL=https://api.example.com

# ============ 数据库 ============
# Neon (Serverless)
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
# 或 Docker 自托管
# DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_native_admin

# ============ Redis ============
# Upstash (Edge)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
# 或 Docker 自托管
# REDIS_URL=redis://localhost:6379

# ============ 认证 ============
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=https://api.example.com

# JWT
JWT_SECRET=your-jwt-secret

# OAuth (可选)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ============ AI ============
# LLM Provider
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# Mastra
MASTRA_LOG_LEVEL=info

# ============ 任务队列 ============
# Trigger.dev
TRIGGER_SECRET_KEY=tr_dev_xxx
TRIGGER_API_URL=https://api.trigger.dev   # 或自托管地址

# ============ 邮件 ============
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@example.com

# ============ 文件存储 ============
# Cloudflare R2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=ai-native-os
R2_PUBLIC_URL=https://files.example.com

# 或 AWS S3
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=
# S3_BUCKET_NAME=

# 或本地存储
# LOCAL_STORAGE_PATH=./uploads

# ============ 监控 ============
SENTRY_DSN=https://xxx@sentry.io/xxx
OTEL_EXPORTER_OTLP_ENDPOINT=https://xxx

# ============ Cloudflare ============
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_API_TOKEN=xxx
```

---

## 三、模式 A：全 Serverless 部署

### 3.1 架构图

```
用户 → Vercel CDN → Next.js (Vercel Edge)
                  → Hono API (Cloudflare Workers)
                  → Trigger.dev Cloud (任务队列)
                  → Neon (PostgreSQL Serverless)
                  → Upstash (Redis HTTP)
                  → Cloudflare R2 (文件存储)
```

### 3.2 Vercel 部署（前端 + AI 流式端点）

```json
// apps/web/vercel.json
{
  "framework": "nextjs",
  "buildCommand": "pnpm turbo build --filter=web",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install",
  "env": {
    "NEXT_PUBLIC_API_URL": "@api-url",
    "NEXT_PUBLIC_APP_URL": "@app-url"
  },
  "functions": {
    "app/api/**/*": {
      "maxDuration": 60
    }
  }
}
```

Vercel 配置要点：
- 项目根目录设为 Monorepo 根目录
- Build Command: `cd ../.. && pnpm turbo build --filter=web`
- Output Directory: `apps/web/.next`
- Root Directory: `apps/web`
- 环境变量在 Vercel Dashboard 中配置

### 3.3 Cloudflare Workers 部署（API）

```toml
# apps/api/wrangler.toml
name = "ai-native-os-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"

# 绑定
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "ai-native-os"

[[queues.producers]]
queue = "notifications"
binding = "NOTIFICATION_QUEUE"

[[queues.consumers]]
queue = "notifications"
max_batch_size = 10
max_batch_timeout = 30

# 秘密（通过 wrangler secret put 设置）
# DATABASE_URL, UPSTASH_REDIS_REST_URL, etc.
```

```bash
# 部署命令
cd apps/api
pnpm wrangler deploy

# 设置 secrets
pnpm wrangler secret put DATABASE_URL
pnpm wrangler secret put OPENAI_API_KEY
# ... 其他 secrets
```

### 3.4 Cloudflare Workers 部署（Worker）

```toml
# apps/worker/wrangler.toml
name = "ai-native-os-worker"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "ai-native-os"

[[queues.consumers]]
queue = "notifications"
max_batch_size = 10

[[queues.consumers]]
queue = "cache-invalidation"
max_batch_size = 50
```

### 3.5 Trigger.dev Cloud 配置

```typescript
// apps/jobs/trigger.config.ts
import { defineConfig } from '@trigger.dev/sdk/v3'

export default defineConfig({
  project: 'ai-native-os',
  runtime: 'node',
  logLevel: 'info',
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
  dirs: ['src/trigger'],
})
```

```bash
# 部署 Trigger.dev 任务
cd apps/jobs
pnpm dlx trigger.dev@latest deploy
```

---

## 四、模式 B：混合部署

### 4.1 架构图

```
用户 → Vercel CDN → Next.js (Vercel)
                  → VPS (Docker)
                      ├── Hono API Container
                      ├── Trigger.dev Worker Container
                      ├── PostgreSQL Container
                      └── Redis Container
                  → Cloudflare R2 (文件存储)
```

### 4.2 Docker Compose（生产）

```yaml
# docker/docker-compose.prod.yml
version: '3.8'

services:
  # ===== API 服务 =====
  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.api
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/ai_native_admin
      - REDIS_URL=redis://redis:6379
    env_file:
      - ../.env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'

  # ===== Trigger.dev Worker =====
  jobs:
    build:
      context: ..
      dockerfile: docker/Dockerfile.jobs
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/ai_native_admin
      - REDIS_URL=redis://redis:6379
    env_file:
      - ../.env.production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G         # AI 任务需要更多内存
          cpus: '2.0'

  # ===== PostgreSQL =====
  postgres:
    image: pgvector/pgvector:pg17
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: ai_native_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ===== Redis =====
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ===== Nginx 反向代理 =====
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 4.3 Dockerfile（API）

```dockerfile
# docker/Dockerfile.api
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# 安装依赖
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
RUN pnpm install --frozen-lockfile --prod

# 构建
FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm turbo build --filter=api

# 运行
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

### 4.4 Nginx 配置

```nginx
# docker/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:3001;
    }

    # HTTPS
    server {
        listen 443 ssl http2;
        server_name api.example.com;

        ssl_certificate /etc/nginx/certs/fullchain.pem;
        ssl_certificate_key /etc/nginx/certs/privkey.pem;

        # API 路由
        location /api/ {
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Mastra / AI 路由
        location /mastra/ {
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_read_timeout 300s;        # AI 长请求
        }

        # SSE / WebSocket（AI 流式 + 实时通信）
        location /api/copilotkit {
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_buffering off;            # SSE 不缓冲
            proxy_cache off;
            proxy_read_timeout 86400s;
        }

        # Scalar API 文档
        location /api/docs {
            proxy_pass http://api;
        }
    }

    # HTTP → HTTPS 重定向
    server {
        listen 80;
        server_name api.example.com;
        return 301 https://$host$request_uri;
    }
}
```

---

## 五、模式 C：全自托管部署

### 5.1 架构图

```
用户 → Cloudflare CDN → Cloudflare Pages (Next.js 静态 + SSR)
                      → VPS (Docker)
                          ├── Hono API Container
                          ├── Trigger.dev Self-hosted
                          │   ├── trigger-webapp
                          │   └── trigger-worker
                          ├── PostgreSQL + pgvector
                          └── Redis
```

### 5.2 Next.js 部署到 Cloudflare Pages

需要使用 `@opennextjs/cloudflare` 适配器。

```typescript
// apps/web/next.config.ts
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

initOpenNextCloudflareForDev()

const nextConfig = {
  // Cloudflare Pages 兼容配置
  output: 'standalone',
  experimental: {
    // ...
  },
}

export default nextConfig
```

```bash
# 部署到 Cloudflare Pages
cd apps/web
pnpm dlx @opennextjs/cloudflare build
pnpm wrangler pages deploy .open-next/assets --project-name=ai-native-os
```

### 5.3 Trigger.dev 自托管

```yaml
# docker/docker-compose.trigger.yml
# 在 docker-compose.prod.yml 基础上增加

services:
  trigger-webapp:
    image: ghcr.io/triggerdotdev/trigger.dev:v4
    ports:
      - "3030:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/trigger
      - DIRECT_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/trigger
      - REDIS_URL=redis://redis:6379
      - MAGIC_LINK_SECRET=${TRIGGER_MAGIC_LINK_SECRET}
      - SESSION_SECRET=${TRIGGER_SESSION_SECRET}
      - ENCRYPTION_KEY=${TRIGGER_ENCRYPTION_KEY}
      - V3_ENABLED=true
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  trigger-worker:
    image: ghcr.io/triggerdotdev/trigger.dev:v4
    command: worker
    environment:
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/trigger
      - REDIS_URL=redis://redis:6379
    depends_on:
      - trigger-webapp
    restart: unless-stopped
```

---

## 六、CI/CD 流水线

### 6.1 GitHub Actions — CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg17
        env:
          POSTGRES_DB: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm db:migrate
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
      - run: pnpm test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
```

### 6.2 GitHub Actions — 部署 Vercel

```yaml
# .github/workflows/deploy-vercel.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build --filter=web

      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: apps/web
          vercel-args: '--prod'
```

### 6.3 GitHub Actions — 部署 Cloudflare

```yaml
# .github/workflows/deploy-cloudflare.yml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build --filter=api

      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: apps/api

  deploy-worker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: apps/worker
```

### 6.4 GitHub Actions — Docker 部署

```yaml
# .github/workflows/deploy-docker.yml
name: Deploy Docker

on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile.api
          push: true
          tags: ghcr.io/${{ github.repository }}/api:latest

      - uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile.jobs
          push: true
          tags: ghcr.io/${{ github.repository }}/jobs:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/ai-native-os
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d
            docker system prune -f
```

---

## 七、数据库迁移策略

### 7.1 开发环境

```bash
# 修改 packages/db/src/schema/*.ts 后

# 生成迁移文件
pnpm --filter db db:generate

# 查看迁移 SQL（不执行）
pnpm --filter db db:check

# 执行迁移
pnpm --filter db db:migrate

# 开发快速同步（跳过迁移文件，直接推送）
pnpm --filter db db:push
```

### 7.2 生产环境

```bash
# CI/CD 中自动执行迁移
# 在 deploy job 中添加：
pnpm --filter db db:migrate

# 或在 Docker entrypoint 中：
# docker/entrypoint.sh
#!/bin/sh
echo "Running database migrations..."
npx drizzle-kit migrate
echo "Migrations complete. Starting server..."
exec "$@"
```

### 7.3 迁移回滚

Drizzle Kit 不原生支持回滚。策略：
- 每次迁移前自动备份数据库
- 回滚时恢复备份 + 删除迁移记录
- 建议使用 Neon 的 branch 功能做变更预览

---

## 八、监控与告警

### 8.1 Sentry 配置

```typescript
// apps/api/src/lib/sentry.ts
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,        // 生产环境采样 10%
  profilesSampleRate: 0.1,
})
```

```typescript
// apps/web/sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
})
```

### 8.2 OpenTelemetry 配置

```typescript
// apps/api/src/lib/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: 'ai-native-os-api',
})

sdk.start()
```

### 8.3 健康检查端点

```typescript
// apps/api/src/routes/health.ts
app.get('/health', async (c) => {
  const checks = {
    api: 'ok',
    database: 'unknown',
    redis: 'unknown',
    mastra: 'unknown',
  }

  try {
    await db.execute(sql`SELECT 1`)
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
  }

  try {
    await redis.ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
  }

  const allOk = Object.values(checks).every(v => v === 'ok')

  return c.json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  }, allOk ? 200 : 503)
})
```

---

## 九、安全检查清单

### 9.1 部署前检查

- [ ] 所有 SECRET/KEY 使用环境变量，不硬编码
- [ ] 数据库使用强密码 + SSL 连接
- [ ] Redis 设置密码 + maxmemory
- [ ] CORS 仅允许前端域名
- [ ] API Rate Limiting 已启用
- [ ] HTTPS 已配置（TLS 1.3）
- [ ] Secure Headers 已启用（CSP, HSTS, X-Frame-Options）
- [ ] Docker 容器以非 root 用户运行
- [ ] 敏感日志已脱敏
- [ ] AI Agent 输入已做 Prompt 注入防护
- [ ] 文件上传已限制类型和大小

### 9.2 定期维护

- [ ] 每周：检查依赖安全更新（pnpm audit）
- [ ] 每周：检查 AI Agent 评估分数（Mastra Evals）
- [ ] 每月：数据库备份验证
- [ ] 每月：SSL 证书续期检查
- [ ] 每季度：权限审计（RBAC 检查冗余权限）
- [ ] 每季度：Docker 镜像安全扫描
