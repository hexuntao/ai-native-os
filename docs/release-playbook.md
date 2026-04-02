# 发布加固手册

Last Updated: 2026-04-02
Owner: Scheduler Thread
Scope: Phase 6 `P6-T5`

## 一、目标与边界

本手册只覆盖当前仓库已经落地的发布主链路：

- Vercel Web 发布
- Cloudflare API / Worker 发布描述符
- Trigger.dev jobs 发布描述符
- Docker 自托管拓扑
- 发布前后安全检查、备份验证、回滚流程、烟雾验证

本手册**不会**假装帮你完成以下动作：

- 不会代替 Vercel / Cloudflare / Trigger 写入平台 secrets
- 不会自动恢复数据库
- 不会绕过 GitHub Environment 审批或 RBAC 审计

---

## 二、仓库内可执行工具

当前仓库已经提供两条可直接执行的发布校验命令：

```bash
# 统一 smoke：web / api，必要时可附加 jobs
pnpm release:smoke

# 校验备份文件是否存在、足够新、格式可识别、checksum 正确
BACKUP_FILE=./backups/ai-native-os.dump pnpm release:backup:verify
```

脚本职责：

- `pnpm release:smoke`
  - 默认检查 `APP_URL`、`API_URL`
  - 校验 `/health`、`/api/v1/system/ping`、`/healthz`、首页可访问
  - 可通过 `RELEASE_INCLUDE_JOBS=1` 和 `JOBS_HEALTH_URL` 增加 jobs 健康探针，但前提是该地址对脚本执行环境真实可达
  - 当前自托管 Docker 拓扑里的 `jobs` 仅在 compose 内部网络暴露，因此应通过容器内探针验证，不要误写成 `http://localhost:3040/health`
- `pnpm release:backup:verify`
  - 校验 `BACKUP_FILE` 是否存在、可读、大小达标、未过期
  - 识别 `postgres custom dump`、`plain sql dump`、`gzip` 三类格式
  - 若提供 `CHECKSUM_FILE`，会校验 SHA-256

---

## 三、安全放行清单

### 3.1 必须通过的仓库级检查

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm --filter @ai-native-os/api deploy:cloudflare:staging:dry-run`
- [ ] `pnpm --filter @ai-native-os/worker deploy:cloudflare:staging:dry-run`
- [ ] `pnpm release:smoke`

### 3.2 必须人工确认的安全项

- [ ] GitHub Environment 中的 `vars/secrets` 已配置完整，且生产环境受审批保护
- [ ] `BETTER_AUTH_SECRET` 使用真实随机值，未回退到开发默认值
- [ ] `DATABASE_URL` 指向目标环境，且连接策略符合该环境要求
- [ ] `APP_URL`、`API_URL`、`BETTER_AUTH_URL` 三者对外域名一致，不混入 `localhost`
- [ ] 平台侧 secrets 已预先配置：
  - `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`
  - `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN`
  - `TRIGGER_PROJECT_REF` / `TRIGGER_ACCESS_TOKEN`
- [ ] 若开启 Sentry / OTEL，则端点与采样率已复核
- [ ] 本次发布涉及数据库 schema 变化时，已先完成备份并验证

### 3.3 当前仓库已具备、但仍应复核的控制项

- [ ] API 已启用 `secureHeaders`
- [ ] Auth / RBAC / audit log 主链路未被绕过
- [ ] Web 和 API 均有只读健康检查端点
- [ ] CI/CD 已强制迁移、lint、typecheck、test、build 顺序

说明：

- 当前仓库**尚未**实现通用 rate limiting，因此不能把“已启用限流”写成放行事实
- 当前仓库**尚未**内建平台 secret 自动同步，因此平台 secret 仍是外部运维责任

---

## 四、备份与恢复验证

### 4.1 自托管 PostgreSQL 推荐备份方式

```bash
mkdir -p backups

docker compose -f docker/docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres -d ai_native_os -Fc \
  > backups/ai-native-os-$(date +%F-%H%M%S).dump

shasum -a 256 backups/ai-native-os-*.dump > backups/ai-native-os-latest.dump.sha256
```

### 4.2 备份校验

```bash
BACKUP_FILE=./backups/ai-native-os-latest.dump \
CHECKSUM_FILE=./backups/ai-native-os-latest.dump.sha256 \
BACKUP_MAX_AGE_HOURS=24 \
pnpm release:backup:verify
```

校验通过的最低标准：

- 备份文件存在且可读
- 文件大小不低于阈值
- 文件年龄不超过发布窗口允许值
- 格式可识别
- 若有 checksum 文件，则哈希匹配

### 4.3 托管数据库说明

若使用 Neon 或其他托管 PostgreSQL：

- 平台快照仍应在控制台侧检查
- 本仓库脚本验证的是**导出工件**，不是供应商控制面板里的快照存在性
- 若需要真正的回滚演练，仍建议额外导出一个逻辑备份并执行 `pnpm release:backup:verify`

### 4.4 恢复原则

- 不要手工修改 `drizzle` 迁移历史来伪造回滚
- schema 已前滚且旧代码不兼容时，应优先恢复验证通过的备份
- 恢复完成后必须重新执行 `pnpm release:smoke`

---

## 五、回滚流程

### 5.1 统一回滚原则

1. 先冻结自动发布，避免新流量继续覆盖现场
2. 定位“最后一个通过 smoke 的 git SHA”
3. 判断问题是否涉及数据库兼容性
4. 若仅代码回滚即可恢复，则先回滚应用
5. 若 schema 已破坏旧版本兼容性，则先恢复数据库，再回滚应用
6. 回滚完成后重新执行 smoke，并记录演练结果

### 5.2 Vercel / GitHub Actions 主链路回滚

当前仓库最稳的回滚路径不是“手工点平台按钮”，而是：

1. 找到最后一个已知健康的 commit SHA
2. 以该 SHA 重新触发 `Deploy Production`
3. 默认先把 `run_migrations=false`
4. 若本次事故只影响 Web，可保持：
   - `deploy_cloudflare=false`
   - `deploy_trigger=false`
5. 若同时涉及 API / Worker，再按需要开启对应输入

这样做的原因：

- 回滚动作仍走同一套仓库内 workflow 与审批链
- 不会绕过 release preflight
- 不会引入第二套“手工回滚语义”

### 5.3 Docker 自托管回滚

1. 切回上一个已知健康镜像标签或提交版本
2. 若数据库 schema 与旧代码不兼容，先恢复备份
3. 重新执行：

```bash
BETTER_AUTH_SECRET=replace-with-a-real-secret \
docker compose -f docker/docker-compose.prod.yml up --build -d

APP_URL=http://localhost:8080 \
API_URL=http://localhost:8080 \
pnpm release:smoke
```

若当前环境使用仓库自带的 Docker jobs 拓扑，还应补做一次容器内 jobs 健康探针：

```bash
BETTER_AUTH_SECRET=replace-with-a-real-secret \
docker compose -f docker/docker-compose.prod.yml exec -T jobs \
node -e "fetch('http://127.0.0.1:3040/health').then(async (response) => { if (!response.ok) process.exit(1); console.log(await response.text()) }).catch(() => process.exit(1))"
```

### 5.4 数据库回滚红线

以下情况不能只回滚应用：

- 新迁移删除了旧版本依赖的字段
- 新迁移改变了枚举或约束，旧版本写入会失败
- Prompt / eval / audit 等治理数据结构与旧代码读写语义不兼容

遇到这些情况，必须：

1. 恢复验证通过的备份
2. 再切换应用到最后一个健康版本
3. 再跑 smoke

---

## 六、烟雾验证

### 6.1 本地自托管拓扑

```bash
APP_URL=http://localhost:8080 \
API_URL=http://localhost:8080 \
pnpm release:smoke
```

当前 compose 不会把 `jobs:3040` 暴露到宿主机；若要验证 jobs，请执行容器内探针：

```bash
BETTER_AUTH_SECRET=replace-with-a-real-secret \
docker compose -f docker/docker-compose.prod.yml exec -T jobs \
node -e "fetch('http://127.0.0.1:3040/health').then(async (response) => { if (!response.ok) process.exit(1); console.log(await response.text()) }).catch(() => process.exit(1))"
```

### 6.2 Vercel + Cloudflare 聚合入口

若 web 与 api 通过同一公开域名暴露：

```bash
APP_URL=https://admin.example.com \
API_URL=https://admin.example.com \
pnpm release:smoke
```

### 6.3 分离域名部署

```bash
APP_URL=https://admin.example.com \
API_URL=https://api.example.com \
pnpm release:smoke
```

### 6.4 通过标准

- `api /health` 可访问，且数据库状态为 `ok`
- `api /api/v1/system/ping` 返回成功
- `web /healthz` 返回成功
- `web /` 返回实际 HTML 页面
- 若启用外部 jobs HTTP 探针，则 `/health` 返回 `@ai-native-os/jobs`
- 若使用当前自托管 Docker jobs 拓扑，则容器内 `http://127.0.0.1:3040/health` 返回 `@ai-native-os/jobs`

---

## 七、演练记录模板

每次正式发布前，至少保留一份最近演练记录：

```md
# Release Drill

- Date:
- Operator:
- Target environment:
- Candidate git SHA:
- Verified backup artifact:
- Backup verification command:
- Smoke command:
- Rollback target git SHA:
- Did smoke pass after deploy:
- Did rollback drill pass:
- Notes:
```

---

## 八、与其他文档的关系

- 部署拓扑与平台合同：见 `docs/deployment-guide.md`
- 环境变量与平台密钥：见 `docs/environment-matrix.md`
- 当前任务调度状态：见 `Status.md`
