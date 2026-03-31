# AI Native OS Scheduler Status

Last Updated: 2026-04-01
Current Mode: Phase 1 completed, Phase 2 ready
Current Phase: Phase 2 `Auth + RBAC`
Overall Status: `ready_to_execute`

## 1. Repository Snapshot

- Present in repository:
  - `AGENTS.md`
  - `docs/architecture.md`
  - `docs/ai-agent-design.md`
  - `docs/rbac-design.md`
  - `docs/api-conventions.md`
  - `docs/deployment-guide.md`
  - `Plan.md`
  - `Implement.md`
  - `Status.md`
  - root workspace manifests
  - `apps/*`
  - `packages/*`
  - `docker/docker-compose.yml`
- Not yet present:
  - CI workflows
  - production deployment files
  - auth and RBAC implementation code
  - AI runtime code

## 2. Phase Summary

| Phase | Name | Status | Exit Condition |
|---|---|---|---|
| 1 | Foundation Infrastructure | done | Monorepo, db/shared/api skeleton, local infra available |
| 2 | Auth + RBAC | ready | Better Auth + CASL + seed roles + minimal auth shell |
| 3 | AI Core | backlog | Mastra + tools + workflows + MCP + RAG |
| 4 | Web UI | backlog | Dashboard + system pages + CopilotKit + generative UI |
| 5 | Observability | backlog | Audit + telemetry + evals + feedback + prompt governance |
| 6 | Deployment | backlog | Docker/Cloudflare/Vercel/CI-CD + rollback readiness |

## 3. Task Ledger

| Task ID | Phase | Task | Status | Dependencies | Validation |
|---|---|---|---|---|---|
| P1-T1 | 1 | Create root monorepo scaffold | done | none | workspace bootstrap smoke |
| P1-T2 | 1 | Create app and package skeleton directories | done | P1-T1 | workspace package discovery |
| P1-T3 | 1 | Define Drizzle base schema and migration pipeline | done | P1-T2 | db generate + migrate |
| P1-T4 | 1 | Define shared Zod schemas, constants, and CASL ability core | done | P1-T2 | shared typecheck |
| P1-T5 | 1 | Build Hono + oRPC + Scalar API skeleton | done | P1-T3, P1-T4 | API boot + docs + health |
| P1-T6 | 1 | Add local dev infrastructure for database and cache | done | P1-T1 | Docker service smoke |
| P2-T1 | 2 | Implement Better Auth server and client configuration | ready | P1-T5 | login/session smoke |
| P2-T2 | 2 | Integrate auth middleware into Hono and expose auth routes | backlog | P2-T1 | 401/auth route smoke |
| P2-T3 | 2 | Implement RBAC tables, seeds, and permission-loading service | ready | P1-T3 | seed and lookup verification |
| P2-T4 | 2 | Implement CASL ability builder and permission middleware | backlog | P2-T2, P2-T3 | 403/condition verification |
| P2-T5 | 2 | Expose permission query endpoints and serialized ability payload | backlog | P2-T4 | ability fetch and deserialize |
| P2-T6 | 2 | Build minimal auth shell and permission provider in web app | backlog | P2-T1, P2-T5 | protected layout smoke |
| P3-T1 | 3 | Integrate Mastra with Hono and register core runtime | backlog | P2-T4 | Mastra mount smoke |
| P3-T2 | 3 | Build core agent tool framework with RBAC and audit enforcement | backlog | P2-T4, P3-T1 | tool schema + audit verification |
| P3-T3 | 3 | Implement initial agents | backlog | P3-T2 | agent generation smoke |
| P3-T4 | 3 | Implement AI workflows and Trigger.dev task orchestration | backlog | P3-T1, P3-T2 | workflow/task smoke |
| P3-T5 | 3 | Implement CopilotKit and AG-UI backend bridge | backlog | P3-T1, P3-T3 | streaming endpoint smoke |
| P3-T6 | 3 | Implement pgvector-backed RAG indexing and retrieval | backlog | P1-T3, P3-T1 | index + semantic query smoke |
| P3-T7 | 3 | Implement MCP server and external MCP client integration | backlog | P3-T2, P3-T3 | MCP discovery smoke |
| P4-T1 | 4 | Build Next.js app shell, global providers, and dashboard layout | backlog | P2-T6 | authenticated shell smoke |
| P4-T2 | 4 | Establish shared UI primitives and shadcn-based component baseline | backlog | P1-T2 | package/ui build smoke |
| P4-T3 | 4 | Implement system management pages | backlog | P4-T1, P4-T2, Phase 2 | CRUD page smoke |
| P4-T4 | 4 | Implement monitor and AI management pages | backlog | P4-T1, P4-T2, P3-T6 | monitor and AI page smoke |
| P4-T5 | 4 | Integrate CopilotKit sidebar and assistant-style chat UX | backlog | P3-T5, P4-T1 | chat stream smoke |
| P4-T6 | 4 | Implement generative UI components | backlog | P4-T5 | action render smoke |
| P5-T1 | 5 | Implement operation log and AI audit log pipelines end-to-end | backlog | Phase 2, Phase 3 | log trace verification |
| P5-T2 | 5 | Add Sentry, OpenTelemetry, request IDs, and health checks | backlog | P1-T5 | telemetry + health smoke |
| P5-T3 | 5 | Implement AI feedback capture and human override tracking | backlog | P3-T4, P4-T5 | feedback persistence smoke |
| P5-T4 | 5 | Implement Mastra Evals datasets, scorers, and runners | backlog | P3-T3, P3-T4 | eval run result verification |
| P5-T5 | 5 | Implement prompt versioning and release gates for AI changes | backlog | P5-T4 | version activate/rollback verification |
| P6-T1 | 6 | Finalize environment matrix and secret contract | backlog | Phase 3 | env-only boot verification |
| P6-T2 | 6 | Implement Docker packaging and self-hosted runtime topology | backlog | Phase 1, Phase 3 | Docker smoke deploy |
| P6-T3 | 6 | Implement Vercel, Cloudflare, and Trigger deployment configs | backlog | Phase 3, Phase 4 | staging deploy smoke |
| P6-T4 | 6 | Implement GitHub Actions CI/CD workflows | backlog | P6-T1, P6-T2, P6-T3 | CI and deploy workflow verification |
| P6-T5 | 6 | Complete security, backup, rollback, and smoke-check playbooks | backlog | P6-T2, P6-T4, P5-T2 | release-readiness review |

## 4. Current Ready Queue

Priority order as of 2026-04-01:

1. P2-T1 Implement Better Auth server and client configuration
2. P2-T3 Implement RBAC tables, seeds, and permission-loading service

Auto-unlock rules:

- If P2-T1 -> `done`
  - keep P2-T2 eligible once auth route contract is defined
- If P2-T3 -> `done`
  - keep P2-T4 blocked until P2-T2 is also `done`
- If P2-T1 and P2-T3 both -> `done`
  - current main-thread priority remains P2-T2

## 5. Phase 1 Execution Checklist

Phase 1 outcome:

- Completed artifacts:
  - root workspace manifests and TypeScript/Biome baseline
  - all app/package skeleton directories and manifests
  - Drizzle config, schema, migrations, and runtime migrator
  - shared schema and CASL ability core
  - Hono API entry, oRPC route, OpenAPI JSON, Scalar docs, health route
  - local Docker dev stack for PostgreSQL and Redis on `5433/6380`

Phase 1 QA executed:

- `pnpm install`
- `pnpm format`
- `pnpm lint`
- `pnpm typecheck`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:generate`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:migrate`
- `curl -sS http://localhost:3001/health`
- `curl -sS http://localhost:3001/api/openapi.json`
- `curl -sS http://localhost:3001/api/v1/system/ping`
- `curl -I -sS http://localhost:3001/api/docs`

## 6. Blockers

Known current blockers:

- Better Auth package and route integration are not implemented yet.
- RBAC persistence exists at schema level, but seeds and permission-loading service are not implemented yet.
- The API health route currently reports Redis as `unknown`; Redis runtime wiring is a Phase 2+ follow-up.

Blocker resolution order:

1. P2-T1
2. P2-T3
3. P2-T2
4. P2-T4
5. P2-T5 and P2-T6

## 7. QA Recording Template

Use this section format after every task execution:

```md
### <Task ID> <Task Name>
- Status: done | failed
- Changed files:
  - <path>
- Commands:
  - <command>
- Result:
  - <pass/fail summary>
- Unlocked tasks:
  - <task id>
- Notes:
  - <risk, blocker, or follow-up>
```

## 8. Scheduler Notes

- This status file is the single source of truth for execution state.
- No task should start unless it is explicitly marked `ready`.
- No phase should advance unless its DoD from `Plan.md` is satisfied.
- If any QA gate fails, update this file before attempting the fix.

## 9. Execution Records

### P1-T1 Create root monorepo scaffold
- Status: done
- Changed files:
  - `package.json`
  - `pnpm-workspace.yaml`
  - `turbo.json`
  - `tsconfig.base.json`
  - `tsconfig.json`
  - `biome.json`
  - `.gitignore`
  - `.env.example`
- Commands:
  - `pnpm install`
- Result:
  - Root workspace bootstrapped successfully and pnpm workspace resolution works.
- Unlocked tasks:
  - `P1-T2`
  - `P1-T6`
- Notes:
  - Added `infra:up` and `infra:down` scripts to support Phase 1 local infrastructure validation.

### P1-T2 Create app and package skeleton directories
- Status: done
- Changed files:
  - `apps/web/*`
  - `apps/api/*`
  - `apps/worker/*`
  - `apps/jobs/*`
  - `packages/db/*`
  - `packages/shared/*`
  - `packages/ui/*`
  - `packages/auth/*`
- Commands:
  - `pnpm format`
  - `pnpm lint`
  - `pnpm typecheck`
- Result:
  - All workspace packages are discoverable by Turbo and pass lint/typecheck as a monorepo skeleton.
- Unlocked tasks:
  - `P1-T3`
  - `P1-T4`
- Notes:
  - Placeholder packages were kept minimal and type-safe to avoid premature framework implementation.

### P1-T6 Add local dev infrastructure for database and cache
- Status: done
- Changed files:
  - `docker/docker-compose.yml`
  - `.env.example`
- Commands:
  - `docker compose -f docker/docker-compose.yml up -d`
  - `docker ps --format '{{.Names}} {{.Status}} {{.Ports}}' | rg 'ai-native-os'`
- Result:
  - Local PostgreSQL and Redis dev services boot successfully on ports `5433` and `6380`.
- Unlocked tasks:
  - none
- Notes:
  - Dev ports were shifted off `5432/6379` to avoid collisions with pre-existing local containers.

### P1-T3 Define Drizzle base schema and migration pipeline
- Status: done
- Changed files:
  - `packages/db/drizzle.config.ts`
  - `packages/db/src/schema/*`
  - `packages/db/src/index.ts`
  - `packages/db/src/migrate.ts`
  - `packages/db/src/migrations/*`
- Commands:
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:generate`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:migrate`
  - `docker exec ai-native-os-postgres psql -U postgres -d ai_native_os -c "\\dt"`
  - `docker exec ai-native-os-postgres psql -U postgres -d ai_native_os -c "select * from drizzle.__drizzle_migrations;"`
- Result:
  - Drizzle schema generates SQL and applies migrations successfully against the local PostgreSQL container.
- Unlocked tasks:
  - none
- Notes:
  - Replaced the failing `drizzle-kit migrate` CLI step with the official `drizzle-orm/node-postgres` migrator while preserving Drizzle-generated SQL migrations.

### P1-T4 Define shared Zod schemas, constants, and CASL ability core
- Status: done
- Changed files:
  - `packages/shared/src/abilities/*`
  - `packages/shared/src/constants/*`
  - `packages/shared/src/schemas/*`
  - `packages/shared/src/types/*`
  - `packages/shared/src/index.ts`
- Commands:
  - `pnpm --filter @ai-native-os/shared typecheck`
  - `pnpm lint`
  - `pnpm typecheck`
- Result:
  - Shared package exports schemas, constants, and CASL ability primitives with strict TypeScript passing.
- Unlocked tasks:
  - none
- Notes:
  - CASL condition typing was normalized to a MongoQuery-compatible form that compiles cleanly under strict mode.

### P1-T5 Build Hono + oRPC + Scalar API skeleton
- Status: done
- Changed files:
  - `apps/api/src/index.ts`
  - `apps/api/src/lib/openapi.ts`
  - `apps/api/src/orpc/*`
  - `apps/api/src/routes/*`
  - `apps/api/package.json`
- Commands:
  - `PORT=3001 APP_URL=http://localhost:3000 API_URL=http://localhost:3001 DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/api dev`
  - `curl -sS http://localhost:3001/health`
  - `curl -sS http://localhost:3001/api/openapi.json`
  - `curl -I -sS http://localhost:3001/api/docs`
  - `curl -sS http://localhost:3001/api/v1/system/ping`
- Result:
  - API skeleton boots successfully and serves health, OpenAPI JSON, Scalar docs, and one oRPC endpoint.
- Unlocked tasks:
  - `P2-T1`
- Notes:
  - OpenAPI generation uses `@orpc/openapi` with route metadata on the initial `system.ping` procedure.
