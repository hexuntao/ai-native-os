# Plan: E2E Runtime Remediation

**Generated**: 2026-04-08
**Estimated Complexity**: High
**Owner**: E2E Validation Thread
**Scope**: 只修复本地可运行性、认证闭环、AI 能力契约、部署文档与验证缺口，不新增业务功能

## Overview

本计划针对最新端到端验证中发现的 4 类问题做纠偏：

1. Fresh setup 不能直接登录后台，认证初始化链路不完整。
2. AI Copilot 主链路缺少前置密钥检查，运行时才失败。
3. MCP/AI 的“能力发现”与真实 RBAC 可执行能力不一致。
4. 本地运行与部署文档存在偏差，导致新环境难以复现。

修复原则：

- 不绕过 Better Auth、RBAC、审计日志、Tool 权限检查。
- 不扩大到新功能开发，只补齐最小运行闭环。
- 文档、脚本、seed、运行时行为必须一致。
- 每个 Sprint 都要形成可演示、可回归、可自动验证的增量。

## Prerequisites

- 本地基础设施使用 [docker/docker-compose.yml](/Users/tao/work/ai/ai-native-os/docker/docker-compose.yml) 提供 PostgreSQL / Redis。
- 所有改动遵守 [AGENTS.md](/Users/tao/work/ai/ai-native-os/AGENTS.md) 与 [Challenge.md](/Users/tao/work/ai/ai-native-os/Challenge.md)。
- 变更后必须执行：
  - `pnpm biome check --write <changed-files>`
  - `pnpm lint`
  - `pnpm typecheck`
- 每个 Sprint 结束后都要补一轮最小 E2E smoke。

## Sprint 1: 登录与本地启动闭环

**Goal**: 新环境在不手工调用认证 API 的情况下，能够完成迁移、seed、登录后台。

**Demo/Validation**:

- `docker compose -f docker/docker-compose.yml up -d`
- `pnpm db:migrate`
- `pnpm --filter @ai-native-os/db db:seed`
- 启动 `web + api + jobs`
- 在浏览器访问 `/`，用默认管理员账号成功登录并进入后台

### Task 1.1: 定义“可登录默认主体”策略

- **Location**:
  - [packages/db/src/seed/rbac.ts](/Users/tao/work/ai/ai-native-os/packages/db/src/seed/rbac.ts)
  - [packages/auth/src/server.ts](/Users/tao/work/ai/ai-native-os/packages/auth/src/server.ts)
  - [apps/web/src/components/auth/sign-in-page.tsx](/Users/tao/work/ai/ai-native-os/apps/web/src/components/auth/sign-in-page.tsx)
- **Description**:
  - 确定默认账号初始化方案，优先级如下：
  - 方案 A：seed 时同时写入 Better Auth `user/account` 所需记录，并与现有 RBAC email 绑定。
  - 方案 B：提供一次性本地 bootstrap 脚本，在 `db:seed` 后自动创建默认 Better Auth 账号。
  - 不建议继续依赖“手工 `POST /api/auth/sign-up/email`”作为 fresh setup 标准流程。
- **Dependencies**: none
- **Acceptance Criteria**:
  - fresh database 初始化后至少存在 1 个可登录管理员账号
  - 该账号 email 与现有 RBAC `users` 记录稳定映射
  - 登录页不再要求操作者先知道“必须额外创建 Better Auth account”
- **Validation**:
  - 清空数据库后重新 migrate + seed
  - 直接从 web 登录，不再手工调用 auth sign-up API

### Task 1.2: 补齐本地环境模板与启动入口

- **Location**:
  - [.env.example](/Users/tao/work/ai/ai-native-os/.env.example)
  - [docs/environment-matrix.md](/Users/tao/work/ai/ai-native-os/docs/environment-matrix.md)
  - [docs/deployment-guide.md](/Users/tao/work/ai/ai-native-os/docs/deployment-guide.md)
  - [apps/jobs/package.json](/Users/tao/work/ai/ai-native-os/apps/jobs/package.json)
- **Description**:
  - 提供可直接用于本地开发的 env 模板，至少覆盖 `DATABASE_URL`、`REDIS_URL`、`APP_URL`、`API_URL`、`BETTER_AUTH_URL`、`BETTER_AUTH_SECRET`。
  - 明确区分“本地可运行最小变量”和“生产目标态变量”，避免部署文档继续把未接线变量写成必填。
  - 修正 `jobs` 的本地启动说明，强调健康检查依赖 `start`，不是当前的 `dev`。
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - 新同学只需要复制 env 模板并执行文档中的命令即可拉起系统
  - 文档中不再出现与真实运行时不一致的变量说明
  - `jobs` 的本地健康检查路径和启动命令文档一致
- **Validation**:
  - 用全新 shell 仅依赖模板 env 启动项目
  - `pnpm release:smoke` 通过

### Task 1.3: 固化默认账号与本地启动 smoke

- **Location**:
  - [packages/auth/src/smoke.ts](/Users/tao/work/ai/ai-native-os/packages/auth/src/smoke.ts)
  - [apps/api/src/index.test.ts](/Users/tao/work/ai/ai-native-os/apps/api/src/index.test.ts)
  - [apps/web/src/lib/shell.ts](/Users/tao/work/ai/ai-native-os/apps/web/src/lib/shell.ts)
- **Description**:
  - 把“默认账号可登录”纳入 smoke/test，而不是依赖人工经验。
  - 现有测试中如果还使用“先 sign-up 再验证”的路径，需要补一条 fresh seed 下的直接登录路径。
- **Dependencies**: Task 1.1, Task 1.2
- **Acceptance Criteria**:
  - CI 至少有一条测试覆盖“seed 后直接登录”
  - 登录失败提示文案与真实初始化流程一致
- **Validation**:
  - `pnpm test`
  - 定向跑 auth / login smoke

## Sprint 2: AI 主链路前置失败与能力收敛

**Goal**: AI Copilot、MCP、Workflow 的暴露能力与真实执行能力一致；缺密钥时尽早失败并明确降级。

**Demo/Validation**:

- 已配置 `OPENAI_API_KEY` 时，`ask_admin_copilot` 可成功返回文本
- 未配置 `OPENAI_API_KEY` 时，系统在启动或 discovery 阶段给出清晰状态，而不是执行时抛错
- `admin` 不再看到自己无法执行的 `run_report_schedule`

### Task 2.1: 增加 AI 密钥启动前检查与降级状态

- **Location**:
  - [apps/api/src/mastra/env.ts](/Users/tao/work/ai/ai-native-os/apps/api/src/mastra/env.ts)
  - [apps/api/src/mastra/rag/embeddings.ts](/Users/tao/work/ai/ai-native-os/apps/api/src/mastra/rag/embeddings.ts)
  - [docs/environment-matrix.md](/Users/tao/work/ai/ai-native-os/docs/environment-matrix.md)
- **Description**:
  - 把 `OPENAI_API_KEY` 的要求从“运行时调用失败”前移到“启动时能力判定”。
  - 为 AI runtime 定义明确状态：
    - enabled: 可真实调用远程模型
    - degraded: 基础 API 在线，但 Copilot/remote embedding 不可用
  - 健康检查或 runtime summary 需要暴露这个状态。
- **Dependencies**: none
- **Acceptance Criteria**:
  - 没有 `OPENAI_API_KEY` 时，`ask_admin_copilot` 不会继续以“可用工具”身份暴露
  - 健康检查、runtime summary 或文档能明确指出当前是 degraded
  - 有 key 时主链路恢复正常
- **Validation**:
  - 分别在有/无 `OPENAI_API_KEY` 两种环境下跑 AI smoke
  - 校验 `/mastra/*` summary 与实际行为一致

### Task 2.2: 修复 MCP discovery 与 workflow 权限漂移

- **Location**:
  - [apps/api/src/mastra/mcp/server.ts](/Users/tao/work/ai/ai-native-os/apps/api/src/mastra/mcp/server.ts)
  - [apps/api/src/mastra/tools/index.ts](/Users/tao/work/ai/ai-native-os/apps/api/src/mastra/tools/index.ts)
  - [apps/api/src/mastra/workflows/report-schedule.ts](/Users/tao/work/ai/ai-native-os/apps/api/src/mastra/workflows/report-schedule.ts)
  - [apps/api/src/mastra/mcp/integration.test.ts](/Users/tao/work/ai/ai-native-os/apps/api/src/mastra/mcp/integration.test.ts)
- **Description**:
  - 让 MCP wrapper tool 的注册逻辑使用与 direct tool 相同的 ability 过滤机制。
  - `run_report_schedule` 是否暴露，必须由 `export:Report` 能力决定，而不是写死在 wrapper 列表中。
  - runtime summary、enabled tool catalog、MCP tools 列表三者必须统一。
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `admin` discovery 结果中不再出现 `run_report_schedule`
  - `editor` 或具备 `export:Report` 的主体仍能看到并执行 `run_report_schedule`
  - MCP integration test 覆盖“看得到就能执行；不能执行就不暴露”
- **Validation**:
  - 以 `admin`、`editor`、`super_admin` 三种主体分别跑 MCP discovery + execution
  - 校验 AI audit 仍然完整写入

### Task 2.3: 对齐 Agent/Workflow 能力说明

- **Location**:
  - [docs/ai-agent-design.md](/Users/tao/work/ai/ai-native-os/docs/ai-agent-design.md)
  - [docs/architecture.md](/Users/tao/work/ai/ai-native-os/docs/architecture.md)
  - [apps/api/src/mastra/mcp/server.ts](/Users/tao/work/ai/ai-native-os/apps/api/src/mastra/mcp/server.ts)
- **Description**:
  - 把文档中的能力暴露逻辑更新为“按主体能力动态过滤”，避免实现与设计文档继续漂移。
  - 明确说明 agent、tool、workflow 三种入口都必须遵守同一权限与审计规则。
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - 文档与运行时行为一致
  - 不再出现“文档声称可用，但实际 RBAC 拒绝”的主链路
- **Validation**:
  - 以文档为脚本重新跑一轮 MCP / workflow smoke

## Sprint 3: 本地自托管与文件存储边界收敛

**Goal**: 本地与自托管文档只描述真实支持的能力；若宣称支持本地文件存储，则必须真正接线。

**Demo/Validation**:

- 文档只保留真实可运行的存储方案
- 或者本地文件存储具备最小上传/读取闭环

### Task 3.1: 决策文件存储策略

- **Location**:
  - [docs/deployment-guide.md](/Users/tao/work/ai/ai-native-os/docs/deployment-guide.md)
  - [docs/environment-matrix.md](/Users/tao/work/ai/ai-native-os/docs/environment-matrix.md)
  - [apps/worker/src](/Users/tao/work/ai/ai-native-os/apps/worker/src)
  - [apps/api/src](/Users/tao/work/ai/ai-native-os/apps/api/src)
- **Description**:
  - 二选一，不要继续维持“文档已承诺、代码未实现”的状态：
  - 方案 A：删除 `LOCAL_STORAGE_PATH` 相关表述，把当前能力收敛到 R2 / 目标态存储。
  - 方案 B：实现最小本地文件存储 adapter，并接到当前真实使用的文件入口。
  - 如果短期目标是尽快恢复可验证性，优先选方案 A。
- **Dependencies**: none
- **Acceptance Criteria**:
  - 文档描述与代码真实能力一致
  - 不再出现“本地替代方案”只有文档没有实现的情况
- **Validation**:
  - 文档审阅 + 代码搜索 + 对应 smoke

### Task 3.2: 若保留本地文件存储，则补最小闭环测试

- **Location**:
  - 实际文件入口所在模块
  - 与之对应的 API / worker / 测试文件
- **Description**:
  - 只有在决定保留 `LOCAL_STORAGE_PATH` 方案时才执行。
  - 最小要求是：可写入、可读取、路径受控、权限不越界。
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - 本地文件存储有真实测试覆盖
  - 不绕过现有鉴权与审计边界
- **Validation**:
  - 单元测试 + smoke

## Sprint 4: 发布与健康检查可信度提升

**Goal**: `release:smoke` 和健康检查结果能真实反映系统状态，而不是把关键能力缺失隐藏成“unknown”。

**Demo/Validation**:

- `release:smoke` 输出能够区分：
  - 核心服务正常
  - 可选 telemetry 未配置
  - AI runtime degraded

### Task 4.1: 健康检查分层建模

- **Location**:
  - [apps/api/src/index.ts](/Users/tao/work/ai/ai-native-os/apps/api/src/index.ts)
  - [docs/release-playbook.md](/Users/tao/work/ai/ai-native-os/docs/release-playbook.md)
  - release smoke 脚本对应文件
- **Description**:
  - 把健康检查拆成至少三层：
  - liveness: 进程在线
  - readiness: 数据库、Redis、鉴权、核心 API 在线
  - capability: telemetry / AI / external platform 是否 ready
  - 这样 `OPENAI_API_KEY` 缺失不会被误认为整个 API 正常可用。
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - 健康检查响应中能分辨核心可用与能力降级
  - `release:smoke` 汇总输出可直接用于发布决策
- **Validation**:
  - 有/无外部密钥两种环境分别跑 smoke

### Task 4.2: 建立最终 E2E 回归脚本

- **Location**:
  - root scripts
  - [Status.md](/Users/tao/work/ai/ai-native-os/Status.md)
  - 新增或现有 smoke 文档
- **Description**:
  - 把这次人工验证流程固化成一条可重复执行的回归脚本，至少覆盖：
  - migrate
  - seed
  - 默认账号登录
  - viewer/admin/super_admin 权限检查
  - MCP direct tool
  - workflow 执行
  - AI audit 查询
  - build 与 release smoke
  - `Status.md` 需要把“Phase 6 complete”修正为“仓库实现完成，但 E2E 修复计划进行中”，直到这条回归脚本通过。
- **Dependencies**: Sprint 1, Sprint 2, Sprint 3, Task 4.1
- **Acceptance Criteria**:
  - 新环境能一键或半自动完成全链路验证
  - 当前发现的 4 类问题都有对应自动化校验
- **Validation**:
  - 在干净数据库与干净 shell 环境下完整跑一遍

## Testing Strategy

- 静态检查：
  - `pnpm lint`
  - `pnpm typecheck`
- 核心回归：
  - `pnpm test`
  - `pnpm build`
  - `pnpm release:smoke`
- 定向 E2E：
  - fresh migrate + seed
  - 默认管理员直接登录
  - `viewer/admin/super_admin/editor` 四类主体权限回归
  - MCP discovery / direct tool / workflow 执行与 AI audit 对账
- 文档回归：
  - `.env.example`
  - `docs/environment-matrix.md`
  - `docs/deployment-guide.md`
  - `docs/release-playbook.md`

## Priority Order

1. Sprint 1
2. Sprint 2
3. Sprint 4.1
4. Sprint 3
5. Sprint 4.2

说明：

- Sprint 1 解决“能不能进系统”的根阻塞。
- Sprint 2 解决“AI 看起来能用，但实际跑不动”的高风险契约问题。
- Sprint 4.1 解决“健康检查报喜不报忧”的发布误判问题。
- Sprint 3 属于边界收敛，但不应早于主链路闭环。
- Sprint 4.2 用于把修复结果固化成长期回归能力。

## Potential Risks & Gotchas

- Better Auth 默认账号 seed 如果直接写底层表，必须确认与 Better Auth 当前 schema、密码哈希、account/provider 约束一致；否则建议走受控 bootstrap API 或脚本。
- 不能为了让 `admin` 看到 `run_report_schedule` 就放宽 workflow 所需权限；正确做法是收缩 discovery，不是削弱 RBAC。
- `OPENAI_API_KEY` 前置检查不能把整个 `/mastra/*` 路由直接打死，否则会影响非 LLM tool 与 runtime metadata。
- 如果选择实现本地文件存储 adapter，范围很容易扩张；没有明确业务入口时应优先删文档承诺。
- `Status.md` 当前声明“Phase 6 complete”，与实测存在偏差；若不修正，会继续误导后续线程。

## Rollback Plan

- 所有修复按主题拆分提交：
  - auth bootstrap
  - env/docs alignment
  - mastra capability filtering
  - health/release smoke refinement
- 若某项修复引发回归，可独立回滚对应提交，不影响其他链路。
- 在回滚后仍需保留最新 E2E 失败记录，避免状态文件继续报绿。
