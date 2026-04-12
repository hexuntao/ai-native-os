# AI Native OS Web UI Design Contract

## 1. 目标

为 `apps/web` 建立统一的控制台 UI 契约，避免后续页面继续沿用“展示型卡片首页”而不是“可操作工作台”。

本设计契约服务于三类任务：

- 后台管理：`system/*`
- 运行监控：`monitor/*`
- AI 治理与工作台：`ai/*`、`reports`

## 2. 视觉定位

- 产品类型：AI Ops Console / Governance Workbench
- 气质关键词：precise, quiet, dense, trustworthy, operator-first
- 视觉基调：`light-first` 中性浅色控制台，不使用偏暖的大面积 editorial 背景
- 品牌强调：仅保留一条明确主强调色，用于动作、焦点、当前模块和可执行状态

不采用：

- 大面积暖色渐变
- 首页式 hero 大横幅
- 每个后台页面都重复“宣传型描述”
- 固定三栏同权重布局

## 3. 页面架构

### 3.1 应用壳层

所有已登录页面统一使用四层结构：

1. 左侧导航栏
2. 顶部上下文栏
3. 主工作区
4. 右侧助手工作台（可折叠）

要求：

- 左侧导航负责模块切换与身份摘要
- 顶部上下文栏负责显示当前模块、页面说明、当前主体和辅助操作
- 主工作区优先展示“当前任务”，而不是大段说明
- Copilot 作为上下文助手，不与主内容争抢首屏

### 3.2 页面类型

#### Directory Page

适用于：

- `system/users`
- `system/roles`
- `system/permissions`
- `system/menus`

结构：

- 紧凑 header
- filter / search toolbar
- primary action
- data table
- row actions / modal / drawer form

#### Observability Page

适用于：

- `monitor/server`
- `monitor/online`
- `system/logs`

结构：

- status strip
- critical summary cards
- diagnostics blocks
- timeline / list / table

#### AI Governance Page

适用于：

- `ai/prompts`
- `ai/evals`
- `ai/audit`
- `ai/feedback`

结构：

- governance summary
- policy / evidence / audit split panels
- timeline / compare / detail surfaces

#### AI Workbench Page

适用于：

- `ai/knowledge`
- `reports`

结构：

- task summary
- primary work area
- contextual assistant / generated insight area

## 4. 设计令牌

### 4.1 色彩

- 背景：冷中性浅灰
- Panel：比背景略亮，边框清晰
- 主强调色：单一琥珀橙，用于 CTA 和焦点
- 状态色：
  - success：green
  - warning：amber
  - danger：red
  - muted：slate

### 4.2 字体

- 主体：现代无衬线
- 数据、ID、日志：等宽字体
- 不在 dashboard 使用大面积衬线标题

### 4.3 密度

- 首屏优先“能操作”
- 描述文案不超过两段
- 指标卡为辅助信息，不抢主流程
- 表格与表单优先使用 12-14px 的高密度后台样式

## 5. 交互规则

- 所有页面必须覆盖 loading / empty / error / unauthorized 状态
- 表单默认采用分步最少、动作明确的后台交互
- 破坏性操作必须明显区分
- Copilot 默认视为“辅助工作区”，不是“全局主界面”

## 6. 实施顺序

### UI-C1

- 全局 tokens
- app shell
- login shell
- compact data-surface baseline

### UI-C2

- `system/*` 目录类页面：toolbar、table、drawer/modal 规范化

### UI-C3

- `monitor/*` 与 `system/logs`：监控型页面重构

### UI-C4

- `ai/*`：治理型页面和工作台页面拆分重构

### UI-C5

- Copilot interaction model：折叠、固定、上下文建议、页面联动
