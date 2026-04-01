# 环境矩阵与密钥契约

Last Updated: 2026-04-01
Owner: Scheduler Thread
Scope: Phase 6 `P6-T1`

## 1. 当前支持边界

- 当前仓库已经验证可工作的运行时：
  - `apps/web` on Next.js / Node
  - `apps/api` on Node.js
  - `apps/jobs` on Node.js / Trigger.dev
  - `packages/auth` / `packages/db` 本地与服务端运行
- 当前仓库尚未完成的部署面对齐：
  - `apps/worker` 仍是 skeleton，不能宣称 Cloudflare Worker runtime 已对齐
  - `Mode A: 全 Serverless` 仍是目标态，不是当前已验证交付态

## 2. 当前运行时环境变量

下表只列出仓库当前代码真实读取的环境变量，也是当前 `.env.example` 必须覆盖的最小合同。

| Key | Consumers | Required When | Secret | Notes |
|---|---|---|---|---|
| `NODE_ENV` | `web`, `api`, `auth`, `db` | all runtimes | no | 控制生产约束与默认值 |
| `APP_URL` | `web`, `api`, `auth` | all runtimes | no | 浏览器入口地址 |
| `API_URL` | `web`, `api`, `auth` | all runtimes | no | API 基础地址 |
| `PORT` | `api` | Node API runtime | no | API 监听端口 |
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
| `VERCEL_TOKEN` | `apps/web` deploy | yes | target-state | Vercel deploy token |
| `VERCEL_ORG_ID` | `apps/web` deploy | no | target-state | Vercel 组织 ID |
| `VERCEL_PROJECT_ID` | `apps/web` deploy | no | target-state | Vercel 项目 ID |

## 4. Worker 与 Cloudflare 绑定合同

这些不是 `.env` 环境变量，而是 Cloudflare binding。当前仓库还没有完成对应 runtime 对齐，因此这里先把合同固定下来，后续由 `P6-F1` 落地。

| Binding | Intended Consumer | Status | Notes |
|---|---|---|---|
| `R2_BUCKET` | `apps/api`, `apps/worker` | target-state | 文件对象存储 |
| `NOTIFICATION_QUEUE` | `apps/api`, `apps/worker` | target-state | 通知队列生产者 / 消费者 |
| `CACHE_INVALIDATION_QUEUE` | `apps/worker` | target-state | 缓存失效消费 |

## 5. 部署模式准入

| Mode | Current Status | Why |
|---|---|---|
| `Mode A: 全 Serverless` | partial | 设计文档已定义，但 `apps/worker` 未对齐，API 也尚未具备完整 Cloudflare deploy config |
| `Mode B: 混合` | next-up | 最贴近当前仓库实际形态：`web`、`api`、`jobs` 都已有 Node runtime |
| `Mode C: 全自托管` | partial | 需要 `P6-T2` Docker topology 与 `P6-T5` rollback/playbook 才能闭环 |

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

## 7. 下一个纠偏任务

- `P6-F1 worker deployment alignment`
  - 目标：把 `apps/worker` 从 skeleton 提升到可部署的 Cloudflare Worker runtime
  - 交付：真实入口、绑定契约、最小 smoke test、后续 `wrangler` 配置前置条件
  - 原因：不先完成这一步，`P6-T3` 无法诚实地宣称覆盖 worker deploy surface
