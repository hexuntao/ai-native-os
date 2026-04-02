
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

当前仓库已经落地 [apps/web/vercel.json](/Users/tao/work/ai/ai-native-os/apps/web/vercel.json)，只保留 Next.js 真实需要的最小配置：

- `framework = nextjs`
- `src/app/api/**/*` 的函数超时上限设为 `60s`

Vercel 配置要点：
- 必须把 Project Root Directory 设为 `apps/web`
- 首次接入前先执行 `vercel pull --yes` 或 `vercel link`
- `APP_URL`、`API_URL`、`BETTER_AUTH_URL`、`BETTER_AUTH_SECRET` 需要在 Vercel Dashboard 中按 preview / production 分环境配置
- 当前仓库未提交 `.vercel/project.json`，因此本地 `vercel build` 在未 link 前会失败，这是预期 blocker，不是代码错误

推荐命令：

```bash
cd apps/web
vercel pull --yes --environment=preview
vercel build
vercel deploy --prebuilt
```

### 3.3 Cloudflare Workers 部署（API）

```toml
# apps/api/wrangler.toml
name = "ai-native-os-api"
main = "src/index.ts"
compatibility_date = "2026-04-02"
compatibility_flags = ["nodejs_compat"]
workers_dev = true
```

```bash
# 本地 dry-run
pnpm --filter @ai-native-os/api deploy:cloudflare:staging:dry-run

# 真实部署前需要：
# 1. wrangler login 或 CLOUDFLARE_API_TOKEN
# 2. 配置 APP_URL / API_URL / BETTER_AUTH_URL 这些与真实域名相关的 vars
# 3. 配置 DATABASE_URL / BETTER_AUTH_SECRET / OPENAI_API_KEY 等 secrets
```

说明：
- 这份配置已经通过本地 `wrangler deploy --dry-run --env staging` 打包验证
- `apps/api` 当前通过同一份 `src/index.ts` 同时支持 Node 自托管和 Cloudflare Worker 入口
- 与真实域名绑定的 URL 变量没有硬编码进 `wrangler.toml`，避免把账号特定的 `workers.dev` / Vercel 域名写死进仓库

### 3.4 Cloudflare Workers 部署（Worker）

```toml
# apps/worker/wrangler.toml
name = "ai-native-os-worker"
main = "src/index.ts"
compatibility_date = "2026-04-02"
compatibility_flags = ["nodejs_compat"]
workers_dev = true
```

当前仓库版本还额外落了：
- staging / prod 双环境命名
- `R2_BUCKET`
- `NOTIFICATION_QUEUE`
- `CACHE_INVALIDATION_QUEUE`
- queue producer / consumer 双向声明

推荐验证命令：

```bash
pnpm --filter @ai-native-os/worker deploy:cloudflare:staging:dry-run
```

### 3.5 Trigger.dev Cloud 配置

```typescript
// apps/jobs/trigger.config.ts
import { defineConfig } from '@trigger.dev/sdk/v3'

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? 'proj_replace_me',
  runtime: 'node',
  machine: 'small-1x',
  maxDuration: 3600,
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
  compatibilityFlags: ['run_engine_v2'],
  dirs: ['src/trigger'],
})
```

```bash
# dry-run（需要先登录 Trigger.dev）
cd apps/jobs
TRIGGER_PROJECT_REF=proj_xxx pnpm dlx trigger.dev@latest deploy . --config trigger.config.ts --env staging --dry-run
```

说明：
- Trigger.dev CLI 即使 `--dry-run` 也会先检查登录态
- 当前仓库已补充 package scripts，但本地验证仍会阻塞在 Trigger 登录
- `TRIGGER_PROJECT_REF` 现在是显式前置条件，不能再继续沿用错误的项目名字符串

---

## 四、模式 B：混合部署

### 4.1 架构图

当前仓库在 `P6-T2` 真正跑通的是一套 VPS 自托管参考拓扑；真正的 Vercel/Cloudflare 平台发布描述符仍属于 `P6-T3`。

```
用户 → Nginx (Docker / VPS)
     → Next.js Web Container
     → Hono API Container
     → Jobs Runtime Container
     → PostgreSQL Container
     → Redis Container
```

### 4.2 当前仓库已落地的自托管文件

当前仓库已经有一套真实可运行的自托管 Docker 交付物，而不是只有文档样例：

- `docker/docker-compose.prod.yml`
- `docker/Dockerfile.web`
- `docker/Dockerfile.api`
- `docker/Dockerfile.jobs`
- `docker/nginx.conf`
- `.dockerignore`

这套拓扑的真实结构是：

```text
nginx
  -> web:3000     # Next.js App Router 与同源 /api/* route handlers
  -> api:3001     # /api/v1/*、/api/auth/*、/api/docs、/api/openapi.json、/health、/mastra/*

web
  -> api:3001     # 容器内 API_URL 走内网，供 route handler 转发

jobs
  -> /health      # 最小自托管健康面，避免继续把 jobs 保持在“无法启动验证”的状态

postgres + redis
  -> 作为 compose 内部依赖，由 API / jobs 运行时消费
```

### 4.3 启动顺序（当前推荐）

```bash
# 1. 先执行数据库迁移
BETTER_AUTH_SECRET=replace-with-a-real-secret \
docker compose -f docker/docker-compose.prod.yml --profile ops run --rm migrate

# 2. 再启动完整自托管拓扑
BETTER_AUTH_SECRET=replace-with-a-real-secret \
docker compose -f docker/docker-compose.prod.yml up --build -d

# 3. 烟雾验证
curl http://localhost:8080/health
curl http://localhost:8080/healthz
```

说明：

- `BETTER_AUTH_SECRET` 在 compose 中是强制变量，不允许继续依赖开发默认 secret。
- `PUBLIC_API_URL` / `APP_URL` 默认指向 `http://localhost:8080`，用于 nginx 聚合入口；`web` 容器内部的 `API_URL` 则固定走 `http://api:3001`。
- 当前 `nginx` 只精确转发后端拥有的路径，避免把 Next.js 自己的 `/api/copilotkit`、`/api/ag-ui/runtime*`、`/api/ai/feedback` 等同源 route handlers 误代理到 API。

### 4.4 反向代理路由策略

当前 `docker/nginx.conf` 的设计原则：

- `/api/v1/*`、`/api/auth/*`、`/api/docs`、`/api/openapi.json`、`/health`、`/mastra/*` -> `api`
- `/api/copilotkit`、`/api/ag-ui/runtime`、`/api/ag-ui/runtime/events` -> `web`
- 其他页面与静态资源 -> `web`

这样做的原因是：

- API 合约面继续由 Hono + oRPC 持有
- CopilotKit / AG-UI 的浏览器同源入口仍由 Next route handlers 持有
- 不会因为反向代理过宽而破坏 Phase 4 已经完成的前后端集成

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
