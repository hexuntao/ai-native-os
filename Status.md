# AI Native OS Scheduler Status

Last Updated: 2026-04-20
Current Mode: Post-Phase 6 backlog ready
Current Phase: Post-Phase 6 `Hardening & Documentation Rollout`
Overall Status: `phase_6_complete_e2e_remediation_closed`

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
  - `.github/workflows/*`
  - root workspace manifests
  - `apps/*`
  - `packages/*`
  - `docker/docker-compose.yml`
  - `docker/docker-compose.prod.yml`
  - `docker/nginx.conf`
- Not yet present:
  - linked Vercel project metadata
  - authenticated Cloudflare / Trigger deploy sessions

## 2. Phase Summary

| Phase | Name | Status | Exit Condition |
|---|---|---|---|
| 1 | Foundation Infrastructure | done | Monorepo, db/shared/api skeleton, local infra available |
| 2 | Auth + RBAC | done | Better Auth + CASL + seed roles + minimal auth shell |
| 3 | AI Core | done | Mastra + tools + workflows + MCP + RAG |
| 4 | Web UI | done | Dashboard + system pages + CopilotKit + generative UI |
| 5 | Observability | done | Audit + telemetry + evals + feedback + prompt governance |
| 6 | Deployment | done | At least one deployment mode validated + CI/CD + rollback readiness + critical audit corrections closed |

## 3. Task Ledger

| Task ID | Phase | Task | Status | Dependencies | Validation |
|---|---|---|---|---|---|
| P1-T1 | 1 | Create root monorepo scaffold | done | none | workspace bootstrap smoke |
| P1-T2 | 1 | Create app and package skeleton directories | done | P1-T1 | workspace package discovery |
| P1-T3 | 1 | Define Drizzle base schema and migration pipeline | done | P1-T2 | db generate + migrate |
| P1-T4 | 1 | Define shared Zod schemas, constants, and CASL ability core | done | P1-T2 | shared typecheck |
| P1-T5 | 1 | Build Hono + oRPC + Scalar API skeleton | done | P1-T3, P1-T4 | API boot + docs + health |
| P1-T6 | 1 | Add local dev infrastructure for database and cache | done | P1-T1 | Docker service smoke |
| P2-T1 | 2 | Implement Better Auth server and client configuration | done | P1-T5 | login/session smoke |
| P2-T2 | 2 | Integrate auth middleware into Hono and expose auth routes | done | P2-T1 | 401/auth route smoke |
| P2-T3 | 2 | Implement RBAC tables, seeds, and permission-loading service | done | P1-T3 | seed and lookup verification |
| P2-T4 | 2 | Implement CASL ability builder and permission middleware | done | P2-T2, P2-T3 | 403/condition verification |
| P2-T5 | 2 | Expose permission query endpoints and serialized ability payload | done | P2-T4 | ability fetch and deserialize |
| P2-T6 | 2 | Build minimal auth shell and permission provider in web app | done | P2-T1, P2-T5 | protected layout smoke |
| P3-T1 | 3 | Integrate Mastra with Hono and register core runtime | done | P2-T4 | Mastra mount smoke |
| P3-T2 | 3 | Build core agent tool framework with RBAC and audit enforcement | done | P2-T4, P3-T1 | tool schema + audit verification |
| P3-F1 | 3 | Unify Mastra auth boundary and authenticated request-context bridge | done | P3-T1, P3-T2 | authenticated `/mastra/*` smoke |
| P3-F2 | 3 | Remove empty-runtime assumptions and align runtime metadata | done | P3-F1 | runtime summary + test cleanup |
| P3-T3 | 3 | Implement initial agents | done | P3-T2, P3-F1, P3-F2 | agent generation smoke |
| P3-T4 | 3 | Implement AI workflows and Trigger.dev task orchestration | done | P3-T1, P3-T2, P3-F1, P3-F2 | workflow/task smoke |
| P3-T5 | 3 | Implement CopilotKit and AG-UI backend bridge | done | P3-T1, P3-T3 | streaming endpoint smoke |
| P3-T6 | 3 | Implement pgvector-backed RAG indexing and retrieval | done | P1-T3, P3-T1, P3-F2 | index + semantic query smoke |
| P3-T7 | 3 | Implement MCP server and external MCP client integration | done | P3-T2, P3-T3, P3-T4 | MCP discovery smoke |
| P4-T1 | 4 | Build Next.js app shell, global providers, and dashboard layout | done | P2-T6 | authenticated shell smoke |
| P4-T2 | 4 | Establish shared UI primitives and shadcn-based component baseline | done | P1-T2 | package/ui build smoke |
| P4-F1 | 4 | Insert contract-first business API skeleton for system, monitor, and AI modules | done | P2-T5, P3-T6 | OpenAPI + REST query smoke |
| P4-T3 | 4 | Implement system management pages | done | P4-F1, P4-T1, P4-T2, Phase 2 | system page smoke |
| P4-T4 | 4 | Implement monitor and AI management pages | done | P4-F1, P4-T1, P4-T2, P3-T6 | monitor and AI page smoke |
| P4-T5 | 4 | Integrate CopilotKit sidebar and assistant-style chat UX | done | P3-T5, P4-T1 | chat stream smoke |
| P4-T6 | 4 | Implement generative UI components | done | P4-T5 | action render smoke |
| P5-T1 | 5 | Implement operation log and AI audit log pipelines end-to-end | done | Phase 2, Phase 3 | log trace verification |
| P5-T2 | 5 | Add Sentry, OpenTelemetry, request IDs, and health checks | done | P1-T5 | telemetry + health smoke |
| P5-T3 | 5 | Implement AI feedback capture and human override tracking | done | P3-T4, P4-T5 | feedback persistence smoke |
| P5-T4 | 5 | Implement Mastra Evals datasets, scorers, and runners | done | P3-T3, P3-T4 | eval run result verification |
| P5-T5 | 5 | Implement prompt versioning and release gates for AI changes | done | P5-T4 | version activate/rollback verification |
| P6-T1 | 6 | Finalize environment matrix and secret contract | done | Phase 3 | env-only boot verification |
| P6-F1 | 6 | Align worker deployment runtime and binding contract | done | P6-T1 | worker contract smoke |
| P6-T2 | 6 | Implement Docker packaging and self-hosted runtime topology | done | Phase 1, Phase 3 | Docker smoke deploy |
| P6-T3 | 6 | Implement Vercel, Cloudflare, and Trigger deployment configs | done | Phase 3, Phase 4, P6-F1 | staging deploy smoke |
| P6-T4 | 6 | Implement GitHub Actions CI/CD workflows | done | P6-T1, P6-T2, P6-T3 | CI and deploy workflow verification |
| P6-T5 | 6 | Complete security, backup, rollback, and smoke-check playbooks | done | P6-T2, P6-T4, P5-T2 | release-readiness review |
| P6-C1 | 6 | Align deployment status contract and implement API rate limiting | done | P6-T5 | docs consistency + `429` middleware verification |
| P6-C2 | 6 | Fill remaining contract-first API skeleton gaps | done | P6-C1 | OpenAPI + route smoke |
| P6-C3 | 6 | Reconcile AI runtime coverage with design docs | done | P6-C1 | runtime matrix review |
| E2E-S1-T1 | Post-P6 | Bootstrap seeded Better Auth admin and direct sign-in regression | done | none | migrate + seed + direct login |
| UX-C1 | Post-P6 | Deliver `system/users` full CRUD vertical with audit-safe web forms | done | P6-C2 | lint + typecheck + test + build |
| DOC-C1 | Post-P6 | Establish `system/users` OpenAPI documentation template and reusable schema doc helper | done | UX-C1 | lint + typecheck + test + build |
| E2E-S1-T2 | Post-P6 | Align local env template and startup docs | done | E2E-S1-T1 | fresh shell `release:smoke` |
| E2E-S2-T1 | Post-P6 | Add AI key preflight and degraded runtime exposure | done | E2E-S1-T2 | runtime summary and health degrade |
| E2E-S2-T2 | Post-P6 | Reconcile MCP and Copilot discovery with executable capability surface | done | E2E-S2-T1 | discovery parity under `viewer/admin/editor/super_admin` |
| E2E-S2-T3 | Post-P6 | Align AI agent and workflow capability documentation with dynamic discovery rules | done | E2E-S2-T2 | docs/runtime parity under authenticated principals |
| E2E-S3-T1 | Post-P6 | Finalize end-to-end regression script and release-trust hardening | done | E2E-S2-T3 | final local smoke bundle + release confidence report |
| DOC-C2 | Post-P6 | Roll out the OpenAPI documentation template to `system/roles` and `system/permissions` | done | DOC-C1, E2E-S3-T1 | Scalar schema parity for roles and permissions |
| DOC-C3 | Post-P6 | Roll out the OpenAPI documentation template to AI contract surfaces | done | DOC-C2, CRD-C3 | lint + typecheck + test + build |
| DOC-C4 | Post-P6 | Roll out the OpenAPI documentation template to monitor, tools, and system helper surfaces | done | DOC-C3 | lint + typecheck + test + build |
| CRD-C1 | Post-P6 | Deliver `system/roles` full CRUD vertical with audit-safe web forms and contract-first OpenAPI | done | DOC-C2 | lint + typecheck + test + build |
| CRD-C2 | Post-P6 | Deliver `system/permissions` full CRUD vertical with seeded-permission guardrails and contract-first OpenAPI | done | CRD-C1 | lint + typecheck + test + build |
| CRD-C3 | Post-P6 | Deliver `system/menus` full CRUD vertical with parent-chain guardrails and contract-first OpenAPI | done | CRD-C2 | `pnpm infra:up` + `pnpm db:migrate` + lint + typecheck + test + build |
| CRD-C4 | Post-P6 | Deliver `ai/knowledge` full document-level CRUD vertical with audited reindex semantics and contract-first OpenAPI | done | DOC-C3, DOC-C4 | lint + typecheck + test + build |
| CRD-C5 | Post-P6 | Deliver `ai/audit` and `ai/feedback` detail contracts with linked governance context and contract-first OpenAPI | done | CRD-C4 | lint + typecheck + test + build |
| CRD-C6 | Post-P6 | Deliver `ai/evals` governance detail and run-command contracts plus `ai/prompts` detail contract with contract-first OpenAPI | done | CRD-C5 | lint + typecheck + test + build |
| CRD-C7 | Post-P6 | Deliver `ai/evals` run-detail inspection contract with sample-level scoring detail and contract-first OpenAPI | done | CRD-C6 | lint + typecheck + test + build |
| CRD-C8 | Post-P6 | Deliver `ai/prompts` version-compare contract with governance diff summary and contract-first OpenAPI | done | CRD-C7 | lint + typecheck + test + build |
| CRD-C9 | Post-P6 | Deliver `ai/prompts` release-history contract with ordered version timeline and contract-first OpenAPI | done | CRD-C8 | lint + typecheck + test + build |
| CRD-C10 | Post-P6 | Deliver `ai/prompts` rollback-chain inspection contract with source-target lineage and contract-first OpenAPI | done | CRD-C9 | lint + typecheck + test + build |
| CRD-C11 | Post-P6 | Deliver `ai/prompts` release-approval audit contract with version-scoped audit trail and contract-first OpenAPI | done | CRD-C10 | lint + typecheck + test + build |
| GOV-C1 | Post-P6 | Deliver `ai/prompts` rejection and exception audit contract with failure-path operation logging and contract-first OpenAPI | done | CRD-C11 | lint + typecheck + test + build |
| IAM-C1 | Post-P6 | Harden Better Auth ↔ RBAC principal binding to prefer stable `auth_user_id` with legacy email backfill compatibility | done | GOV-C1 | db:migrate + lint + typecheck + test + build |
| UI-C1 | Post-P6 | Establish web UI design contract and refactor the app shell into a control-console baseline | done | IAM-C1 | lint + typecheck + test + build |
| UI-C2 | Post-P6 | Refactor directory-style pages toward toolbar + table + dialog-form ergonomics | done | UI-C1 | lint + typecheck + test + build |
| UI-C3 | Post-P6 | Refactor observability and AI governance pages into status-first workbench layouts | done | UI-C2 | lint + typecheck + test + build |
| UI-C4 | Post-P6 | Refactor `ai/knowledge` and route-aware Copilot surfaces into a deeper AI workbench workflow | done | UI-C3 | lint + typecheck + test + build |
| UI-C5 | Post-P6 | Deepen Copilot interaction ergonomics with route-specific assistant panels for current `ai/*` surfaces | done | UI-C4 | lint + typecheck + test + build |
| UI-C6 | Post-P6 | Add consistent empty/loading/error states, accessibility hardening, and page-level assistant handoff patterns across the remaining dashboard surfaces | done | UI-C5 | lint + typecheck + test + build |
| UI-C7 | Post-P6 | Tighten form-level accessibility, keyboard focus order, and dense-table responsiveness across the remaining management surfaces | done | UI-C6 | lint + typecheck + test + build |
| UI-C8 | Post-P6 | Unify inline validation, destructive-confirmation ergonomics, and sticky table headers across the remaining operator surfaces | done | UI-C7 | lint + typecheck + test + build |
| UI-C9 | Post-P6 | Add bulk-selection workflows, command-bar shortcuts, and denser operator toolbars for high-volume directory operations | done | UI-C8 | lint + typecheck + test + build |
| UI-C10 | Post-P6 | Add row-level quick preview panels and batch-safe export/share flows for high-frequency operator handoff | done | UI-C9 | lint + typecheck + test + build |
| UI-C11 | Post-P6 | Add saved view presets, denser filter chips, and inline row mutation feedback for repetitive operator triage | done | UI-C10 | lint + typecheck + test + build |
| UI-C12 | Post-P6 | Add batch result feedback, batch-safe destructive flows, and denser repetitive triage shortcuts for directory operators | done | UI-C11 | lint + typecheck + test + build |
| UI-C13 | Post-P6 | Deepen AI governance workbench timelines, review queues, and evidence ergonomics for `ai/evals` and `ai/audit` | done | UI-C12 | lint + typecheck + test + build |
| UI-C14 | Post-P6 | Deepen observability workbench triage with anomaly-first monitor views and incident prioritization | done | UI-C13 | lint + typecheck + test + build |
| UI-C15 | Post-P6 | Deepen route-specific Copilot handoff and assistant guidance for monitor and governance surfaces | done | UI-C14 | lint + typecheck + test + build |
| API-C1 | Post-P6 | Deliver `system/config` and `system/dicts` full CRUD with audit-safe custom write paths and contract-first OpenAPI while keeping built-in resources read-only | done | Post-P6 baseline | db:migrate + lint + typecheck + test + build |
| API-C2 | Post-P6 | Standardize API error contracts, error codes, and OpenAPI error examples across REST-compatible routes | done | API-C1 | lint + typecheck + test + build |
| API-C3 | Post-P6 | Extract shared pagination/filter/sort helpers for catalog-style API routes to reduce route drift | done | API-C2 | lint + typecheck + test + build |
| API-C4 | Post-P6 | Expand API regression matrix and cross-surface smoke coverage for helper and contract-first surfaces | done | API-C3 | lint + typecheck + test + build |
| IAM-C2 | Post-P6 | Remove steady-state email fallback from authenticated principal resolution and enforce `auth_user_id` as the primary identity key | done | IAM-C1 | lint + typecheck + test + build |
| IAM-C3 | Post-P6 | Add explicit principal repair and backfill tooling for legacy users that still require `auth_user_id` binding | done | IAM-C2 | lint + typecheck + test + build |
| IAM-C4 | Post-P6 | Expand permission regression coverage across resource, field, conditional, and inverted-rule cases | done | IAM-C3 | lint + typecheck + test + build |
| IAM-C5 | Post-P6 | Add permission-change impact inspection and permission audit inspection contracts for operators | done | IAM-C4 | lint + typecheck + test + build |

## 3.1 Post-Launch Plans

| Plan | Name | Status | Next Task |
|---|---|---|---|
| 1 | Web UI/UX Hardening | done | none |
| 2 | API Platform Consistency | done | none |
| 3 | Identity and Permission Hardening | done | none |
| 4 | AI Governance Deepening | ready | GOV-C2 |
| 5 | Productionization and Operations Maturity | queued | OPS-C1 |

## 4. Current Ready Queue

Priority order as of 2026-04-12:

- no active ready task in the scheduler DAG.
- `UX-C1` is closed; no additional CRUD correction task is currently open for `system/users`.
- `DOC-C1` is closed; `system/users` now serves as the OpenAPI documentation template for later contract surfaces.
- `DOC-C2` is closed; `system/roles` and `system/permissions` now align with the same OpenAPI documentation baseline.
- `DOC-C3` is closed; `ai/knowledge`、`ai/evals`、`ai/feedback`、`ai/audit`、`ai/prompts` 已对齐同等级 OpenAPI 文档质量。
- `DOC-C4` is closed; `monitor/*`、`tools/*` 与 `system` 辅助接口现在也对齐了同等级 OpenAPI 文档质量。
- `CRD-C1` is closed; `system/roles` now exposes full CRUD, audited write forms, and protected seeded-role guardrails.
- `CRD-C2` is closed; `system/permissions` now exposes full CRUD, audited write forms, and protected seeded-permission guardrails.
- `CRD-C3` is closed; `system/menus` now exposes full CRUD, audited write forms, and protected parent-chain guardrails.
- `CRD-C4` is closed; `ai/knowledge` now exposes document-level CRUD, audited reindex semantics, and the same contract-first OpenAPI baseline.
- `CRD-C5` is closed; `ai/audit` and `ai/feedback` now expose detail routes with linked governance context and the same contract-first OpenAPI baseline.
- `CRD-C6` is closed; `ai/evals` now exposes detail and run-command contracts, and `ai/prompts` now exposes detail contract with the same contract-first OpenAPI baseline.
- `CRD-C7` is closed; `ai/evals` now exposes run-detail inspection with sample-level scoring detail and the same contract-first OpenAPI baseline.
- `CRD-C8` is closed; `ai/prompts` now exposes version-compare contract with text diff and governance diff summary under the same contract-first OpenAPI baseline.
- `CRD-C9` is closed; `ai/prompts` now exposes release-history contract with ordered version timeline and active-version summary under the same contract-first OpenAPI baseline.
- `CRD-C10` is closed; `ai/prompts` now exposes rollback-chain inspection with rollback source-target lineage under the same contract-first OpenAPI baseline.
- `CRD-C11` is closed; `ai/prompts` now exposes release-approval audit with version-scoped operation-log trail and requestInfo context under the same contract-first OpenAPI baseline.
- `GOV-C1` is closed; `ai/prompts` now exposes prompt-key-scoped failure audit with rejection vs exception split and failure-path operation logging.
- `IAM-C1` is closed; auth middleware, permission loading, seeded bootstrap users, monitor online sessions, and `system/users` write paths now prefer stable `users.auth_user_id`, while legacy email-linked rows are backfilled on first authenticated access.
- `UI-C1` is closed; the repository now has a dedicated web UI design contract, a neutral control-console token baseline, a left-nav/topbar shell, a collapsible Copilot workspace, and compact data-surface headers.
- `UI-C2` is closed; `system/users`, `system/roles`, `system/permissions`, and `system/menus` now use action bars plus dialog-based create/edit flows instead of keeping long forms expanded on the page.
- `UI-C3` is closed; `monitor/server`, `monitor/online`, `ai/audit`, and `ai/evals` now use shared status-first workbench layouts instead of generic list-page framing.
- `UI-C4` is closed; `ai/knowledge` now uses a workbench-style split layout with dialog-based write flows, and Copilot suggestions now adapt to the knowledge route.
- `UI-C5` is closed; Copilot now exposes route-specific assistant briefs and prompt suggestions for `ai/knowledge`, `ai/evals`, and `ai/audit` instead of a single generic AI sidebar.
- `UI-C6` is closed; dashboard routes now share loading/error/not-found shells, CRUD pages now use accessible feedback banners, and `reports`, `system/logs`, `ai/knowledge`, `ai/evals`, and `ai/audit` now expose page-level Copilot handoff cards plus explicit empty-state treatment.
- `UI-C7` is closed; dense admin tables now sit inside keyboard-focusable responsive regions, pagination and filter controls expose stronger semantics, and dialog-driven CRUD surfaces now expose clearer trigger/form labeling.
- `UI-C8` is closed; destructive actions now flow through a shared confirmation dialog, sticky table headers are enforced at the shared table primitive, and remaining operator write surfaces expose stronger native validation hints.
- `UI-C9` is closed; directory pages now expose local bulk-selection, keyboard shortcuts for search/new/select-clear, and denser operator toolbars without changing the underlying contract-first data flow.
- `UI-C10` is closed; directory pages now expose row-level quick preview context, structured handoff export dialogs, and batch-safe Markdown/JSON copy flows scoped to the current selection set.
- `UI-C11` is closed; directory pages now persist local saved views, render denser active-filter chips, and expose inline row mutation feedback after successful write actions.
- `UI-C12` is closed; directory workbenches now expose local batch result feedback, safety confirmation before clearing staged selections or deleting saved views, and denser triage shortcuts including copy and preview stepping.
- queued plans after completed optimization programs:
  - Plan 4 `AI Governance Deepening` -> `GOV-C2`
  - Plan 5 `Productionization and Operations Maturity` -> `OPS-C1`
- `UI-C13` is closed; `ai/evals` and `ai/audit` now expose denser governance review queues and persisted evidence timelines.
- `UI-C14` is closed; `monitor/server` and `monitor/online` now prioritize incident-like signals instead of acting as plain status tables.
- `UI-C15` is closed; Copilot now exposes route-specific brief/suggestion/handoff contracts for `monitor/server` and `monitor/online` in addition to existing AI routes.
- Plan 1 `Web UI/UX Hardening` is complete.
- `IAM-C2` is closed; steady-state authenticated flows now resolve RBAC only through stable `auth_user_id`, while legacy email-linked rows must go through explicit principal repair.
- `IAM-C3` is closed; operators now have explicit principal repair candidate listing and repair actions instead of hidden sign-in side effects.
- `IAM-C4` is closed; permission regression coverage now verifies resource, field, conditional, and inverted-rule serialization and enforcement.
- `IAM-C5` is closed; permission impact and audit inspection contracts now expose affected roles, affected users, and permission-scoped audit trails.
- Plan 3 `Identity and Permission Hardening` is complete; the next recommended backlog item is `GOV-C2` under Plan 4 `AI Governance Deepening`.

Auto-unlock rules:

- If P2-T1 -> `done`
  - mark P2-T2 as `ready`
- If P2-T3 -> `done`
  - mark P2-T4 as `ready` because P2-T2 is already `done`
- If P2-T4 -> `done`
  - mark P2-T5 as `ready`
- If P2-T5 -> `done`
  - mark P2-T6 as `ready`
- If P2-T6 -> `done`
  - mark P3-T1 as `ready`
- If P3-T1 -> `done`
  - mark P3-T2 as `ready`
- If P3-T2 -> `done`
  - mark P3-T3 as `ready`
  - mark P3-T4 as `ready`
- If P3-T3 -> `done`
  - mark P3-T5 as `ready`
- If P3-T1 -> `done`
  - mark P3-T6 as `ready`
- If P3-T4 -> `done`
  - mark P3-T7 as `ready`
- If P3-T5 -> `done`
  - keep P4-T5 blocked until `P4-T1` is also `done`
- If P4-F1 -> `done`
  - mark P4-T3 as `ready`
  - mark P4-T4 as `ready`
- If P5-T5 -> `done`
  - mark P6-T1 as `ready`
  - mark P6-T2 as `ready`
  - keep P6-T3 blocked until `P6-F1` is also `done`
- If P6-F1 -> `done`
  - mark P6-T3 as `ready`
- If P6-T2 -> `done`
  - keep P6-T4 blocked until `P6-T3` is also `done`
- If P6-T3 -> `done`
  - mark P6-T4 as `ready` because `P6-T2` is already `done`
- If P6-T4 -> `done`
  - mark P6-T5 as `ready`
- If P6-C1 -> `done`
  - mark P6-C2 as `ready`
  - mark P6-C3 as `ready`

Temporary Phase 3 correction rules:

- If P3-F1 -> `done`
  - mark P3-F2 as `ready`
- If P3-F2 -> `done`
  - mark P3-T3 as `ready`
  - mark P3-T4 as `ready`
  - mark P3-T6 as `ready`

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
- `pnpm test`
- `pnpm --filter @ai-native-os/api dev`
- `pnpm --filter @ai-native-os/web dev`
- `curl -sS http://localhost:3000`

## 6. Blockers

Active phase blockers:

- none

Residual follow-up risks:

- Better Auth principal binding is now hardened to stable `auth_user_id`, but legacy rows still rely on first-access backfill; a future data-cleanup pass should eliminate residual null bindings and remove the compatibility path entirely.
- GitHub Actions, Vercel, Cloudflare, and Trigger deploy paths are repository-ready, but platform-side secrets, authenticated sessions, and environment provisioning remain external operational responsibilities.
- The current Docker topology keeps `jobs` health internal to compose; release drills now validate it through `docker compose exec`, but there is still no public jobs endpoint by design.
- Telemetry backends remain `unknown` until real `SENTRY_DSN` and/or `OTEL_EXPORTER_OTLP_ENDPOINT` values are configured.
- Production AI features still require real upstream credentials such as `OPENAI_API_KEY`, and Copilot/AI dependencies continue to carry upstream peer-warning risk.

Follow-up priority after current E2E remediation sprint:

1. Additional CRUD and documentation-template rollout beyond `system/users`, `system/roles`, `system/permissions`, `system/menus`, and current AI contract surfaces
2. Web UI / UX hardening for cross-surface state handling, accessibility, and page-level assistant handoff patterns
3. External platform credential and live deploy verification

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

### DOC-C2 Roll out the OpenAPI documentation template to `system/roles` and `system/permissions`
- Status: done
- Changed files:
  - `Status.md`
  - `packages/shared/src/schemas/business-api.ts`
  - `apps/api/src/routes/system/roles.ts`
  - `apps/api/src/routes/system/permissions.ts`
  - `apps/api/src/routes/contract-first.test.ts`
- Commands:
  - `pnpm biome check --write packages/shared/src/schemas/business-api.ts apps/api/src/routes/system/roles.ts apps/api/src/routes/system/permissions.ts apps/api/src/routes/contract-first.test.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Promoted the `system/users` OpenAPI documentation pattern into `system/roles` and `system/permissions`, adding field-level Chinese descriptions, examples, response titles, and richer list-contract metadata for Scalar consumers.
  - Localized the route-level OpenAPI summaries and descriptions for both resources so management semantics are readable directly from the docs instead of exposing thin English placeholder text.
  - Added contract tests that assert query parameter descriptions, response schema titles, and key field-level metadata for role and permission entries.
- Unlocked tasks:
  - none
- Notes:
  - `system/users` / `system/roles` / `system/permissions` now share the same documentation baseline; future rollout should target `menus` and AI contract surfaces next.

### E2E-S3-T1 Finalize end-to-end regression script and release-trust hardening
- Status: done
- Changed files:
  - `Status.md`
  - `package.json`
  - `docs/release-playbook.md`
  - `apps/api/src/lib/release/e2e-regression.ts`
  - `apps/api/src/lib/release/e2e-regression.cli.ts`
  - `apps/api/src/lib/release/e2e-regression.test.ts`
- Commands:
  - `pnpm biome check --write apps/api/src/lib/release/e2e-regression.ts apps/api/src/lib/release/e2e-regression.cli.ts apps/api/src/lib/release/e2e-regression.test.ts package.json`
  - `pnpm biome check --write apps/api/src/lib/release/e2e-regression.ts`
  - `pnpm biome check --write apps/api/src/lib/release/e2e-regression.cli.ts package.json`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `E2E_RELEASE_SMOKE_MODE=skip pnpm e2e:final`
- Result:
  - Added a repository-level final regression bundle that executes the standard hardening sequence in one command: `lint -> typecheck -> db:migrate -> db:seed -> bootstrap login -> viewer/admin/editor/super_admin capability checks -> MCP workflow execution -> AI audit verification -> test -> build -> release smoke`.
  - Fixed the CLI so it runs inside the `@ai-native-os/api` package context for path-alias compatibility while still spawning child commands from the repository root, making `pnpm e2e:final` a stable one-click entrypoint.
  - Verified the bundle end-to-end with `E2E_RELEASE_SMOKE_MODE=skip`; the summary passed with `releaseTrust=medium`, accurately reflecting that final validation reused prior `release:smoke` evidence instead of re-running the live endpoint probe in this invocation.
- Unlocked tasks:
  - `DOC-C2`
- Notes:
  - The final regression script intentionally distinguishes repository proof from live deployment proof. If `release:smoke` is included in a future invocation, the same summary can elevate trust from `medium` to `high`.

### E2E-S2-T3 Align AI agent and workflow capability documentation with dynamic discovery rules
- Status: done
- Changed files:
  - `Status.md`
  - `docs/ai-agent-design.md`
  - `docs/architecture.md`
- Commands:
  - `pnpm biome check --write docs/ai-agent-design.md docs/architecture.md`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Updated the AI design and architecture documents so MCP wrapper exposure, Copilot bridge discovery, and runtime summary semantics now explicitly follow the same principal-scoped capability filtering rules as the implementation.
  - Replaced stale static exposure language with the current `minimum-safe` runtime contract, including role-based examples for `viewer/admin/editor/super_admin` and the distinction between registered vs enabled agent surfaces.
- Unlocked tasks:
  - `E2E-S3-T1`
- Notes:
  - The docs now intentionally describe dynamic discovery as the current baseline; future Agent / Workflow additions must update both the runtime registry and these capability tables together.

### E2E-S2-T2 Reconcile MCP and Copilot discovery with executable capability surface
- Status: done
- Changed files:
  - `Status.md`
  - `apps/api/src/copilotkit/runtime.ts`
  - `apps/api/src/mastra/discovery.ts`
  - `apps/api/src/mastra/mcp/integration.test.ts`
  - `apps/api/src/mastra/mcp/server.ts`
- Commands:
  - `pnpm biome check --write apps/api/src/mastra/discovery.ts apps/api/src/mastra/mcp/server.ts apps/api/src/copilotkit/runtime.ts apps/api/src/mastra/mcp/integration.test.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Added a shared Mastra discovery helper so MCP wrapper visibility and Copilot agent discovery now both derive from the current principal's actual RBAC capability surface.
  - Hid `run_report_schedule` from `admin`, kept it visible and executable for `editor` and `super_admin`, and proved the parity through MCP integration tests that execute the discovered workflow over the external MCP client.
  - Tightened Copilot runtime construction to only mount agents that the current principal can actually use, preventing a new discovery-vs-execution drift at the bridge layer.
- Unlocked tasks:
  - `E2E-S2-T3`
- Notes:
  - Agent availability is now intentionally conservative: a Copilot agent is only exposed when the current principal satisfies the minimum permissions for every Tool that agent depends on.

### P6-C3 Reconcile AI runtime coverage with design docs
- Status: done
- Changed files:
  - `Status.md`
  - `apps/api/src/index.test.ts`
  - `apps/api/src/mastra/index.ts`
  - `apps/api/src/mastra/registry.ts`
  - `apps/api/src/mastra/runtime-coverage.ts`
  - `docs/ai-agent-design.md`
  - `docs/architecture.md`
- Commands:
  - `pnpm biome check --write apps/api/src/mastra/runtime-coverage.ts apps/api/src/mastra/registry.ts apps/api/src/mastra/index.ts apps/api/src/index.test.ts docs/ai-agent-design.md docs/architecture.md Status.md`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Added a single-source runtime coverage manifest for Mastra, explicitly distinguishing the current `minimum-safe` runtime from future design-blueprint Agent / Workflow expansions.
  - Hardened startup by asserting that the live registry matches the documented implemented inventory, and extended the runtime summary route to expose the active coverage mode plus planned expansions.
  - Updated `docs/ai-agent-design.md` and `docs/architecture.md` so the current runtime baseline is now explicit, while preserving the fuller target blueprint as planned scope instead of falsely implying it is already registered.
- Unlocked tasks:
  - none
- Notes:
  - This task intentionally reconciles documentation to the current safe runtime instead of expanding new Agent / Workflow implementations inside a Phase 6 deployment correction.

### P6-C2 Fill remaining contract-first API skeleton gaps
- Status: done
- Changed files:
  - `Status.md`
  - `apps/api/src/routes/contract-first.test.ts`
  - `apps/api/src/routes/index.ts`
  - `apps/api/src/routes/system/config.ts`
  - `apps/api/src/routes/system/dicts.ts`
  - `apps/api/src/routes/tools/gen.ts`
  - `apps/api/src/routes/tools/jobs.ts`
  - `apps/jobs/package.json`
  - `apps/jobs/src/runtime.ts`
  - `packages/shared/src/index.ts`
  - `packages/shared/src/runtime/jobs.ts`
  - `packages/shared/src/schemas/business-api.ts`
  - `pnpm-lock.yaml`
- Commands:
  - `pnpm biome check --write apps/api/src/routes/system/dicts.ts apps/api/src/routes/system/config.ts apps/api/src/routes/tools/gen.ts apps/api/src/routes/tools/jobs.ts apps/api/src/routes/index.ts apps/api/src/routes/contract-first.test.ts apps/jobs/src/runtime.ts apps/jobs/package.json packages/shared/src/schemas/business-api.ts packages/shared/src/runtime/jobs.ts packages/shared/src/index.ts Status.md`
  - `pnpm install`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Added the missing contract-first skeleton routes required by `docs/api-conventions.md`: `system/dicts`, `system/config`, `tools/gen`, and `tools/jobs`.
  - Extended the shared business API schema package with the corresponding input/output contracts, plus a shared Trigger.dev job catalog reused by both `api` and `jobs` to avoid a package dependency cycle.
  - Added contract tests proving the new paths appear in OpenAPI and are consumable through authenticated smoke requests for `viewer` and `super_admin`.
- Unlocked tasks:
  - `P6-C3`
- Notes:
  - The new list endpoints defensively normalize missing raw HTTP input through schema defaults plus handler-level parsing because direct smoke requests do not always arrive with an oRPC input envelope.

### P6-C1 Align deployment status contract and implement API rate limiting
- Status: done
- Changed files:
  - `Plan.md`
  - `Status.md`
  - `apps/api/src/index.ts`
  - `apps/api/src/middleware/rate-limit.test.ts`
  - `apps/api/src/middleware/rate-limit.ts`
  - `docs/environment-matrix.md`
  - `docs/release-playbook.md`
- Commands:
  - `pnpm biome check --write apps/api/src/index.ts apps/api/src/middleware/rate-limit.ts apps/api/src/middleware/rate-limit.test.ts Plan.md Status.md docs/environment-matrix.md docs/release-playbook.md`
  - `pnpm db:migrate`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Corrected the Phase 6 status contract by aligning the deployment matrix with the actual validated topology: `Mode C` is now documented as validated, and the matrix explicitly distinguishes repository-level completion from platform-account-level remote deploy verification.
  - Added a production-default Hono rate limiting middleware with stricter auth-path buckets, health-probe exemptions, and dedicated unit tests proving `429` behavior. The release playbook now treats rate limiting as a real implemented control rather than a missing baseline.
- Unlocked tasks:
  - `P6-C2`
  - `P6-C3`
- Notes:
  - The current limiter is an in-process best-effort implementation. It closes the missing baseline from `docs/architecture.md`, but cross-instance shared quotas remain a future hardening concern if the deployment topology scales horizontally.

### P6-T5 Complete security, backup, rollback, and smoke-check playbooks
- Status: done
- Changed files:
  - `.gitignore`
  - `package.json`
  - `apps/api/src/lib/release-playbook-contract.test.ts`
  - `apps/api/src/lib/release/backup-verify.cli.ts`
  - `apps/api/src/lib/release/backup-verify.test.ts`
  - `apps/api/src/lib/release/backup-verify.ts`
  - `apps/api/src/lib/release/smoke-check.cli.ts`
  - `apps/api/src/lib/release/smoke-check.test.ts`
  - `apps/api/src/lib/release/smoke-check.ts`
  - `docs/deployment-guide.md`
  - `docs/environment-matrix.md`
  - `docs/release-playbook.md`
  - `Status.md`
- Commands:
  - `pnpm biome check --write apps/api/src/lib/release/smoke-check.ts apps/api/src/lib/release/smoke-check.test.ts apps/api/src/lib/release-playbook-contract.test.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm infra:up`
  - `pnpm db:migrate`
  - `docker exec ai-native-os-postgres pg_dump -U postgres -d ai_native_os -Fc > backups/ai-native-os-smoke.dump`
  - `shasum -a 256 backups/ai-native-os-smoke.dump > backups/ai-native-os-smoke.dump.sha256`
  - `BACKUP_FILE=./backups/ai-native-os-smoke.dump CHECKSUM_FILE=./backups/ai-native-os-smoke.dump.sha256 BACKUP_MAX_AGE_HOURS=24 pnpm release:backup:verify`
  - `BETTER_AUTH_SECRET=<smoke-secret> docker compose -f docker/docker-compose.prod.yml --profile ops run --rm migrate`
  - `BETTER_AUTH_SECRET=<smoke-secret> docker compose -f docker/docker-compose.prod.yml up --build -d`
  - `APP_URL=http://localhost:8080 API_URL=http://localhost:8080 pnpm release:smoke`
  - `BETTER_AUTH_SECRET=<smoke-secret> docker compose -f docker/docker-compose.prod.yml exec -T jobs node -e "fetch('http://127.0.0.1:3040/health')..."`
  - `BETTER_AUTH_SECRET=<smoke-secret> docker compose -f docker/docker-compose.prod.yml down -v`
- Result:
  - Added repository-backed release hardening assets: a smoke checker and backup verifier CLI, contract tests, and a full release playbook covering security preflight, backup validation, rollback rules, and release drill records. The smoke checker now reports probe-specific failure context instead of surfacing raw `fetch failed`, and the self-hosted playbook has been corrected to validate `jobs` through a compose-internal probe rather than by incorrectly assuming `localhost:3040` is exposed.
  - Real release rehearsal passed on the current Docker topology: backup artifact verification succeeded, `pnpm release:smoke` passed against the nginx entrypoint at `http://localhost:8080`, and the internal `jobs` health probe returned `@ai-native-os/jobs` from inside the container network.
- Unlocked tasks:
  - none
- Notes:
  - This task intentionally keeps `jobs` off the public host network in self-hosted mode; release readiness now documents and verifies the safer internal health check path instead of widening exposure for convenience.
  - Final QA passed after replaying the standard local test prerequisites in the documented order: `pnpm infra:up` -> wait for PostgreSQL healthy -> `pnpm db:migrate` -> `pnpm test`.

### P6-F1 Align worker deployment runtime and binding contract
- Status: done
- Changed files:
  - `apps/api/src/lib/deployment-contract.test.ts`
  - `apps/worker/package.json`
  - `apps/worker/src/contracts.ts`
  - `apps/worker/src/index.test.ts`
  - `apps/worker/src/index.ts`
  - `apps/worker/src/queues/cache-invalidation.ts`
  - `apps/worker/src/queues/notification.ts`
  - `apps/worker/src/r2/upload.ts`
  - `apps/worker/tsconfig.json`
  - `docs/deployment-guide.md`
  - `docs/environment-matrix.md`
  - `pnpm-lock.yaml`
  - `Status.md`
- Commands:
  - `pnpm install`
  - `pnpm biome check --write <changed-files>`
  - `pnpm --filter @ai-native-os/worker build`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Replaced the worker skeleton with a real Cloudflare-compatible runtime contract: the package now exports a Worker entrypoint with a read-only `GET /health` smoke path, validates and processes `notifications` / `cache-invalidation` queue batches, and persists queue receipts into `R2_BUCKET`. The repository also gained worker package tests and an explicit deployment contract update so Phase 6 no longer treats `apps/worker` as an unimplemented surface.
- Unlocked tasks:
  - `P6-T3`
- Notes:
  - `P6-T3` still owns `wrangler` config, platform bindings declaration, and any real staging deployment smoke.

### P6-T3 Implement Vercel, Cloudflare, and Trigger deployment configs
- Status: done
- Changed files:
  - `.gitignore`
  - `.env.example`
  - `apps/api/package.json`
  - `apps/api/src/index.ts`
  - `apps/api/wrangler.toml`
  - `apps/jobs/package.json`
  - `apps/jobs/trigger.config.ts`
  - `apps/web/next.config.ts`
  - `apps/web/package.json`
  - `apps/web/src/lib/env.test.ts`
  - `apps/web/src/lib/env.ts`
  - `apps/web/vercel.json`
  - `apps/worker/package.json`
  - `apps/worker/wrangler.toml`
  - `biome.json`
  - `docs/deployment-guide.md`
  - `docs/environment-matrix.md`
  - `Status.md`
- Commands:
  - `pnpm biome check --write <changed-files>`
  - `pnpm infra:up`
  - `pnpm db:migrate`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm --filter @ai-native-os/worker deploy:cloudflare:staging:dry-run`
  - `pnpm --filter @ai-native-os/api deploy:cloudflare:staging:dry-run`
  - `TRIGGER_PROJECT_REF=proj_replace_me pnpm --filter @ai-native-os/jobs deploy:trigger:staging:dry-run`
  - `vercel project add ai-native-os-web-staging --scope hexuntaos-projects-6cd76264`
  - `vercel link --yes --project ai-native-os-web-staging --scope hexuntaos-projects-6cd76264`
  - `vercel pull --yes --environment=preview --cwd ./apps/web`
  - `vercel build --scope hexuntaos-projects-6cd76264 -A apps/web/vercel.json`
  - `vercel deploy --prebuilt --scope hexuntaos-projects-6cd76264 -A apps/web/vercel.json`
  - `curl https://ai-native-os-web-staging.vercel.app/healthz`
  - `curl https://ai-native-os-web-staging.vercel.app/`
  - `curl -X POST https://ai-native-os-web-staging.vercel.app/auth/sign-in`
  - `vercel project remove ai-native-os --scope hexuntaos-projects-6cd76264`
- Result:
  - Added repository-backed Vercel / Cloudflare / Trigger deployment descriptors and package scripts. Cloudflare `api` and `worker` both pass `wrangler deploy --dry-run --env staging`, proving the current codebase can at least bundle and resolve bindings for Workers deployment. `apps/api` also now exports the Hono app as a Worker entrypoint while retaining the Node bootstrap path used in Docker.
  - Repaired the local QA gate drift discovered during `P6-T3`: `@ai-native-os/api` tests now re-apply RBAC seed data before execution, so a fresh PostgreSQL volume no longer causes contract-first/API permission tests to fail merely because seeded roles were missing.
  - Completed a real Vercel staging/preview deployment for `apps/web` after correcting project settings to monorepo form (`framework=nextjs`, `rootDirectory=apps/web`, `sourceFilesOutsideRootDirectory=true`, `autoExposeSystemEnvs=true`). The deployed shell passed live smoke checks at `https://ai-native-os-web-staging.vercel.app`, including `/healthz`, the landing page HTML, and a non-500 sign-in POST path.
- Unlocked tasks:
  - `P6-T4`
- Notes:
  - Local QA is green again under the documented dev infra baseline: `pnpm infra:up`, `pnpm db:migrate`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass.
  - Cloudflare real remote deploy and Trigger.dev authenticated deploy are still pending follow-up, but they no longer block `P6-T3` because the task validation only requires at least one real staging path.
  - An accidental temporary Vercel project named `ai-native-os` was created during root-link experiments and removed in the same task to avoid leaving unrelated platform state behind.

### P6-T4 Implement GitHub Actions CI/CD workflows
- Status: done
- Changed files:
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy-production.yml`
  - `.github/workflows/deploy-staging.yml`
  - `.github/workflows/reusable-deploy.yml`
  - `.github/workflows/reusable-quality-gate.yml`
  - `apps/api/src/lib/deployment-contract.test.ts`
  - `apps/api/src/lib/github-actions-contract.test.ts`
  - `apps/web/package.json`
  - `docs/deployment-guide.md`
  - `docs/environment-matrix.md`
  - `Status.md`
- Commands:
  - `pnpm biome check --write .github/workflows/*.yml apps/api/src/lib/github-actions-contract.test.ts apps/api/src/lib/deployment-contract.test.ts apps/web/package.json docs/deployment-guide.md docs/environment-matrix.md Status.md`
  - `GOBIN=$(pwd)/.tmp-bin go install github.com/rhysd/actionlint/cmd/actionlint@latest && ./.tmp-bin/actionlint`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm --filter @ai-native-os/api deploy:cloudflare:staging:dry-run`
  - `pnpm --filter @ai-native-os/worker deploy:cloudflare:staging:dry-run`
  - `pnpm --filter @ai-native-os/web build:vercel:prod`
- Result:
  - Added a reusable GitHub Actions quality gate and deploy pipeline set. PR / main CI now converges on one shared validation chain (`db:migrate` -> `lint` -> `typecheck` -> `test` -> `build` + Cloudflare dry-run checks). Staging / production deploy entrypoints are now modeled as environment-scoped wrappers over a single reusable deploy workflow, with Vercel web deploy as the mandatory automated path and Cloudflare / Trigger deploys guarded behind explicit inputs plus deploy-secret preflight checks.
  - Added repository-level regression coverage for the workflow contract and extended the deployment contract documentation to include the non-interactive `TRIGGER_ACCESS_TOKEN` requirement.
- Unlocked tasks:
  - `P6-T5`
- Notes:
  - The GitHub Actions workflows assume GitHub Environments provide `vars/secrets`, but they do not provision platform runtime secrets into Vercel / Cloudflare / Trigger on your behalf.
  - External authenticated publish sessions for Cloudflare / Trigger are still environment-level prerequisites, not repository-code gaps.

### P6-T2 Implement Docker packaging and self-hosted runtime topology
- Status: done
- Changed files:
  - `.dockerignore`
  - `apps/api/package.json`
  - `apps/jobs/package.json`
  - `apps/jobs/src/index.ts`
  - `apps/jobs/src/runtime.ts`
  - `apps/jobs/src/server.test.ts`
  - `apps/jobs/src/server.ts`
  - `apps/web/src/app/healthz/route.test.ts`
  - `apps/web/src/app/healthz/route.ts`
  - `docker/Dockerfile.api`
  - `docker/Dockerfile.jobs`
  - `docker/Dockerfile.web`
  - `docker/docker-compose.prod.yml`
  - `docker/nginx.conf`
  - `docs/deployment-guide.md`
  - `docs/environment-matrix.md`
  - `Status.md`
- Commands:
  - `pnpm biome check --write <changed-files>`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `BETTER_AUTH_SECRET=<smoke-secret> docker compose -f docker/docker-compose.prod.yml config`
  - `BETTER_AUTH_SECRET=<smoke-secret> docker compose -f docker/docker-compose.prod.yml --profile ops run --rm migrate`
  - `BETTER_AUTH_SECRET=<smoke-secret> docker compose -f docker/docker-compose.prod.yml up --build -d`
  - `curl http://localhost:8080/health`
  - `curl http://localhost:8080/healthz`
  - `BETTER_AUTH_SECRET=<smoke-secret> docker compose -f docker/docker-compose.prod.yml down -v`
- Result:
  - Added a repository-backed self-hosted runtime topology: `web`, `api`, and `jobs` now have explicit container entrypoints, `jobs` exposes a minimal `/health` runtime instead of remaining an unverifiable Trigger-only shell, `web` exposes `/healthz` for stable readiness probes, and the repository now contains Dockerfiles, a production compose topology, and nginx routing that preserves Next.js-owned same-origin `/api/*` handlers while forwarding the real backend contract surface to Hono.
- Unlocked tasks:
  - `P6-T4` remains blocked until `P6-T3` is also `done`
- Notes:
  - `docker/docker-compose.prod.yml` intentionally requires `BETTER_AUTH_SECRET`; this task did not weaken production auth defaults to make smoke tests easier.
  - `P6-T3` still owns Vercel / Cloudflare / Trigger platform deployment descriptors and staging publish validation.

### P6-T1 Finalize environment matrix and secret contract
- Status: done
- Changed files:
  - `.env.example`
  - `Plan.md`
  - `Status.md`
  - `apps/api/src/lib/deployment-contract.test.ts`
  - `docs/deployment-guide.md`
  - `docs/environment-matrix.md`
- Commands:
  - `pnpm biome check --write <changed-files>`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Finalized the current repository-backed environment contract by shrinking `.env.example` to real runtime inputs, adding a dedicated environment matrix that separates current runtime variables from deploy-only credentials and Cloudflare bindings, and wiring automated tests so the repository fails if runtime code starts reading undocumented environment variables. The deployment guide now explicitly points to the matrix as the source of truth for current support boundaries instead of implying that target-state serverless settings are already wired.
- Unlocked tasks:
  - `P6-F1`
- Notes:
  - At the time of `P6-T1`, `P6-F1` was introduced as a corrective task because `apps/worker` was still a skeleton and would otherwise make `P6-T3` dishonest.
  - Mode A serverless remains target-state only until worker runtime and Cloudflare deploy config are actually implemented.

### P5-T5 Implement prompt versioning and release gates for AI changes
- Status: done
- Changed files:
  - `apps/api/src/index.ts`
  - `apps/api/src/routes/ai/prompts.ts`
  - `apps/api/src/routes/contract-first.test.ts`
  - `apps/api/src/routes/index.ts`
  - `packages/db/src/ai/prompt-versions.ts`
  - `packages/db/src/ai/prompt-versions.test.ts`
  - `packages/db/src/index.ts`
  - `packages/db/src/migrations/0006_clean_calypso.sql`
  - `packages/db/src/migrations/meta/0006_snapshot.json`
  - `packages/db/src/migrations/meta/_journal.json`
  - `packages/db/src/schema/ai-prompt-versions.ts`
  - `packages/db/src/schema/index.ts`
  - `packages/shared/src/index.ts`
  - `packages/shared/src/schemas/ai-prompts.ts`
  - `Status.md`
- Commands:
  - `pnpm biome check --write <changed-files>`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:generate`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:migrate`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:seed`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
- Result:
  - Added end-to-end prompt-governance infrastructure: shared prompt schemas, `ai_prompt_versions` persistence model and migration, release-gate evaluation service (requires completed eval evidence + threshold checks), and API routes for list/create/attach-evidence/activate/rollback under `/api/v1/ai/prompts*`. Contract-first compatibility routes and tests now verify that activation fails without eval evidence and succeeds after evidence attachment.
- Unlocked tasks:
  - `P6-T1`
  - `P6-T2`
  - `P6-T3`
- Notes:
  - Prompt release gates currently reuse existing `manage:AiKnowledge` authority because RBAC subjects do not yet define a dedicated `AiPrompt` resource.
  - Release evidence is bound to persisted eval runs, so governance decisions are now database-verifiable instead of runtime-memory-only.

### P5-T4 Implement Mastra Evals datasets, scorers, and runners
- Status: done
- Changed files:
  - `apps/api/package.json`
  - `apps/api/src/mastra/evals/index.ts`
  - `apps/api/src/mastra/evals/registry.ts`
  - `apps/api/src/mastra/evals/report-schedule.ts`
  - `apps/api/src/mastra/evals/runner.ts`
  - `apps/api/src/mastra/evals/runner.test.ts`
  - `apps/api/src/mastra/evals/types.ts`
  - `apps/api/src/mastra/index.ts`
  - `apps/api/src/routes/ai/evals.ts`
  - `apps/api/src/routes/contract-first.test.ts`
  - `apps/jobs/src/index.ts`
  - `apps/jobs/src/index.test.ts`
  - `apps/jobs/src/trigger/ai-eval-runner.ts`
  - `apps/web/src/app/(dashboard)/ai/evals/page.tsx`
  - `packages/db/src/ai/evals.ts`
  - `packages/db/src/ai/evals.test.ts`
  - `packages/db/src/index.ts`
  - `packages/db/src/migrations/0005_wakeful_the_hunter.sql`
  - `packages/db/src/migrations/meta/0005_snapshot.json`
  - `packages/db/src/migrations/meta/_journal.json`
  - `packages/db/src/schema/ai-eval-run-items.ts`
  - `packages/db/src/schema/ai-eval-runs.ts`
  - `packages/db/src/schema/index.ts`
  - `packages/shared/src/index.ts`
  - `packages/shared/src/schemas/ai-evals.ts`
  - `packages/shared/src/schemas/business-api.ts`
  - `Status.md`
- Commands:
  - `pnpm biome check --write <changed-files>`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:generate`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:migrate`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:seed`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
- Result:
  - Added a full Phase 5 eval chain: contract-first `GET /api/v1/ai/evals` now returns real eval-suite rows and persisted run summaries; the API now includes a dedicated `mastra/evals` module with deterministic scorers, dataset registration, and suite runners; and jobs now include `ai-eval-runner` as a scheduled Trigger.dev task. Persisted run data is stored in new Postgres tables `ai_eval_runs` and `ai_eval_run_items` and is exercised by API, DB, and jobs tests. The web eval page was upgraded from skeleton text to live run metrics (`score`, `last run`, `run status`) without bypassing existing auth/RBAC boundaries.
- Unlocked tasks:
  - `P5-T5`
- Notes:
  - Eval datasets are initialized in a dedicated in-process Mastra eval runtime store and can be rehydrated by suite bootstrap. Governance-critical experiment truth and release evidence are persisted in Postgres.
  - Scorers are deterministic rule-based scorers in this phase to keep CI stable and avoid coupling eval gates to external model-provider availability.

### P5-T3 Implement AI feedback capture and human override tracking
- Status: done
- Changed files:
  - `apps/api/src/index.test.ts`
  - `apps/api/src/index.ts`
  - `apps/api/src/mastra/tools/ai-audit-log-search.ts`
  - `apps/api/src/routes/ai/audit.ts`
  - `apps/api/src/routes/ai/feedback.ts`
  - `apps/api/src/routes/contract-first.test.ts`
  - `apps/api/src/routes/index.ts`
  - `apps/api/src/routes/system/ai-audit-logs.ts`
  - `apps/web/src/app/(dashboard)/ai/audit/page.tsx`
  - `apps/web/src/app/api/ai/feedback/route.ts`
  - `apps/web/src/components/ai/ai-feedback-dialog.tsx`
  - `packages/db/src/ai/audit-logs.ts`
  - `packages/db/src/ai/feedback.test.ts`
  - `packages/db/src/ai/feedback.ts`
  - `packages/db/src/index.ts`
  - `packages/db/src/migrations/0004_dear_redwing.sql`
  - `packages/db/src/migrations/meta/0004_snapshot.json`
  - `packages/db/src/migrations/meta/_journal.json`
  - `packages/db/src/schema/ai-audit-logs.ts`
  - `packages/db/src/schema/ai-feedback.ts`
  - `packages/db/src/schema/index.ts`
  - `packages/shared/src/index.ts`
  - `packages/shared/src/schemas/ai-feedback.ts`
  - `packages/shared/src/schemas/ai-tools.ts`
  - `packages/shared/src/schemas/business-api.ts`
  - `packages/ui/src/index.ts`
  - `Status.md`
- Commands:
  - `pnpm biome check --write <changed-files>`
  - `pnpm typecheck`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:generate`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:migrate`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:seed`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Result:
  - Added an end-to-end AI feedback and human-override pipeline without bypassing the existing auth, RBAC, or audit boundaries. The database now persists operator feedback in `ai_feedback` and marks linked audit rows with `human_override` when a rejection, edit, or override occurs. The API exposes documented contract-first `GET/POST /api/v1/ai/feedback` routes, converts invalid audit-log references into `BAD_REQUEST` instead of generic 500s, and records matching `operation_logs` entries so HITL actions are auditable. The AI audit surfaces in both API and web now show feedback counts, latest user action, and override state, and the dashboard audit page provides a same-origin feedback dialog instead of introducing a new business-logic path in `apps/web/app/api`. Static checks, database migration, seed, tests, and production build all passed.
- Unlocked tasks:
  - none
- Notes:
  - This task intentionally captures feedback at the existing audit-log boundary rather than inventing prompt-level or message-level identifiers. That keeps the implementation aligned with the current Phase 3/4 runtime surface and avoids false precision ahead of eval and prompt-governance work.
  - Human override tracking is now represented at the tool-audit level, but formal approval chains, scorer-driven evals, and prompt release governance remain separate Phase 5 tasks.

### P5-T2 Add Sentry, OpenTelemetry, request IDs, and health checks
- Status: done
- Changed files:
  - `apps/api/package.json`
  - `apps/api/src/index.ts`
  - `apps/api/src/index.test.ts`
  - `apps/api/src/lib/health.ts`
  - `apps/api/src/lib/health.test.ts`
  - `apps/api/src/lib/telemetry.ts`
  - `apps/api/src/lib/telemetry.test.ts`
  - `apps/api/src/middleware/auth.ts`
  - `apps/api/src/orpc/context.ts`
  - `apps/api/src/routes/contract-first.test.ts`
  - `apps/api/src/routes/monitor/server.ts`
  - `apps/web/src/app/(dashboard)/monitor/server/page.tsx`
  - `packages/shared/src/schemas/business-api.ts`
  - `packages/shared/src/schemas/health.ts`
  - `pnpm-lock.yaml`
  - `Status.md`
- Commands:
  - `pnpm add --filter @ai-native-os/api @sentry/node @opentelemetry/api @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/sdk-node`
  - `pnpm biome check --write <changed-files>`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `REDIS_URL=redis://:redis@127.0.0.1:6380 pnpm --filter @ai-native-os/api dev`
  - `curl -sS -i http://localhost:3001/health`
  - `curl -sS -i -H 'x-request-id: p5-smoke-request' http://localhost:3001/api/v1/system/ping`
- Result:
  - Added env-gated Sentry and OpenTelemetry bootstrap to the API runtime, centralized request-id propagation through Hono middleware variables and response headers, and replaced the duplicated health logic with a shared snapshot helper reused by `/health` and `/api/v1/monitor/server`. Health responses now report `database`, `redis`, and `telemetry` states from a single contract, Redis probing supports `REDIS_URL` or host/port/password tuples, and the monitor page renders the new telemetry status fields. Static checks, unit/integration tests, and process-level smoke passed; with `REDIS_URL=redis://:redis@127.0.0.1:6380`, `/health` returned `redis: ok`, and a caller-supplied `x-request-id` was preserved end-to-end.
- Unlocked tasks:
  - none
- Notes:
  - Telemetry backends intentionally stay `unknown` until their DSN/export endpoint environment variables are configured. This keeps local and test environments stable without pretending observability is active.
  - Redis health now reflects the configured runtime dependency, but the broader queue/worker runtime is still outside the API health contract until deployment wiring is completed in Phase 6.

### P5-T1 Implement operation log and AI audit log pipelines end-to-end
- Status: done
- Changed files:
  - `packages/db/src/observability/operation-logs.ts`
  - `packages/db/src/observability/operation-logs.test.ts`
  - `packages/db/src/index.ts`
  - `apps/api/src/middleware/auth.ts`
  - `apps/api/src/index.ts`
  - `apps/api/src/index.test.ts`
  - `apps/api/src/routes/contract-first.test.ts`
  - `apps/api/src/mastra/rag/indexing.ts`
  - `apps/jobs/src/index.test.ts`
  - `Status.md`
- Commands:
  - `pnpm biome check --write <changed-files>`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Added a shared `writeOperationLog` persistence helper with deterministic anonymous/system fallback actors, request-info normalization, and query helpers for module-level and request-level verification. The API auth mount now wraps Better Auth sign-up, sign-in, and sign-out flows with best-effort operation log writes, and the RAG indexing pipeline now emits matching operation logs alongside the existing AI audit trail. Regression tests prove that auth activity surfaces in `/api/v1/monitor/logs`, knowledge indexing creates `ai_knowledge` operation logs, and the full workspace test suite remains green.
- Unlocked tasks:
  - none
- Notes:
  - `P5-T1` intentionally logs only the current real write paths instead of inventing new CRUD surfaces; broader telemetry and distributed request tracing remain `P5-T2`.
  - Auth-related operation logs currently fall back to anonymous actors when a Better Auth principal has not yet been mapped onto an application RBAC user. This is acceptable for the current phase, but principal-bridge hardening remains open follow-up.

### P4-T6 Implement generative UI components
- Status: done
- Changed files:
  - `apps/web/src/app/(dashboard)/ai/knowledge/page.tsx`
  - `apps/web/src/app/(dashboard)/system/users/page.tsx`
  - `apps/web/src/components/copilot/copilot-panel.tsx`
  - `apps/web/src/components/generative/generative-bar-chart.tsx`
  - `apps/web/src/components/generative/generative-knowledge-panel.tsx`
  - `apps/web/src/components/generative/generative-users-panel.tsx`
  - `apps/web/src/lib/generative.test.ts`
  - `apps/web/src/lib/generative.ts`
- Commands:
  - `pnpm biome check --write <changed-files>`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm --filter @ai-native-os/api dev`
  - `pnpm --filter @ai-native-os/web dev`
  - `curl -sS -L -b /tmp/ai-native-os-web.cookies http://localhost:3000/system/users`
  - `curl -sS -L -b /tmp/ai-native-os-admin.cookies http://localhost:3000/ai/knowledge`
- Result:
  - Added Phase 4 generative UI surfaces without expanding scope beyond the existing RBAC boundary. `Users Directory` now includes a natural-language lens that derives read-only structured filters, a generated summary, role distribution chart, and focused table from the current page slice. `Knowledge Vault` now includes a parallel generative lens for source-type, recency, and chunk-coverage analysis. In addition, the Copilot sidebar now registers a safe frontend action, `preview_dashboard_focus`, so the authenticated assistant can trigger a read-only focus card render and local state update inside the Copilot surface. Static checks, tests, build, and authenticated route smoke passed.
- Unlocked tasks:
  - `P5-T1`
  - `P5-T2`
  - `P5-T3`
  - `P5-T4`
- Notes:
  - Browser-level smoke for AI management pages requires an authenticated admin Better Auth account to exist locally; this run standardized that path by explicitly signing up and signing in `admin@ai-native-os.local` before loading `/ai/knowledge`.
  - The page-level generative panels intentionally operate only on the data already visible in the current page slice. They do not trigger new writes, RAG indexing, or privileged tool execution.
  - The Copilot-triggered render path is intentionally read-only and confined to the sidebar so `P4-T6` satisfies the plan requirement for AI-triggered component state changes without introducing mutation flows ahead of Phase 5 governance.

### P4-T4 Implement monitor and AI management pages
- Status: done
- Changed files:
  - `apps/web/src/app/(dashboard)/ai/audit/page.tsx`
  - `apps/web/src/app/(dashboard)/ai/evals/page.tsx`
  - `apps/web/src/app/(dashboard)/ai/knowledge/page.tsx`
  - `apps/web/src/app/(dashboard)/monitor/online/page.tsx`
  - `apps/web/src/app/(dashboard)/monitor/server/page.tsx`
  - `apps/web/src/app/(dashboard)/system/logs/page.tsx`
  - `apps/web/src/components/management/*`
  - `apps/web/src/lib/ability.ts`
  - `apps/web/src/lib/api.ts`
  - `apps/web/src/lib/format.ts`
  - `apps/web/src/lib/management.ts`
  - `apps/web/src/lib/server-management.ts`
- Commands:
  - `pnpm biome check --write <changed-files>`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm --filter @ai-native-os/api dev`
  - `pnpm --filter @ai-native-os/web dev`
  - `curl -sS http://localhost:3000/system/logs`
  - `curl -sS http://localhost:3000/monitor/online`
  - `curl -sS http://localhost:3000/monitor/server`
- Result:
  - Replaced the monitor and AI placeholders with real server-rendered management pages backed by the contract-first monitor and AI APIs, including logs, online sessions, server runtime summary, knowledge inventory, AI audit ledger, and eval registry. Shared management layout, filters, and pagination primitives were reused so the monitor and AI surfaces follow the same shell language as the system module. Static checks, tests, build, and viewer-authenticated smoke passed.
- Unlocked tasks:
  - `P4-T6`
- Notes:
  - `ai/evals` remains intentionally read-only and reflects current runtime readiness rather than persisted eval history.
  - Dedicated privileged browser smoke for AI admin pages depends on local Better Auth account provisioning matching seeded RBAC principals; route compilation and server-side contract fetching are verified, but browser-level super-admin smoke was not fully standardized in this environment.

### P4-T3 Implement system management pages
- Status: done
- Changed files:
  - `apps/web/src/app/(dashboard)/system/users/page.tsx`
  - `apps/web/src/app/(dashboard)/system/roles/page.tsx`
  - `apps/web/src/app/(dashboard)/system/permissions/page.tsx`
  - `apps/web/src/app/(dashboard)/system/menus/page.tsx`
  - `apps/web/src/components/management/*`
  - `apps/web/src/components/shell/dashboard-shell.tsx`
  - `apps/web/src/lib/ability.test.ts`
  - `apps/web/src/lib/ability.ts`
  - `apps/web/src/lib/api.ts`
  - `apps/web/src/lib/format.ts`
  - `apps/web/src/lib/management.ts`
  - `apps/web/src/lib/server-management.ts`
- Commands:
  - `pnpm biome check --write <changed-files>`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm --filter @ai-native-os/api dev`
  - `pnpm --filter @ai-native-os/web dev`
  - `curl -sS http://localhost:3000/system/users`
- Result:
  - Replaced the system placeholders with real list views for users, roles, permissions, and menus. The pages are server-rendered, consume the new contract-first system APIs directly, preserve the Better Auth plus CASL shell boundary, and expose read-oriented filters, counts, and pagination without inventing unsupported write flows. Static checks, tests, build, and viewer-authenticated smoke passed.
- Unlocked tasks:
  - `P4-T4`
- Notes:
  - Navigation visibility now derives from the full route registry rather than a hardcoded surface count, so hidden-surface stats stay correct as the dashboard grows.
  - Permission editing remains intentionally read-only until mutation contracts, approval gates, and rollback-safe audit flows exist.

### P4-F1 Insert contract-first business API skeleton for system, monitor, and AI modules
- Status: done
- Changed files:
  - `apps/api/src/index.ts`
  - `apps/api/src/routes/ai/audit.ts`
  - `apps/api/src/routes/ai/evals.ts`
  - `apps/api/src/routes/ai/knowledge.ts`
  - `apps/api/src/routes/contract-first.test.ts`
  - `apps/api/src/routes/index.ts`
  - `apps/api/src/routes/lib/pagination.ts`
  - `apps/api/src/routes/monitor/logs.ts`
  - `apps/api/src/routes/monitor/online.ts`
  - `apps/api/src/routes/monitor/server.ts`
  - `apps/api/src/routes/system/menus.ts`
  - `apps/api/src/routes/system/permissions.ts`
  - `apps/api/src/routes/system/roles.ts`
  - `apps/api/src/routes/system/users.ts`
  - `packages/shared/src/index.ts`
  - `packages/shared/src/schemas/business-api.ts`
- Commands:
  - `pnpm biome check --write <changed-files>`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
- Result:
  - Added documented contract-first read skeletons for `users / roles / permissions / menus / monitor/logs / monitor/online / monitor/server / ai/knowledge / ai/evals / ai/audit`, kept OpenAPI generation through oRPC metadata, and inserted a Hono REST query compatibility layer so direct GET requests with standard query strings now work under the existing Better Auth and CASL boundary. Static checks, build, OpenAPI coverage, and authenticated contract-route smoke all pass.
- Unlocked tasks:
  - `P4-T3`
  - `P4-T4`
- Notes:
  - `ai/evals` is intentionally a contract-stable skeleton and does not yet have dedicated persistence or a dedicated CASL subject.
  - The compatibility layer was added because the current `@orpc/server/fetch` runtime path does not parse plain REST query strings for these GET procedures in the way the API conventions document requires.

### P4-T5 Integrate CopilotKit sidebar and assistant-style chat UX
- Status: done
- Changed files:
  - `apps/api/src/copilotkit/runtime.ts`
  - `apps/web/package.json`
  - `apps/web/src/app/(dashboard)/layout.tsx`
  - `apps/web/src/app/api/ag-ui/runtime/route.ts`
  - `apps/web/src/app/api/ag-ui/runtime/events/route.ts`
  - `apps/web/src/app/api/copilotkit/route.ts`
  - `apps/web/src/app/layout.tsx`
  - `apps/web/src/components/copilot/copilot-panel.tsx`
  - `apps/web/src/components/shell/dashboard-shell.tsx`
  - `apps/web/src/lib/api.ts`
  - `apps/web/src/lib/copilot.ts`
  - `apps/web/src/lib/copilot.test.ts`
  - `apps/web/src/lib/proxy-api.ts`
  - `apps/web/src/lib/server-copilot.ts`
  - `packages/shared/src/index.ts`
  - `packages/shared/src/schemas/copilot.ts`
  - `packages/ui/src/components/badge.tsx`
  - `pnpm-lock.yaml`
- Commands:
  - `pnpm biome check --write <changed-files>`
  - `pnpm install`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:seed`
  - `pnpm --filter @ai-native-os/api dev`
  - `pnpm --filter @ai-native-os/web dev`
  - `curl -sS http://localhost:3001/health`
  - `curl -sS http://localhost:3000/`
  - `curl -i -sS -X POST http://localhost:3000/auth/sign-in`
  - `curl -sS -b /tmp/ai-native-os-web-cookies.txt http://localhost:3000/system/roles`
  - `curl -sS -b /tmp/ai-native-os-web-cookies.txt http://localhost:3000/api/ag-ui/runtime`
  - `curl -sS -b /tmp/ai-native-os-web-cookies.txt http://localhost:3000/api/ag-ui/runtime/events`
- Result:
  - The Next.js dashboard now embeds an authenticated Copilot sidebar that is bound to the current RBAC-filtered shell state, uses shared Copilot discovery schemas, proxies `/api/copilotkit` and `/api/ag-ui/runtime*` through same-origin App Router handlers, and surfaces a usable assistant-style chat experience without bypassing Better Auth or the existing backend audit boundary. Static checks, build, runtime summary proxying, SSE bootstrap proxying, and authenticated dashboard smoke all pass.
- Unlocked tasks:
  - `P4-T6`
- Notes:
  - The web proxy layer now forwards the full incoming request header set except transport-specific headers, because Copilot runtime compatibility is more robust when protocol-specific headers are preserved end to end.
  - `Badge` now renders a semantic `span`, fixing invalid HTML in inline text contexts discovered during smoke verification.
  - `P4-T3` and `P4-T4` remain blocked by missing contract-first business API surfaces, so Phase 4 as a whole is still not complete even though the assistant layer is now live.

### P4-T2 Establish shared UI primitives and shadcn-based component baseline
- Status: done
- Changed files:
  - `biome.json`
  - `apps/web/package.json`
  - `apps/web/postcss.config.mjs`
  - `apps/web/src/app/globals.css`
  - `apps/web/src/app/layout.tsx`
  - `apps/web/src/app/(dashboard)/*`
  - `apps/web/src/components/auth/sign-in-page.tsx`
  - `apps/web/src/components/shell/dashboard-shell.tsx`
  - `apps/web/src/components/shell/module-preview-dialog.tsx`
  - `apps/web/src/components/shell/placeholder-page.tsx`
  - `packages/ui/package.json`
  - `packages/ui/src/client.ts`
  - `packages/ui/src/components/*`
  - `packages/ui/src/lib/*`
  - `packages/ui/src/index.ts`
  - `packages/ui/src/index.test.ts`
  - `pnpm-lock.yaml`
- Commands:
  - `pnpm install`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm --filter @ai-native-os/api dev`
  - `pnpm --filter @ai-native-os/web dev`
  - `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3001/health`
  - `curl -i -sS http://localhost:3000/`
  - `curl -i -sS -X POST http://localhost:3000/auth/sign-in`
  - `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000/system/roles`
- Result:
  - `packages/ui` is now a real shared React primitive package with design tokens, `Button`, `Card`, `Input`, `Field`, `Dialog`, and `Table` primitives. `apps/web` now consumes those primitives on the sign-in shell, dashboard shell, and placeholder pages through a Tailwind v4 + PostCSS baseline. Static checks, tests, build, and authenticated route smoke all pass.
- Unlocked tasks:
  - none
- Notes:
  - `P4-T3` and `P4-T4` remain blocked because the repository still lacks the contract-first business API surfaces those pages need.
  - Root Biome config now enables Tailwind directive parsing so `@source` and `@theme` syntax in `globals.css` lint cleanly.
  - Browser-level `agent-browser` verification still could not run because the CLI is not installed in the current environment, so this task used HTTP smoke plus authenticated route verification instead.

### P4-T1 Build Next.js app shell, global providers, and dashboard layout
- Status: done
- Changed files:
  - `biome.json`
  - `apps/web/package.json`
  - `apps/web/next.config.ts`
  - `apps/web/next-env.d.ts`
  - `apps/web/tsconfig.json`
  - `apps/web/src/app/*`
  - `apps/web/src/components/*`
  - `apps/web/src/lib/*`
  - `pnpm-lock.yaml`
- Commands:
  - `pnpm install`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm --filter @ai-native-os/api dev`
  - `pnpm --filter @ai-native-os/web dev`
  - `curl -i -sS http://localhost:3000/`
  - `curl -i -sS -X POST http://localhost:3000/auth/sign-in`
  - `curl -i -sS http://localhost:3000/system/roles`
- Result:
  - `apps/web` is now a real Next.js App Router application with Turbopack dev mode, server-rendered auth shell loading, global providers, route handlers for Better Auth proxying, and routable dashboard placeholder pages. Root page and authenticated dashboard smoke both pass.
- Unlocked tasks:
  - `P4-T5`
- Notes:
  - Root Biome config now ignores `next-env.d.ts` because Next rewrites that generated file in a style that conflicts with the repository formatter, which made `pnpm lint` nondeterministic after `next dev/build`.
  - Browser-level `agent-browser` verification could not run because the CLI is not installed in the current environment, so this task used HTTP smoke plus authenticated route verification instead.
  - This task intentionally stops at framework baseline, providers, and authenticated layout. Shared component primitives remain `P4-T2`, and full contract-first business pages remain `P4-T3/P4-T4`.

### P3-T7 Implement MCP server and external MCP client integration
- Status: done
- Changed files:
  - `apps/api/package.json`
  - `apps/api/src/index.ts`
  - `apps/api/src/mastra/mcp/server.ts`
  - `apps/api/src/mastra/mcp/client.ts`
  - `apps/api/src/mastra/mcp/integration.test.ts`
- Commands:
  - `pnpm install`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Authenticated MCP endpoint is available at `/mastra/mcp`, exposes one agent wrapper, one workflow wrapper, one direct tool, plus resources and prompts; external discovery via `@ai-sdk/mcp` passes.
- Unlocked tasks:
  - `P4-T1`
  - `P4-T2`
- Notes:
  - The implementation uses `@modelcontextprotocol/sdk` and `@ai-sdk/mcp` as a protocol-compatible bridge because the documented `@mastra/mcp` package is not installed in the repository.
  - MCP workflow execution now reuses the authenticated caller request context; an intermediate scheduler-principal escalation bug was caught and removed before final verification.

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

### Phase 1 QA Gate Remediation
- Status: done
- Changed files:
  - `package.json`
  - `turbo.json`
  - `packages/db/package.json`
  - `packages/db/src/index.ts`
  - `packages/db/src/index.test.ts`
  - `apps/api/package.json`
  - `apps/api/src/index.test.ts`
  - `apps/web/package.json`
  - `apps/web/src/server.ts`
  - `apps/web/src/server.test.ts`
- Commands:
  - `pnpm format`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm --filter @ai-native-os/api dev`
  - `pnpm --filter @ai-native-os/web dev`
  - `curl -sS http://localhost:3001/health`
  - `curl -sS http://localhost:3000`
- Result:
  - Added root and workspace test scripts, removed the API startup crash caused by unconditional DB env validation, and replaced the web placeholder watcher with an accessible HTTP page server.
- Unlocked tasks:
  - none
- Notes:
  - `packages/db` now falls back to the local development database URL outside production, while production still requires `DATABASE_URL`.

### P2-T1 Implement Better Auth server and client configuration
- Status: done
- Changed files:
  - `packages/auth/package.json`
  - `packages/auth/src/index.ts`
  - `packages/auth/src/env.ts`
  - `packages/auth/src/server.ts`
  - `packages/auth/src/client.ts`
  - `packages/auth/src/index.test.ts`
  - `packages/auth/src/smoke.ts`
  - `packages/db/src/schema/auth.ts`
  - `packages/db/src/schema/index.ts`
  - `packages/db/src/migrations/0001_wealthy_edwin_jarvis.sql`
  - `packages/db/src/migrations/meta/*`
  - `pnpm-lock.yaml`
- Commands:
  - `pnpm install`
  - `pnpm dlx @better-auth/cli@1.4.21 generate --cwd /Users/tao/work/ai/ai-native-os/packages/auth --config /Users/tao/work/ai/ai-native-os/packages/auth/src/server.ts --output /Users/tao/work/ai/ai-native-os/packages/db/src/schema/auth.ts --yes`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:generate`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:migrate`
  - `pnpm format`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm --filter @ai-native-os/auth smoke`
- Result:
  - Better Auth server/client/env configuration is implemented in `packages/auth`, auth schema and migration are added to `packages/db`, and direct sign-up/sign-in/get-session smoke validation succeeds against local PostgreSQL.
- Unlocked tasks:
  - `P2-T2`
- Notes:
  - Auth runtime currently uses dedicated Better Auth tables (`user`, `session`, `account`, `verification`) separate from the app-level `users` table; identity-to-RBAC bridging remains follow-up work in Phase 2.

### P2-T2 Integrate auth middleware into Hono and expose auth routes
- Status: done
- Changed files:
  - `apps/api/package.json`
  - `apps/api/src/middleware/auth.ts`
  - `apps/api/src/orpc/context.ts`
  - `apps/api/src/orpc/procedures.ts`
  - `apps/api/src/routes/index.ts`
  - `apps/api/src/routes/system/session.ts`
  - `apps/api/src/index.ts`
  - `apps/api/src/index.test.ts`
  - `packages/auth/src/server.ts`
  - `packages/auth/src/client.ts`
  - `packages/auth/src/smoke.ts`
  - `packages/auth/src/index.test.ts`
  - `pnpm-lock.yaml`
- Commands:
  - `pnpm install`
  - `pnpm format`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm --filter @ai-native-os/api dev`
  - `curl -i -sS http://localhost:3001/api/auth/get-session`
  - `curl -i -sS http://localhost:3001/api/v1/system/session`
- Result:
  - Better Auth is mounted at `/api/auth/*`, API requests now hydrate auth session into Hono/oRPC context, and the protected session route returns `401` without a session and `200` with a valid auth cookie.
- Unlocked tasks:
  - none
- Notes:
  - Current protected-route verification uses a minimal `system.session` endpoint. RBAC-aware authorization remains deferred to `P2-T4` after roles and permissions are wired in `P2-T3`.

### P2-T3 Implement RBAC tables, seeds, and permission-loading service
- Status: done
- Changed files:
  - `packages/db/package.json`
  - `packages/db/src/client.ts`
  - `packages/db/src/index.ts`
  - `packages/db/src/rbac/load-permissions.ts`
  - `packages/db/src/rbac/load-permissions.test.ts`
  - `packages/db/src/seed/index.ts`
  - `packages/db/src/seed/rbac.ts`
  - `packages/db/src/seed/rbac.test.ts`
  - `packages/db/src/seed/verify-rbac-seed.ts`
  - `Status.md`
- Commands:
  - `pnpm install`
  - `pnpm biome check --write packages/db/src packages/db/package.json`
  - `pnpm --filter @ai-native-os/db typecheck`
  - `pnpm --filter @ai-native-os/db test`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:seed`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:seed:verify`
- Result:
  - Default RBAC roles, permissions, menus, and seeded application users are now inserted idempotently, and `packages/db` exports permission-loading services by user id and email for downstream CASL middleware.
- Unlocked tasks:
  - `P2-T4`
- Notes:
  - Current RBAC verification uses the app-level `users` table with seeded principals; runtime mapping from Better Auth identities into these RBAC principals is still pending in later Phase 2 work.

### P2-T4 Implement CASL ability builder and permission middleware
- Status: done
- Changed files:
  - `apps/api/package.json`
  - `apps/api/src/index.test.ts`
  - `apps/api/src/lib/authorization.test.ts`
  - `apps/api/src/middleware/auth.ts`
  - `apps/api/src/orpc/context.ts`
  - `apps/api/src/orpc/procedures.ts`
  - `apps/api/src/routes/index.ts`
  - `apps/api/src/routes/system/permission-admin-check.ts`
  - `apps/api/src/routes/system/rbac-summary.ts`
  - `Status.md`
  - `pnpm-lock.yaml`
- Commands:
  - `pnpm install`
  - `pnpm biome check --write apps/api/src apps/api/package.json`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:seed`
  - `pnpm --filter @ai-native-os/api typecheck`
  - `pnpm --filter @ai-native-os/api test`
  - `pnpm format`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - API requests now hydrate CASL ability, role codes, and permission rules into context from RBAC data, route-level permission guards return `403` when access is denied, and condition-based CASL evaluation is covered by test.
- Unlocked tasks:
  - `P2-T5`
- Notes:
  - Runtime permission loading currently bridges Better Auth users to app RBAC principals by email. This is sufficient for Phase 2 middleware and tests, but dedicated identity linking is still follow-up work.

### P2-T5 Expose permission query endpoints and serialized ability payload
- Status: done
- Changed files:
  - `packages/shared/src/schemas/ability.ts`
  - `packages/shared/src/index.ts`
  - `apps/api/src/routes/index.ts`
  - `apps/api/src/routes/system/current-ability.ts`
  - `apps/api/src/routes/system/current-permissions.ts`
  - `apps/api/src/index.test.ts`
  - `Status.md`
- Commands:
  - `pnpm biome check --write packages/shared/src apps/api/src`
  - `pnpm --filter @ai-native-os/shared typecheck`
  - `pnpm --filter @ai-native-os/api typecheck`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:seed`
  - `pnpm --filter @ai-native-os/api test`
  - `pnpm format`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - API now exposes `/api/v1/system/permissions/current` for normalized RBAC rules and `/api/v1/system/permissions/ability` for a frontend-deserializable ability payload, both covered by runtime tests using `deserializeAbility`.
- Unlocked tasks:
  - `P2-T6`
- Notes:
  - The serialized ability endpoint intentionally returns normalized `PermissionRule[]` rather than raw CASL internal rule objects, so frontend consumers get a stable contract.

### P2-T6 Build minimal auth shell and permission provider in web app
- Status: done
- Changed files:
  - `apps/web/package.json`
  - `apps/web/src/server.ts`
  - `apps/web/src/server.test.ts`
  - `apps/web/src/lib/ability.ts`
  - `apps/web/src/lib/ability.test.ts`
  - `apps/web/src/lib/api.ts`
  - `apps/web/src/lib/env.ts`
  - `apps/web/src/lib/http.ts`
  - `apps/web/src/lib/page.ts`
  - `pnpm-lock.yaml`
  - `Status.md`
- Commands:
  - `pnpm install`
  - `pnpm biome check --write apps/web/src apps/web/package.json`
  - `pnpm --filter @ai-native-os/web typecheck`
  - `pnpm --filter @ai-native-os/web test`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:seed`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:seed:verify`
  - `curl -sS http://localhost:3001/health`
  - `curl -sS http://localhost:3000`
  - `curl -sS -i -X POST http://localhost:3000/login -H 'content-type: application/x-www-form-urlencoded' --data 'email=viewer%40ai-native-os.local&password=Passw0rd%21Passw0rd%21'`
  - `pnpm format`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Web now serves a real auth shell that proxies Better Auth login/logout, fetches serialized ability and permission payloads from the API, and filters visible navigation server-side based on the authenticated user's CASL ability.
- Unlocked tasks:
  - `P3-T1`
- Notes:
  - The shell degrades safely to the unauthenticated sign-in surface when the API is unavailable, while the full smoke validation used the standard `http://localhost:3000` app origin because Better Auth trusted origins default to that development URL.

### P3-T1 Integrate Mastra with Hono and register core runtime
- Status: done
- Changed files:
  - `biome.json`
  - `apps/api/package.json`
  - `apps/api/src/index.ts`
  - `apps/api/src/index.test.ts`
  - `apps/api/src/orpc/context.ts`
  - `apps/api/src/mastra/env.ts`
  - `apps/api/src/mastra/index.ts`
  - `apps/api/src/mastra/registry.ts`
  - `pnpm-lock.yaml`
  - `Status.md`
- Commands:
  - `pnpm install`
  - `pnpm biome check --write apps/api/src apps/api/package.json`
  - `pnpm biome check --write biome.json Status.md`
  - `pnpm --filter @ai-native-os/api typecheck`
  - `pnpm --filter @ai-native-os/api test`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os PORT=3001 pnpm --filter @ai-native-os/api dev`
  - `curl -sS http://localhost:3001/mastra/system/packages`
  - `curl -sS http://localhost:3001/mastra/openapi.json`
  - `curl -sS http://localhost:3001/api/v1/system/mastra-runtime`
  - `pnpm format`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Mastra is mounted into the Hono API under `/mastra`, the adapter OpenAPI route is exposed, and a scheduler-visible runtime summary route is available at `/api/v1/system/mastra-runtime`.
- Unlocked tasks:
  - `P3-T2`
- Notes:
  - The current Mastra registry is intentionally empty for `P3-T1`; real tools, agents, workflows, and knowledge integrations start in later Phase 3 tasks.
  - Biome now ignores generated output directories (`dist`, `.next`, `drizzle`) so root QA gates validate source files instead of build artifacts.

### P3-T2 Build core agent tool framework with RBAC and audit enforcement
- Status: done
- Changed files:
  - `packages/db/src/schema/ai-audit-logs.ts`
  - `packages/db/src/schema/index.ts`
  - `packages/db/src/ai/audit-logs.ts`
  - `packages/db/src/index.ts`
  - `packages/db/src/migrations/0002_dusty_silver_surfer.sql`
  - `packages/db/src/migrations/meta/0002_snapshot.json`
  - `packages/db/src/migrations/meta/_journal.json`
  - `packages/shared/src/schemas/ai-tools.ts`
  - `packages/shared/src/index.ts`
  - `apps/api/src/mastra/request-context.ts`
  - `apps/api/src/mastra/registry.ts`
  - `apps/api/src/mastra/tools/base.ts`
  - `apps/api/src/mastra/tools/user-directory.ts`
  - `apps/api/src/mastra/tools/permission-profile.ts`
  - `apps/api/src/mastra/tools/operation-log-search.ts`
  - `apps/api/src/mastra/tools/ai-audit-log-search.ts`
  - `apps/api/src/mastra/tools/report-data-snapshot.ts`
  - `apps/api/src/mastra/tools/runtime-config.ts`
  - `apps/api/src/mastra/tools/index.ts`
  - `apps/api/src/mastra/tools/index.test.ts`
  - `apps/api/src/routes/system/ai-tool-catalog.ts`
  - `apps/api/src/routes/system/ai-audit-logs.ts`
  - `apps/api/src/routes/index.ts`
  - `apps/api/src/index.test.ts`
  - `Status.md`
- Commands:
  - `pnpm biome check --write packages/db/src packages/shared/src apps/api/src`
  - `pnpm --filter @ai-native-os/db typecheck`
  - `pnpm --filter @ai-native-os/shared typecheck`
  - `pnpm --filter @ai-native-os/api typecheck`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:generate`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:migrate`
  - `pnpm --filter @ai-native-os/db test`
  - `pnpm --filter @ai-native-os/api test`
  - `pnpm format`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Mastra now exposes a reusable protected-tool base with request-context validation, CASL enforcement, and AI audit-log persistence; the runtime registers user directory, permission profile, operation log search, AI audit log search, report snapshot, and safe runtime config tools, and the API exposes authenticated tool catalog and AI audit-log read endpoints.
- Unlocked tasks:
  - `P3-T3`
  - `P3-T4`
  - `P3-T6`
- Notes:
  - Current tools are intentionally read/report/config oriented to stay inside the existing RBAC subject model and avoid pseudo side effects.
  - Outbound notification tooling remains a follow-up once a dedicated notification subject and delivery runtime are added.

### P3-F1 Unify Mastra auth boundary and authenticated request-context bridge
- Status: done
- Changed files:
  - `apps/api/src/index.ts`
  - `apps/api/src/index.test.ts`
  - `apps/api/src/mastra/request-context.ts`
  - `apps/api/src/mastra/server.ts`
  - `apps/api/src/middleware/auth.ts`
  - `Status.md`
- Commands:
  - `pnpm --filter @ai-native-os/api biome check --write src/index.ts src/index.test.ts src/mastra/server.ts src/mastra/request-context.ts src/middleware/auth.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - `/mastra/*` now shares the authenticated Better Auth and RBAC context boundary with the rest of the API, unauthenticated runtime access is rejected with `401`, and authenticated runtime requests receive a populated Mastra `requestContext` carrying auth user ID, RBAC role codes, permission rules, request ID, and user email.
- Unlocked tasks:
  - `P3-F2`
- Notes:
  - This correction intentionally secures the whole Mastra runtime prefix instead of keeping public diagnostic access.
  - Runtime metadata cleanup and empty-registry test assumptions still require `P3-F2` before any new Agent or Workflow implementation starts.

### P3-F2 Remove empty-runtime assumptions and align runtime metadata
- Status: done
- Changed files:
  - `apps/api/src/lib/openapi.ts`
  - `apps/api/src/mastra/index.ts`
  - `apps/api/src/mastra/registry.ts`
  - `apps/api/src/index.test.ts`
  - `Status.md`
- Commands:
  - `pnpm --filter @ai-native-os/api biome check --write src/lib/openapi.ts src/mastra/index.ts src/mastra/registry.ts src/index.test.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - OpenAPI metadata now reflects the current API surface instead of a stale Phase 1 skeleton label, Mastra runtime summary now exposes registered agent/workflow IDs plus a derived runtime stage, and integration tests verify that summary against the live registry instead of hard-coding empty agent/workflow counts.
- Unlocked tasks:
  - `P3-T3`
  - `P3-T4`
  - `P3-T6`
- Notes:
  - This task intentionally does not pretend agents or workflows already exist; it only removes false assumptions that would block their later introduction.

### P3-T3 Implement initial agents
- Status: done
- Changed files:
  - `apps/api/src/mastra/agents/admin-copilot.ts`
  - `apps/api/src/mastra/agents/audit-analyst.ts`
  - `apps/api/src/mastra/agents/index.ts`
  - `apps/api/src/mastra/registry.ts`
  - `apps/api/src/index.test.ts`
  - `Status.md`
- Commands:
  - `pnpm --filter @ai-native-os/api biome check --write src/mastra/agents/admin-copilot.ts src/mastra/agents/audit-analyst.ts src/mastra/agents/index.ts src/mastra/registry.ts src/index.test.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Registered two initial read-only Mastra agents, `admin-copilot` and `audit-analyst`, both backed only by existing RBAC-protected and audit-logged tools. The authenticated Mastra runtime now exposes the initial agent catalog and agent detail endpoints through the official `/mastra/agents` routes, and runtime summary reflects the active agent registry.
- Unlocked tasks:
  - `P3-T4`
- Notes:
  - This task intentionally avoids write-capable tools because Mastra route-level authorization is not yet hardened beyond authenticated access.
  - Tool-level RBAC and AI audit logging remain the effective enforcement boundary for current agent execution.

### P3-T4 Implement AI workflows and Trigger.dev task orchestration
- Status: done
- Changed files:
  - `apps/api/package.json`
  - `apps/api/src/index.test.ts`
  - `apps/api/src/mastra/registry.ts`
  - `apps/api/src/mastra/request-context.ts`
  - `apps/api/src/mastra/tools/base.ts`
  - `apps/api/src/mastra/tools/report-data-snapshot.ts`
  - `apps/api/src/mastra/workflows/index.ts`
  - `apps/api/src/mastra/workflows/report-schedule.ts`
  - `apps/api/src/mastra/workflows/report-schedule.test.ts`
  - `apps/jobs/package.json`
  - `apps/jobs/src/index.ts`
  - `apps/jobs/src/index.test.ts`
  - `apps/jobs/src/trigger/report-schedule.ts`
  - `apps/jobs/trigger.config.ts`
  - `pnpm-lock.yaml`
  - `Status.md`
- Commands:
  - `pnpm biome check --write apps/api/src/mastra/tools/report-data-snapshot.ts apps/api/src/mastra/workflows/report-schedule.ts apps/api/src/mastra/workflows/index.ts apps/api/src/mastra/workflows/report-schedule.test.ts apps/api/src/mastra/registry.ts apps/api/src/index.test.ts apps/jobs/src/trigger/report-schedule.ts apps/jobs/src/index.ts apps/jobs/src/index.test.ts apps/jobs/trigger.config.ts apps/api/package.json apps/jobs/package.json`
  - `pnpm install`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:seed`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Added the first read-only Mastra workflow, `report-schedule`, with workflow-level audit logging and request-id correlation to the underlying `report-data-snapshot` tool. Added a Trigger.dev scheduled task entrypoint in `apps/jobs`, plus `apps/jobs/trigger.config.ts`, so the project now has a concrete background orchestration runtime instead of a skeleton. Authenticated Mastra workflow routes are visible, workflow runtime summary now reports `workflows_ready`, and end-to-end tests prove the workflow and scheduled task both execute successfully and persist audit records.
- Unlocked tasks:
  - `P3-T5`
  - `P3-T7`
- Notes:
  - Because the project still lacks a formal service-to-service identity model, the jobs runtime uses an in-process least-privilege scheduler principal that grants only `export:Report`; it does not open a new external HTTP bypass for `/mastra/*`.
  - This task intentionally stays read-only and does not introduce approval flows, notifications, or write-capable workflows before the route-level authorization and service-identity story are fully hardened.

### P3-T5 Implement CopilotKit and AG-UI backend bridge
- Status: done
- Changed files:
  - `apps/api/package.json`
  - `apps/api/src/copilotkit/runtime.ts`
  - `apps/api/src/index.ts`
  - `apps/api/src/index.test.ts`
  - `pnpm-lock.yaml`
  - `Status.md`
- Commands:
  - `pnpm biome check --write apps/api/src/copilotkit/runtime.ts apps/api/src/index.ts apps/api/src/index.test.ts`
  - `pnpm install`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - Added an authenticated CopilotKit backend bridge at `/api/copilotkit` plus AG-UI discovery and event routes under `/api/ag-ui/runtime*`. The bridge now builds a per-request Copilot runtime from the live Mastra registry, reuses the same Better Auth and RBAC request context as the rest of the API, rejects unauthenticated access with `401`, and exposes authenticated runtime summary and SSE bootstrap events for the currently registered read-only agents.
- Unlocked tasks:
  - none
- Notes:
  - This task intentionally implements only the backend bridge. The documented Copilot sidebar and assistant chat UI remain a Phase 4 frontend task because `apps/web` is still not on the project’s Next.js baseline.
  - Upstream `@copilotkit/runtime` and AG-UI packages still emit peer warnings around `@ag-ui/encoder`, and the repository retains an existing Zod 3/4 peer mismatch warning through the AI SDK stack. Runtime and tests are green, but dependency harmonization remains follow-up work.

### P3-T6 Implement pgvector-backed RAG indexing and retrieval
- Status: done
- Changed files:
  - `packages/shared/src/schemas/ai-knowledge.ts`
  - `packages/shared/src/index.ts`
  - `packages/db/src/schema/ai-knowledge.ts`
  - `packages/db/src/schema/index.ts`
  - `packages/db/src/ai/knowledge.ts`
  - `packages/db/src/ai/knowledge.test.ts`
  - `packages/db/src/index.ts`
  - `packages/db/src/migrations/0003_sour_firestar.sql`
  - `packages/db/src/migrations/meta/0003_snapshot.json`
  - `packages/db/src/migrations/meta/_journal.json`
  - `apps/api/src/mastra/rag/chunking.ts`
  - `apps/api/src/mastra/rag/embeddings.ts`
  - `apps/api/src/mastra/rag/indexing.ts`
  - `apps/api/src/mastra/rag/retrieval.ts`
  - `apps/api/src/mastra/tools/knowledge-semantic-search.ts`
  - `apps/api/src/mastra/tools/index.ts`
  - `apps/api/src/mastra/tools/index.test.ts`
  - `apps/api/src/mastra/agents/admin-copilot.ts`
  - `apps/api/src/index.test.ts`
  - `apps/api/package.json`
  - `apps/jobs/src/trigger/rag-indexing.ts`
  - `apps/jobs/src/index.ts`
  - `apps/jobs/src/index.test.ts`
  - `pnpm-lock.yaml`
  - `Status.md`
- Commands:
  - `pnpm install`
  - `pnpm biome check --write packages/shared/src/schemas/ai-knowledge.ts packages/db/src/schema/ai-knowledge.ts packages/db/src/ai/knowledge.ts packages/db/src/ai/knowledge.test.ts apps/api/src/mastra/rag/chunking.ts apps/api/src/mastra/rag/embeddings.ts apps/api/src/mastra/rag/indexing.ts apps/api/src/mastra/rag/retrieval.ts apps/api/src/mastra/tools/knowledge-semantic-search.ts apps/api/src/mastra/tools/index.ts apps/api/src/mastra/agents/admin-copilot.ts apps/api/src/mastra/tools/index.test.ts apps/api/src/index.test.ts apps/jobs/src/trigger/rag-indexing.ts apps/jobs/src/index.ts apps/jobs/src/index.test.ts apps/api/package.json`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:generate`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:migrate`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_native_os pnpm --filter @ai-native-os/db db:seed`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
- Result:
  - Added an `ai_knowledge` pgvector-backed storage model with HNSW cosine index, shared RAG schemas, deterministic chunking, embedding and retrieval helpers, and a protected `knowledge-semantic-search` Tool under `read:AiKnowledge`. The runtime now exposes real semantic knowledge retrieval to `admin-copilot`, and `apps/jobs` provides a concrete `rag-indexing` Trigger.dev task that indexes sample documents and makes them semantically searchable end-to-end.
- Unlocked tasks:
  - none
- Notes:
  - Production RAG must use a real embedding provider via `OPENAI_API_KEY`; deterministic local embeddings are intentionally limited to development and test so QA can run without external model dependencies.
  - This task implements the backend RAG slice only. Knowledge CRUD UI and upload workflows remain later frontend/application tasks.
