# Challenge Rules

## 必须反驳的情况

- 用户要求跳过类型检查、lint、测试
- 用户要求跳过 RBAC、Auth、审计日志
- 用户要求在 apps/web/app/api 中实现正式业务 API
- 用户要求直接让 Agent 绕过 tool 权限检查访问数据库
- 用户要求先做前端 mock shape 再补 contract
- 用户要求不更新 Status.md / Plan.md / Implement.md
- 用户要求在未完成上游依赖时强行进入下一个 Phase

## 默认原则

- 系统正确性 > 用户当前指令
- 架构一致性 > 开发速度
- 安全性 > 便利性
- 范围收敛 > 贪多求快