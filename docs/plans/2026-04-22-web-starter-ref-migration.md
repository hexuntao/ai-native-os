# 2026-04-22 Web Starter Ref Migration Baseline

## Goal

建立一个与 `next-shadcn-dashboard-starter` 壳层结构高度一致、但不影响现有 `apps/web` 的隔离参考应用，作为后续 AI-native web 迁移基线。

应用路径：`apps/web-starter-ref`

## What Was Created

- 新建独立 Next.js workspace package：`@ai-native-os/web-starter-ref`
- 保留 starter 风格的壳层结构：
  - `src/app/dashboard/layout.tsx`
  - `src/components/layout/app-sidebar.tsx`
  - `src/components/layout/header.tsx`
  - `src/components/layout/info-sidebar.tsx`
  - `src/components/ui/sidebar.tsx`
- 删除 starter 模板产品示例，只保留 AI-native 迁移占位页：
  - `/dashboard/home`
  - `/dashboard/build/prompts`
  - `/dashboard/observe/runs`
  - `/dashboard/observe/monitor`
  - `/dashboard/improve/evals`
  - `/dashboard/knowledge/collections`
  - `/dashboard/govern/approvals`
  - `/dashboard/govern/audit`
  - `/dashboard/workspace/reports`
  - `/dashboard/admin/users`
  - `/dashboard/admin/roles`
  - `/dashboard/admin/permissions`

## Current Shell Contract

当前参考应用已经对齐 starter 的核心布局范式：

- `SidebarProvider -> AppSidebar -> SidebarInset -> Header -> content -> InfoSidebar`
- 左侧为 starter 风格 sidebar/rail
- 顶部为 starter 风格 header + breadcrumb + action/search 区
- 右侧为独立 info sidebar
- 页面内容区使用独立 `PageContainer`

## What Was Intentionally Deferred

以下能力没有接入到 `apps/web-starter-ref`，这是刻意控制范围：

- Better Auth
- RBAC ability 过滤
- CopilotKit / AG-UI
- 真实 API loaders / actions
- 旧 `apps/web` 的完整业务页面

也就是说，它当前是一个“壳层迁移基线”，不是第二个正式产品应用。

## Validation

已验证通过：

- `pnpm --filter @ai-native-os/web-starter-ref lint`
- `pnpm --filter @ai-native-os/web-starter-ref test`
- `pnpm --filter @ai-native-os/web-starter-ref typecheck`
- `pnpm --filter @ai-native-os/web-starter-ref build`

## Recommended Next Migration Order

建议按下面顺序把现有 `apps/web` 能力迁入这个参考壳层：

1. 接入全局 providers
   - theme
   - auth session
   - ability / navigation filtering
2. 迁入真实首页
   - `home` AI operations center
3. 迁入两个关键工作台
   - `observe/runs`
   - `govern/approvals`
4. 迁入 route-aware copilot/context rail
5. 完成旧 `apps/web` 与 `apps/web-starter-ref` 的差异收敛后，再决定是否替换正式 web 应用

## Decision Record

这次不直接替换 `apps/web`，而是先建隔离参考应用，原因是：

- 避免一次性打散现有 auth / RBAC / Copilot / audited write 路径
- 允许先验证 starter 壳层是否真的满足视觉预期
- 允许后续以页面为单位迁移，而不是一次性重建整个 web 端
