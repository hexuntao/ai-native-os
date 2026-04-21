# AI Native OS Scheduler Master Plan

Generated: 2026-04-01
Planner Role: Scheduler Thread
Planning Scope: Phase planning only. No business code in this stage.

## 1. Current Baseline

- Repository status on 2026-04-01:
  - Present: `AGENTS.md`, `docs/architecture.md`, `docs/ai-agent-design.md`, `docs/rbac-design.md`, `docs/api-conventions.md`, `docs/deployment-guide.md`
  - Absent: monorepo scaffold, apps, packages, CI, Docker, runtime code
- Planning implication:
  - The first implementation tasks must create the engineering substrate before any feature work.
  - Phase 1 must include workspace bootstrap in addition to `db / shared / api skeleton`.

## 2. Non-Negotiable Constraints

- TypeScript strict mode everywhere.
- No `any` outside tests.
- Biome only. No Prettier. No ESLint.
- React function components only. No `React.FC`.
- Use path aliases with `@/` => `src/`.
- All API input and output validated by Zod.
- Database access only through Drizzle ORM.
- Authorization must use CASL ability checks. No hardcoded role-name branching for permission logic.
- AI Agent tools must define input and output schemas.
- All AI operations must write audit logs.
- New APIs must surface OpenAPI 3.1 docs.
- Post-task validation standard: `pnpm lint` and `pnpm typecheck`.

## 3. Delivery Topology

- Execution order anchor from project rules:
  1. `packages/db`
  2. `packages/shared`
  3. `apps/api`
  4. `apps/web`
  5. `apps/api/src/mastra` and workflows
- Allowed parallel lanes:
  - `db` <-> `shared` after root workspace bootstrap is complete
  - `api` <-> `ai` after auth, contracts, and core runtime boundaries are stable
  - `web` starts after API contract and auth boundary are stable enough for integration

## 4. Global QA Gates

### Gate A: Structural Gate

- Required files exist in planned paths.
- Package exports, scripts, and workspace references resolve.
- No placeholder TODO implementations.

### Gate B: Static Gate

- `pnpm biome check --write` run on changed files.
- `pnpm lint` passes.
- `pnpm typecheck` passes.

### Gate C: Contract Gate

- Zod schemas and shared types compile.
- OpenAPI generation works for new oRPC routes.
- Auth and permission boundaries have tests or smoke verification.

### Gate D: Runtime Gate

- Relevant service boots locally.
- Critical smoke endpoints work.
- Queue, workflow, or streaming path works for the task scope.

### Gate E: AI Safety Gate

- Agent inputs sanitized.
- Tool-level permission checks enforced.
- AI audit log is written for every agent action in scope.
- Eval or quality checks exist where required by phase.

## 5. Phase Plan

## Phase 1: Foundation Infrastructure

Goal: create the runnable monorepo foundation for `db`, `shared`, and `api skeleton`.

Dependencies:
- None

Milestone 1.1: Workspace bootstrap

- P1-T1 Create root monorepo scaffold
  - Inputs: docs, AGENTS rules
  - Outputs: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, base TypeScript config, `.gitignore`, `.env.example`
  - Validation: workspace commands resolve; `pnpm install` can run
  - Dependencies: none
  - Parallelizable: no

- P1-T2 Create app and package skeleton directories
  - Inputs: P1-T1
  - Outputs: `apps/web`, `apps/api`, `apps/worker`, `apps/jobs`, `packages/db`, `packages/shared`, `packages/ui`, `packages/auth`
  - Validation: package discovery works in workspace
  - Dependencies: P1-T1
  - Parallelizable: no

Milestone 1.2: Data and contract substrate

- P1-T3 Define Drizzle base schema and migration pipeline
  - Inputs: P1-T1, P1-T2, architecture doc, RBAC doc
  - Outputs: Drizzle config, core schema files, migration generation scripts, seed entrypoints
  - Validation: `pnpm --filter db db:generate` and `pnpm --filter db db:migrate`
  - Dependencies: P1-T2
  - Parallelizable: yes, with P1-T4

- P1-T4 Define shared Zod schemas, constants, and CASL ability core
  - Inputs: P1-T1, P1-T2, RBAC doc, API conventions doc
  - Outputs: `packages/shared/src/schemas`, `constants`, `types`, `abilities`
  - Validation: shared package builds and typechecks
  - Dependencies: P1-T2
  - Parallelizable: yes, with P1-T3

Milestone 1.3: API shell

- P1-T5 Build Hono + oRPC + Scalar API skeleton
  - Inputs: P1-T3, P1-T4
  - Outputs: `apps/api` app entry, middleware chain, route registry, docs route, health route, oRPC base setup
  - Validation: API boots, `/health` and `/api/docs` respond, OpenAPI emits
  - Dependencies: P1-T3, P1-T4
  - Parallelizable: limited

- P1-T6 Add local dev infrastructure for database and cache
  - Inputs: P1-T1, deployment guide
  - Outputs: local Docker Compose dev stack, bootstrap scripts, service env mapping
  - Validation: PostgreSQL and Redis boot locally; API can connect
  - Dependencies: P1-T1
  - Parallelizable: yes, with P1-T3 or P1-T4

Definition of Done:
- Monorepo exists and installs.
- DB migration and seed pipeline works.
- Shared schema and ability package compile.
- API skeleton boots with docs and health endpoint.
- Local dev dependencies for DB and Redis are available.

## Phase 2: Auth + RBAC

Goal: establish secure identity, session, and permission enforcement across backend and frontend boundaries.

Dependencies:
- Phase 1 complete

Milestone 2.1: Auth runtime

- P2-T1 Implement `packages/auth` Better Auth server and client configuration
  - Inputs: Phase 1 outputs, deployment env contract
  - Outputs: auth package server config, client helpers, env validation
  - Validation: login/session flows smoke-tested
  - Dependencies: P1-T5
  - Parallelizable: no

- P2-T2 Integrate auth middleware into Hono and expose `/api/auth/*`
  - Inputs: P2-T1, API skeleton
  - Outputs: auth middleware, request context user identity, public/private route boundary
  - Validation: protected route returns 401 without session and success with valid session
  - Dependencies: P2-T1
  - Parallelizable: limited

Milestone 2.2: RBAC data and ability enforcement

- P2-T3 Implement RBAC tables, seeds, and permission-loading service
  - Inputs: P1-T3, RBAC design doc
  - Outputs: roles, permissions, join tables, menu permission linkage, default seed data
  - Validation: super_admin, admin, editor, viewer seed data inserted correctly
  - Dependencies: P1-T3
  - Parallelizable: yes, with P2-T1

- P2-T4 Implement CASL ability builder and Hono permission middleware
  - Inputs: P1-T4, P2-T2, P2-T3
  - Outputs: ability loader, generic `checkAbility`, resource-scoped permission middleware
  - Validation: 403 behavior verified for denied actions and resource conditions
  - Dependencies: P2-T2, P2-T3
  - Parallelizable: no

- P2-T5 Expose permission query endpoints and serialized ability payload
  - Inputs: P2-T4, API conventions doc
  - Outputs: API route for current user permissions and ability rules
  - Validation: frontend consumer can fetch and deserialize ability rules
  - Dependencies: P2-T4
  - Parallelizable: yes, with P2-T6

Milestone 2.3: Minimal UI access boundary

- P2-T6 Build minimal auth shell and permission provider in web app
  - Inputs: P1-T2, P2-T1, P2-T5
  - Outputs: login page skeleton, dashboard auth guard, ability provider, menu filtering hook
  - Validation: protected layout hides or shows UI by ability rules
  - Dependencies: P2-T1, P2-T5
  - Parallelizable: yes, with P2-T5 after auth contract stabilizes

Definition of Done:
- Users can authenticate.
- API and UI both enforce CASL-based permissions.
- Seed roles and permissions exist.
- Protected routes and permission-dependent UI behavior are verified.
- Auth and permission failures return standardized API errors.

## Phase 3: AI Core

Goal: make AI a first-class system runtime with agents, tools, workflows, MCP, and RAG.

Dependencies:
- Phase 1 complete
- Phase 2 complete

Milestone 3.1: Mastra runtime integration

- P3-T1 Integrate Mastra with Hono and register core runtime
  - Inputs: Phase 1 API foundation, Phase 2 auth boundary
  - Outputs: `apps/api/src/mastra/index.ts`, Hono adapter mount, runtime config, model routing scaffolding
  - Validation: `/mastra/*` endpoints respond and runtime initializes
  - Dependencies: P2-T4
  - Parallelizable: no

- P3-T2 Build core agent tool framework with RBAC and audit enforcement
  - Inputs: P2-T4, P3-T1, AI design doc
  - Outputs: tool base patterns, user-management, permission-query, data-query, notification, config/log lookup tools
  - Validation: each tool has Zod input/output, permission check, audit write
  - Dependencies: P2-T4, P3-T1
  - Parallelizable: yes, with P3-T3 when write scopes are isolated

- P3-T3 Implement initial agents
  - Inputs: P3-T2
  - Outputs: `admin-copilot`, `data-analyst`, `approval-agent`, `anomaly-detector`, `report-generator`
  - Validation: at least `admin-copilot` and one specialist agent run end-to-end
  - Dependencies: P3-T2
  - Parallelizable: yes, across agent files after tool contract stabilizes

Milestone 3.2: Workflow, queue, and streaming

- P3-T4 Implement AI workflows and Trigger.dev task orchestration
  - Inputs: P3-T1, P3-T2, deployment guide
  - Outputs: approval flow, report schedule, cleanup/index/eval task entries, jobs runtime
  - Validation: workflow execution and at least one scheduled/background task smoke pass
  - Dependencies: P3-T1, P3-T2
  - Parallelizable: yes, with P3-T5

- P3-T5 Implement CopilotKit and AG-UI backend bridge
  - Inputs: P3-T1, P3-T3
  - Outputs: CopilotKit route, AG-UI runtime endpoint, streaming state events
  - Validation: frontend can connect to streaming agent endpoint
  - Dependencies: P3-T1, P3-T3
  - Parallelizable: yes, with P3-T4

Milestone 3.3: Knowledge and interoperability

- P3-T6 Implement pgvector-backed RAG indexing and retrieval
  - Inputs: P1-T3, P3-T1, AI design doc
  - Outputs: knowledge tables, chunking/embed pipeline, retrieval helpers, indexing task
  - Validation: sample document can be indexed and retrieved semantically
  - Dependencies: P1-T3, P3-T1
  - Parallelizable: yes

- P3-T7 Implement MCP server and external MCP client integration
  - Inputs: P3-T2, P3-T3, P3-T4
  - Outputs: MCP server exposing agents/workflows/tools, external MCP client config
  - Validation: MCP tool discovery works for at least one agent, one workflow, and one direct tool
  - Dependencies: P3-T2, P3-T3
  - Parallelizable: yes, after tool and agent identifiers stabilize

Definition of Done:
- Mastra runtime is mounted in API.
- At least one agent, one workflow, and one Copilot stream path work.
- RAG ingestion and retrieval work against pgvector.
- MCP server exposes planned capabilities.
- All AI actions emit audit logs and respect permissions.

## Phase 4: Web UI

Goal: deliver the AI Native admin interface, dashboard workflows, and copilot interaction surfaces.

Dependencies:
- Phase 2 complete
- Phase 3 P3-T5 complete for copilot integration
- Stable API contracts for core modules

Milestone 4.1: Web shell and design system

- P4-T1 Build Next.js app shell, global providers, and dashboard layout
  - Inputs: P1-T2, P2-T6, API client contract
  - Outputs: app router structure, query provider, i18n baseline, dashboard layout
  - Validation: authenticated shell boots and navigates
  - Dependencies: P2-T6
  - Parallelizable: no

- P4-T2 Establish shared UI primitives and shadcn-based component baseline
  - Inputs: P1-T2, design requirements
  - Outputs: `packages/ui` exports, design tokens, table/form/dialog primitives
  - Validation: shared UI package builds and is consumed by web
  - Dependencies: P1-T2
  - Parallelizable: yes, with P4-T1

Milestone 4.2: Core admin modules

- P4-F1 Insert contract-first business API skeleton for system, monitor, and AI modules
  - Inputs: P2-T5, P3-T6, API conventions doc
  - Outputs: shared list/query schemas, documented `/api/v1/system/*`, `/api/v1/monitor/*`, and `/api/v1/ai/*` read skeleton endpoints, REST query compatibility layer, contract tests
  - Validation: OpenAPI emits the documented paths; direct GET requests with query strings succeed under authenticated RBAC smoke
  - Dependencies: P2-T5, P3-T6
  - Parallelizable: no
  - Notes: this is a correction task to unblock `P4-T3` and `P4-T4`; it is not full CRUD/business implementation

- P4-T3 Implement system management pages
  - Inputs: P2-T5, P4-F1, P4-T1, P4-T2
  - Outputs: users, roles, permissions, menus, dicts, config pages
  - Validation: CRUD pages query real API and honor permissions
  - Dependencies: P4-F1, P4-T1, P4-T2, Phase 2 complete
  - Parallelizable: yes, by module after shared patterns land

- P4-T4 Implement monitor and AI management pages
  - Inputs: P3-T6, P4-F1, P4-T1, P4-T2
  - Outputs: online users, logs, server, knowledge, evals, audit pages
  - Validation: monitoring and AI admin data render correctly
  - Dependencies: P4-F1, P4-T1, P4-T2, P3-T6
  - Parallelizable: yes, with P4-T3 where routes do not overlap

Milestone 4.3: AI-native interface layer

- P4-T5 Integrate CopilotKit sidebar and assistant-style chat UX
  - Inputs: P3-T5, P4-T1
  - Outputs: copilot sidebar, chat panel, stream handlers, action wiring
  - Validation: agent conversation is usable inside dashboard
  - Dependencies: P3-T5, P4-T1
  - Parallelizable: yes, with P4-T4

- P4-T6 Implement generative UI components
  - Inputs: P4-T5, Phase 3 tool and workflow contracts
  - Outputs: NL filters, generative table, generative form, generative chart
  - Validation: AI can trigger component renders and state changes safely
  - Dependencies: P4-T5
  - Parallelizable: limited

Definition of Done:
- Dashboard shell, auth guard, and menu permissions work.
- Contract-first business APIs required by the management surfaces exist and are directly consumable over documented REST paths.
- Core admin pages use real API data.
- Copilot panel is embedded and functional.
- At least one generative UI interaction works end-to-end.

## Phase 5: Observability

Goal: make the platform auditable, measurable, and continuously improvable.

Dependencies:
- Phases 2, 3, and 4 substantially complete

Milestone 5.1: Operational telemetry

- P5-T1 Implement operation log and AI audit log pipelines end-to-end
  - Inputs: Phase 2 and Phase 3 write paths
  - Outputs: operation log helpers, AI audit log writes, query surfaces
  - Validation: create/update/delete and AI tool actions are traceable
  - Dependencies: Phase 2 complete, Phase 3 complete
  - Parallelizable: yes, with P5-T2

- P5-T2 Add Sentry, OpenTelemetry, request IDs, and health checks
  - Inputs: API runtime, deployment guide
  - Outputs: telemetry bootstrap, trace propagation, health endpoint, degraded-state checks
  - Validation: traces and errors emit to configured backends; `/health` reflects dependency status
  - Dependencies: P1-T5
  - Parallelizable: yes

Milestone 5.2: Feedback and quality loop

- P5-T3 Implement AI feedback capture and human override tracking
  - Inputs: P3-T4, P4-T5
  - Outputs: feedback APIs, tables, UI capture points, override reporting
  - Validation: rejected or edited AI suggestions persist feedback records
  - Dependencies: P3-T4, P4-T5
  - Parallelizable: no

- P5-T4 Implement Mastra Evals datasets, scorers, and runners
  - Inputs: P3-T3, P3-T4
  - Outputs: eval datasets, experiments, task runners, baseline thresholds
  - Validation: scheduled or manual eval run produces scored results
  - Dependencies: P3-T3, P3-T4
  - Parallelizable: yes, with P5-T3

- P5-T5 Implement prompt versioning and release gates for AI changes
  - Inputs: P5-T4, AI audit model
  - Outputs: prompt version storage, activation flow, rollback path, threshold policy
  - Validation: new prompt version cannot become active without eval evidence
  - Dependencies: P5-T4
  - Parallelizable: limited

Definition of Done:
- Audit, traces, and health signals exist.
- Feedback loops connect UI and AI runtime.
- Evals produce measurable quality outputs.
- Prompt releases have governed activation and rollback.

## Phase 6: Deployment

Goal: make the platform deployable, repeatable, and recoverable across target environments.

Dependencies:
- Phase 1 foundational files exist
- Core runtime from Phases 2 through 5 is stable enough for packaging

Milestone 6.1: Packaging and environment contracts

- P6-T1 Finalize environment matrix and secret contract
  - Inputs: deployment guide, actual runtime needs
  - Outputs: complete `.env.example`, secret documentation, per-target environment mapping
  - Validation: all runtimes boot with documented variables only
  - Dependencies: Phase 3 complete
  - Parallelizable: yes

- P6-F1 Align worker deployment runtime and binding contract
  - Inputs: P6-T1, deployment guide, current `apps/worker` skeleton
  - Outputs: worker runtime entry, queue/R2 binding contract, worker smoke-test path, non-skeleton package surface
  - Validation: `@ai-native-os/worker` builds and exposes a deployable runtime contract instead of a skeleton marker
  - Dependencies: P6-T1
  - Parallelizable: limited

- P6-T2 Implement Docker packaging and self-hosted runtime topology
  - Inputs: deployment guide, current package layout
  - Outputs: Dockerfiles, compose files, nginx config, entrypoint or migration strategy
  - Validation: API, jobs, DB, Redis boot through Docker
  - Dependencies: Phase 1 complete, Phase 3 complete
  - Parallelizable: yes, with P6-T3

Milestone 6.2: Cloud and CI/CD targets

- P6-T3 Implement Vercel, Cloudflare, and Trigger deployment configs
  - Inputs: web, api, worker, jobs packages
  - Outputs: `vercel.json`, `wrangler.toml`, Trigger config, deploy docs
  - Validation: at least one deployment mode reaches staging successfully
  - Dependencies: Phase 3 complete, Phase 4 complete, P6-F1
  - Parallelizable: yes, with P6-T2

- P6-T4 Implement GitHub Actions CI/CD workflows
  - Inputs: Phase 1 scripts, deployment configs
  - Outputs: CI pipeline, deploy workflows, cache strategy, migration step ordering
  - Validation: PR CI runs lint, typecheck, tests, migrations; deploy workflow passes in staging
  - Dependencies: P6-T1, P6-T2, P6-T3
  - Parallelizable: no

Milestone 6.3: Release hardening

- P6-T5 Complete security, backup, rollback, and smoke-check playbooks
  - Inputs: telemetry, deployment runtime, security checklist
  - Outputs: release checklist, rollback procedure, backup verification steps, smoke test script set
  - Validation: documented rollback drill and production smoke path reviewed
  - Dependencies: P6-T2, P6-T4, P5-T2
  - Parallelizable: limited

Milestone 6.4: Audit corrections

- P6-C1 Align deployment status contract and implement API rate limiting
  - Inputs: P6-T5 outputs, architecture security baseline, audit findings
  - Outputs: Phase 6 status/document wording aligned to validated deployment modes, API rate limiting middleware, rate limiting tests, updated release/security docs
  - Validation: `Status.md` / `docs/environment-matrix.md` no longer conflict, API returns `429` after configured threshold in targeted tests, `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
  - Dependencies: P6-T5
  - Parallelizable: no

- P6-C2 Fill remaining contract-first API skeleton gaps
  - Inputs: API conventions, current `appRouter`, audit findings
  - Outputs: missing `system/dicts`, `system/config`, `tools/gen`, `tools/jobs` skeleton routes with OpenAPI surface and tests
  - Validation: OpenAPI contract and route smoke cover the missing documented surfaces
  - Dependencies: P6-C1
  - Parallelizable: no

- P6-C3 Reconcile AI runtime coverage with design docs
  - Inputs: AI agent design, architecture doc, current runtime registry, audit findings
  - Outputs: either expanded safe runtime coverage or explicit documented down-scope aligned to current minimal-safe agent/workflow set
  - Validation: runtime summary, docs, and registry inventory no longer conflict
  - Dependencies: P6-C1
  - Parallelizable: limited

Definition of Done:
- At least one deployment mode reaches a usable environment.
- CI/CD enforces lint, typecheck, test, and migration discipline.
- Secrets, backups, rollback, and smoke procedures are documented and verified.
- Any post-audit corrective tasks that block status/document consistency or security baseline claims are closed before declaring the phase fully complete.

## 6. Cross-Phase Dependency Graph

- Phase 1 -> required by every later phase
- Phase 2 -> required by Phase 3 and Phase 4
- Phase 3 -> required by AI UI integration in Phase 4 and by eval/feedback in Phase 5
- Phase 4 -> required by human-in-the-loop surfaces and feedback capture in Phase 5
- Phase 5 -> informs Phase 6 production release gates

Critical chain:
- P1-T1 -> P1-T2 -> P1-T3/P1-T4 -> P1-T5 -> P2-T1/P2-T3 -> P2-T4 -> P3-T1 -> P3-T2 -> P3-T3/P3-T5 -> P4-T5 -> P5-T3 -> P6-T4

Main parallel lanes:
- Lane A: P1-T3 `db`
- Lane B: P1-T4 `shared`
- Lane C: P3-T4 workflows/jobs
- Lane D: P3-T6 RAG
- Lane E: P4-T3 and P4-T4 module pages after shell patterns stabilize

## 7. Initial Ready Queue

- Ready now:
  - P1-T1 Create root monorepo scaffold

- Auto-unlock after P1-T1 passes QA:
  - P1-T2 Create app and package skeleton directories
  - P1-T6 Add local dev infrastructure for database and cache

- Auto-unlock after P1-T2 passes QA:
  - P1-T3 Define Drizzle base schema and migration pipeline
  - P1-T4 Define shared Zod schemas, constants, and CASL ability core

## 8. Phase Exit Policy

- A phase exits only when:
  - Every task in the phase is `done`
  - All required QA gates for that phase pass
  - `Status.md` is updated with artifacts, validation evidence, and next ready queue
- If QA fails:
  - Move task state to `failed`
  - Re-open the smallest corrective task
  - Do not advance the phase until corrective task passes

## 9. Post-Launch Optimization Program

Planning note:
- Phase 1 through Phase 6 are complete.
- The repository is now in optimization mode rather than net-new phase construction.
- Execution still follows the same scheduler discipline:
  - only execute ready tasks
  - one clear-scope task at a time
  - update `Status.md` after each task
  - run QA gate before closing the task

### Plan 1: Web UI/UX Hardening

Goal:
- Improve high-frequency operator efficiency and make AI governance surfaces feel like production workbenches rather than generalized admin pages.

Milestones:
- UI-C12 Batch feedback and repetitive triage safety
  - Outputs: batch result feedback, batch-safe destructive confirmation flows, denser repetitive triage shortcuts
  - Validation: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- UI-C13 AI governance workbench deepening
  - Outputs: richer prompt/eval/audit timelines, evidence panels, denser governance review ergonomics
  - Validation: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- UI-C14 Observability triage workbench
  - Outputs: anomaly-first monitor views, stronger incident scan paths, clearer runtime dependency prioritization
  - Validation: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- UI-C15 Copilot handoff deepening
  - Outputs: stronger route-specific assistant handoff cards, higher-signal operator prompts, tighter workflow context transfer
  - Validation: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

Dependencies:
- UI-C12 depends on UI-C11
- UI-C13 depends on UI-C12
- UI-C14 depends on UI-C13
- UI-C15 depends on UI-C14

Definition of Done:
- Directory pages support high-frequency repetitive operator loops with low-friction feedback.
- AI and monitor pages present denser operator context without widening API contract scope.
- Copilot guidance remains route-specific and auditable.

### Plan 2: API Platform Consistency

Goal:
- Bring the remaining management and helper surfaces to the same long-term contract quality as the completed CRUD modules.

Completion note:
- `API-C1` through `API-C4` are complete.
- `system/config` and `system/dicts` now expose audited custom CRUD while preserving built-in runtime/seed resources as read-only contract surfaces.
- Error payloads now share a stable schema and OpenAPI response component set across REST-compatible routes.
- Shared catalog query helpers and expanded regression coverage now guard route drift at the contract layer.
- `API-C5-1` through `API-C5-4` are complete.
- `docs/api-conventions.md` now distinguishes required CRUD contracts from optional command routes and reflects the current public API surface instead of the historical generic template.
- Contract regression now verifies the API conventions document against the current public route families to catch documentation drift early.
- `API-C6` through `API-C9` are complete.
- High-risk AI governance mutations now support `Idempotency-Key` replay protection with persisted request fingerprints and conflict detection.
- Domain-level API error codes now distinguish eval, prompt, feedback, and audit failures from generic transport-layer `BAD_REQUEST` / `NOT_FOUND` buckets.
- Rate limiting now separates auth, general reads, system writes, and AI governance commands into distinct enforcement profiles.
- Shared catalog query and route-family helpers now give the public API a single source of truth for list pagination semantics and route-boundary classification.

Milestones:
- API-C1 Deliver `system/config` and `system/dicts` full CRUD with audit-safe write paths and contract-first OpenAPI
- API-C2 Standardize API error contracts, error codes, and OpenAPI error examples
- API-C3 Extract shared pagination/filter/sort helpers to reduce route drift
- API-C4 Expand API regression matrix and cross-surface smoke coverage
- API-C5-1 Audit the standard CRUD template against the current public route surface
- API-C5-2 Rewrite `docs/api-conventions.md` to separate required CRUD from optional command routes
- API-C5-3 Add a current public contract mapping for `system/*`, `monitor/*`, `ai/*`, and `tools/*`
- API-C5-4 Add regression coverage that detects API conventions document drift
- API-C6 Add idempotency governance for command-style API mutations with replay-safe semantics
- API-C7 Standardize domain-specific error codes and route-level domain error helpers
- API-C8 Split rate limiting into business-aware profiles for auth, system writes, AI commands, and general reads
- API-C9 Unify list-query response helpers and classify helper routes by public contract family

Dependencies:
- API-C1 depends on current Post-P6 baseline
- API-C2 depends on API-C1
- API-C3 depends on API-C2
- API-C4 depends on API-C3
- API-C5-1 depends on API-C4
- API-C5-2 depends on API-C5-1
- API-C5-3 depends on API-C5-2
- API-C5-4 depends on API-C5-3
- API-C6 depends on API-C5-4
- API-C7 depends on API-C6
- API-C8 depends on API-C7
- API-C9 depends on API-C8

Definition of Done:
- Remaining system helper resources reach the same contract-first quality bar.
- Error contracts are stable and documented across the API.
- Regression tests catch route drift before release.
- The API conventions document no longer promises generic resource capabilities that the implementation does not expose.
- High-risk command routes can be retried safely without duplicating side effects.
- Route families, list responses, and rate-limit profiles are explicit enough to keep API behavior predictable as the surface grows.

### Plan 3: Identity and Permission Hardening

Goal:
- Remove long-tail identity ambiguity and make authorization behavior easier to evolve safely.

Milestones:
- IAM-C2 Remove residual email fallback from steady-state identity resolution
- IAM-C3 Add principal repair/backfill tooling for legacy records
- IAM-C4 Expand permission regression coverage across resource, field, and conditional cases
- IAM-C5 Add permission-change impact and audit inspection views

Dependencies:
- IAM-C2 depends on current IAM-C1 baseline
- IAM-C3 depends on IAM-C2
- IAM-C4 depends on IAM-C3
- IAM-C5 depends on IAM-C4

Definition of Done:
- Stable principal binding no longer relies on email compatibility in steady-state flows.
- Permission regressions are detectable through automated coverage.
- Identity and authorization drift are visible and repairable.

### Plan 4: AI Governance Deepening

Goal:
- Extend the current prompt/eval/audit baseline into a fuller governance operating model.

Milestones:
- GOV-C2 Extend rejection, exception, and override governance contracts
- GOV-C3 Connect eval evidence, prompt release gates, and operator review surfaces
- GOV-C4 Add approval/failure/exception read models for audit inspection
- GOV-C5 Unify prompt/eval/audit/feedback governance workflows

Dependencies:
- GOV-C2 depends on GOV-C1
- GOV-C3 depends on GOV-C2
- GOV-C4 depends on GOV-C3
- GOV-C5 depends on GOV-C4

Definition of Done:
- Failure, release, and override paths are auditable and queryable end-to-end.
- Governance operators can review AI changes without reconstructing context from raw logs.

### Plan 5: Productionization and Operations Maturity

Goal:
- Move from repository-level deployment readiness to stronger real-environment and operational maturity.

Milestones:
- OPS-C1 Strengthen Redis/jobs/worker/trigger health probes and runtime summaries
- OPS-C2 Deepen backup, rollback, and release-smoke automation
- OPS-C3 Validate remote Vercel/Cloudflare/Trigger environments with real credentials and staging proof
- OPS-C4 Expand incident triage and recovery playbooks
- OPS-C5 Add deployment/config drift detection in CI

Dependencies:
- OPS-C1 depends on current Phase 6 baseline
- OPS-C2 depends on OPS-C1
- OPS-C3 depends on OPS-C2
- OPS-C4 depends on OPS-C3
- OPS-C5 depends on OPS-C4

Definition of Done:
- At least one remote deployment path is validated beyond dry-run level.
- Recovery and release trust are supported by repeatable automation.
- Operational drift can be detected before it becomes a production incident.
