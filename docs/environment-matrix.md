# 环境矩阵与密钥契约

Last Updated: 2026-04-02
Owner: Scheduler Thread
Scope: Phase 6 `P6-T1` + `P6-F1` + `P6-T2` + `P6-T3` + `P6-T4` + `P6-T5`

## 1. 当前支持边界

- 当前仓库已经验证可工作的运行时：
  - `apps/web` on Next.js / Node
  - `apps/api` on Node.js
  - `apps/jobs` on Node.js / Trigger.dev
  - `apps/worker` on Cloudflare-compatible runtime contract
  - `packages/auth` / `packages/db` 本地与服务端运行
- 当前仓库已经落地的自托管拓扑：
  - `docker/docker-compose.prod.yml` 提供 `nginx + web + api + jobs + postgres + redis`
  - `docker/Dockerfile.web` / `docker/Dockerfile.api` / `docker/Dockerfile.jobs` 已提供镜像入口
  - `apps/jobs` 现在额外暴露只读 `/health`，`apps/web` 额外暴露只读 `/healthz`
- 当前仓库已经落地的平台部署描述符：
  - `apps/web/vercel.json`
  - `apps/api/wrangler.toml`
  - `apps/worker/wrangler.toml`
  - `apps/jobs/trigger.config.ts` + package deploy scripts
- 当前仓库已经落地的 release hardening 入口：
  - `pnpm release:smoke`
  - `pnpm release:backup:verify`
  - `docs/release-playbook.md`
- 当前仓库已经落地的 API 安全基线：
  - `secureHeaders`
  - `cors`
  - `requestId`
  - production 默认启用的进程内 Hono rate limiting
- 当前仓库尚未完成的部署面对齐：
  - Cloudflare API / Worker 当前只有 `wrangler deploy --dry-run` 级验证，未完成真实远端 staging 发布
  - Trigger.dev 当前缺少 CLI 登录态，`deploy --dry-run` 仍会阻塞在交互登录
  - Vercel 的本地 `.vercel/project.json` 仍是 gitignored 本地态，不属于仓库交付物

## 2. 当前运行时环境变量

下表只列出仓库当前代码真实读取的环境变量，也是当前 `.env.example` 必须覆盖的最小合同。

| Key | Consumers | Required When | Secret | Notes |
|---|---|---|---|---|
| `NODE_ENV` | `web`, `api`, `auth`, `db` | all runtimes | no | 控制生产约束与默认值 |
| `APP_URL` | `web`, `api`, `auth` | all runtimes | no | 浏览器入口地址；Vercel preview 未显式配置时会回退到 `https://${VERCEL_URL}` |
| `API_URL` | `web`, `api`, `auth` | all runtimes | no | API 基础地址；Vercel preview 未显式配置时会临时回退到当前部署域名，但完整数据面仍建议显式提供 |
| `PORT` | `api`, `jobs` | Node runtime | no | `api` 默认 `3001`，`jobs` 自托管健康服务默认 `3040`；在当前 Docker 拓扑里该端口仅对 compose 内部网络开放 |
| `DATABASE_URL` | `db`, `api`, `jobs` | all non-test server runtimes | yes | PostgreSQL 连接串 |
| `REDIS_URL` | `api` | Redis URL 可用时 | yes | 健康检查与后续 Redis 连接入口 |
| `REDIS_HOST` | `api` | 不使用 `REDIS_URL` 时 | no | 与 `REDIS_PORT`/`REDIS_PASSWORD` 组合使用 |
| `REDIS_PORT` | `api` | 不使用 `REDIS_URL` 时 | no | Redis 端口 |
| `REDIS_PASSWORD` | `api` | Redis 开启鉴权时 | yes | Redis 密码 |
| `REDIS_HEALTH_TIMEOUT_MS` | `api` | optional | no | Redis 健康探针超时 |
| `BETTER_AUTH_SECRET` | `auth`, `api`, `web` | production required | yes | Better Auth 签名密钥 |
| `BETTER_AUTH_URL` | `auth`, `api`, `web` | recommended | no | Better Auth 基础地址 |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `auth` | cross-origin auth setups | no | 逗号分隔 origin 列表 |
| `OPENAI_API_KEY` | `api`, `jobs` | production RAG / remote embeddings | yes | 当前唯一已接线的远程模型密钥 |
| `MASTRA_DEFAULT_MODEL` | `api` | optional | no | Mastra 默认模型路由 |
| `MASTRA_OPENAPI_PATH` | `api` | optional | no | Mastra OpenAPI 子路径 |
| `MASTRA_ROUTE_PREFIX` | `api` | optional | no | Mastra 运行时前缀 |
| `MASTRA_RAG_EMBEDDING_MODEL` | `api` | optional | no | RAG embedding 模型 ID |
| `EXTERNAL_MCP_SERVER_URL` | `api` | external MCP client enabled | no | 外部 MCP 服务地址 |
| `EXTERNAL_MCP_AUTH_HEADER_NAME` | `api` | authenticated external MCP | no | MCP 鉴权 header 名称 |
| `EXTERNAL_MCP_AUTH_HEADER_VALUE` | `api` | authenticated external MCP | yes | MCP 鉴权 header 值 |
| `TRIGGER_SECRET_KEY` | `jobs` | Trigger.dev cloud/self-host required | yes | Trigger.dev 运行密钥 |
| `TRIGGER_API_URL` | `jobs` | Trigger.dev cloud/self-host required | no | Trigger.dev API 地址 |
| `SENTRY_DSN` | `api` | telemetry enabled | yes | Sentry DSN |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `api` | telemetry enabled | yes | OTLP 导出地址 |
| `OTEL_SERVICE_NAME` | `api` | optional | no | OpenTelemetry service name |
| `TELEMETRY_TRACES_SAMPLE_RATE` | `api` | optional | no | 0-1 之间的采样率 |

## 3. 部署凭据与平台密钥

下列值属于部署阶段密钥或平台凭据，不是当前仓库运行时代码直接读取的 `.env` 键，但 Phase 6 必须纳入 secret contract。

| Key | Used By | Secret | Status | Notes |
|---|---|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | `apps/api`, `apps/worker` deploy | no | target-state | Cloudflare 账号 ID |
| `CLOUDFLARE_API_TOKEN` | Cloudflare deploy | yes | target-state | Wrangler / GitHub Actions 使用 |
| `TRIGGER_ACCESS_TOKEN` | `apps/jobs` deploy | yes | target-state | Trigger.dev CLI 在 GitHub Actions / 非交互环境中的访问令牌 |
| `VERCEL_TOKEN` | `apps/web` deploy | yes | target-state | Vercel deploy token |
| `VERCEL_ORG_ID` | `apps/web` deploy | no | target-state | Vercel 组织 ID |
| `VERCEL_PROJECT_ID` | `apps/web` deploy | no | target-state | Vercel 项目 ID |
| `TRIGGER_PROJECT_REF` | `apps/jobs` deploy | no | target-state | Trigger.dev dashboard 中的 `proj_*` 项目引用 |

## 4. Worker 与 Cloudflare 绑定合同

这些不是 `.env` 环境变量，而是 Cloudflare binding。`P6-F1` 已把这些 binding 的运行时合同落到 `apps/worker` 代码中，但真正的 `wrangler` 绑定声明与平台发布仍属于 `P6-T3`。

| Binding | Intended Consumer | Status | Notes |
|---|---|---|---|
| `R2_BUCKET` | `apps/api`, `apps/worker` | runtime-aligned | `apps/worker` 已使用该 binding 写入队列回执对象 |
| `NOTIFICATION_QUEUE` | `apps/api`, `apps/worker` | runtime-aligned | 已在 worker 代码中固定消息合同与队列名 |
| `CACHE_INVALIDATION_QUEUE` | `apps/worker` | runtime-aligned | 已在 worker 代码中固定消息合同与队列名 |

## 5. 部署模式准入

| Mode | Current Status | Why |
|---|---|---|
| `Mode A: 全 Serverless` | partial | `apps/web` 已完成真实 Vercel staging/preview 发布；Cloudflare / Trigger 仍停留在 dry-run 或登录阻塞 |
| `Mode B: 混合` | validated | 仓库已提供并验证 `docker-compose.prod.yml`、三份 Dockerfile 与 nginx 精确路由 |
| `Mode C: 全自托管` | validated | Docker topology、rollback / smoke playbook、backup verify、jobs 内部健康探针都已完成仓库内验证 |

说明：

- `Phase 6` 的仓库级完成含义是：至少一个部署模式已完成可验证闭环，且其余目标模式的描述符、CI/CD、回滚与发布合同已经入库。
- 这不等价于每个外部平台账号都已完成真实远端发布；Cloudflare / Trigger 的真实远端 deploy 仍受平台登录态与 secrets 约束。

## 6. 目前不应视为必填的目标态变量

以下变量只在目标架构文档中出现，但当前仓库没有真实消费链路，不能继续冒充“当前必填”：

- `JWT_SECRET`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

这些值后续只有在对应能力真正接线时，才应升级为运行时合同。

## 7. Worker 对齐结果

- `P6-F1` 已完成：
  - `apps/worker` 现在暴露了真实的 Worker 入口，而不是 skeleton 标记
  - 只读 smoke path 已固定为 `GET /health`
  - `notifications` / `cache-invalidation` 两类队列消息会写入 `R2_BUCKET` 回执
- 下一步：
  - `P6-T3` 负责把这些代码级合同映射到 `wrangler`、Cloudflare bindings 与 staging deploy

## 8. Docker 自托管说明

- `docker/docker-compose.prod.yml` 当前使用两层 URL 合同：
  - `web` 容器内的 `API_URL` 指向 `http://api:3001`，用于 Next route handler 向后端转发
  - `api` / `jobs` 容器内的 `API_URL` 指向公开入口 `${PUBLIC_API_URL}`，用于文档和运行时元信息
- `BETTER_AUTH_SECRET` 在 compose 中被显式要求提供，不允许继续依赖开发默认 secret
- `migrate` 服务通过 `ops` profile 暴露，推荐在首次启动或 schema 变更后执行：
  - `docker compose -f docker/docker-compose.prod.yml --profile ops run --rm migrate`
- `nginx` 只把后端拥有的 `/api/v1/*`、`/api/auth/*`、`/api/docs`、`/api/openapi.json`、`/health`、`/mastra/*` 转发给 API，其余流量仍交给 `web`，避免吞掉 Next 同源 route handlers
- `jobs` 的 `3040` 端口默认不发布到宿主机；Phase 6 发布演练应通过 `docker compose exec -T jobs ... fetch('http://127.0.0.1:3040/health')` 做内部健康验证

## 9. 平台部署阻塞项

- Cloudflare:
  - 本地 `wrangler deploy --dry-run` 已通过，说明 `apps/api` 与 `apps/worker` 当前至少具备可打包的 Workers 入口
  - 真实 deploy 仍需要有效的 `wrangler login` 会话或 `CLOUDFLARE_API_TOKEN`
- Vercel:
  - `apps/web/vercel.json` 与 root-aware package scripts 已落地
  - `apps/web` 已完成一次真实 Vercel 发布与域名烟雾验证
  - 要复现这条链路，必须使用 monorepo 形态的项目设置：`framework=nextjs`、`rootDirectory=apps/web`、`sourceFilesOutsideRootDirectory=true`
  - `.vercel/project.json` 仍是 gitignored 本地态，因此仓库本身不会携带账号级项目链接信息
- GitHub Actions:
  - `P6-T4` 已落地 `CI + reusable quality gate + reusable deploy + staging/prod wrappers`
  - 发布 workflow 依赖 GitHub environment-scoped `vars/secrets`
  - workflow 默认只强制保证已验证的 Vercel Web 主链路，Cloudflare / Trigger 通过显式开关启用
- Trigger.dev:
  - `trigger.config.ts` 现在显式要求 `TRIGGER_PROJECT_REF`
  - CLI 即使 `--dry-run` 也会先要求登录，因此本地 smoke 依赖 Trigger.dev 登录态
  - GitHub Actions 中则应改用 `TRIGGER_ACCESS_TOKEN` 进行非交互部署
