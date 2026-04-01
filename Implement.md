# AI Native OS Execution Protocol

Generated: 2026-04-01
Owner: Scheduler Thread
Purpose: define how implementation is executed after planning, without ambiguity.

## 1. Operating Mode

- This project runs in scheduler-driven auto mode.
- Execution is task-DAG based, not freeform feature hopping.
- Only `ready` tasks may be executed.
- Only one clearly bounded task may be `in_progress` at a time in the main thread.
- After each completed task:
  - update `Status.md`
  - run the relevant QA gate
  - fix failures before moving on
- Phase completion triggers automatic progression to the next phase.

## 2. Task State Machine

Allowed task states:

- `backlog`
  - task is defined but not yet dependency-unlocked
- `ready`
  - all dependencies satisfied; task can be started
- `in_progress`
  - task currently being implemented
- `qa`
  - implementation complete; validation is running
- `failed`
  - implementation or QA failed; corrective work required
- `done`
  - implementation and QA passed
- `blocked`
  - external blocker or dependency gap prevents execution

State transitions:

- `backlog` -> `ready`
- `ready` -> `in_progress`
- `in_progress` -> `qa`
- `qa` -> `done`
- `qa` -> `failed`
- `failed` -> `ready`

Forbidden transitions:

- `backlog` -> `in_progress`
- `ready` -> `done`
- `failed` -> `done`
- starting a new task while another task is still `in_progress`

## 3. Ready-Task Selection Policy

When multiple tasks are `ready`, choose in this order:

1. Critical-path task that unlocks the most downstream work
2. Smaller task that removes structural blockers
3. Task aligned with package priority rules:
   - `packages/db`
   - `packages/shared`
   - `apps/api`
   - `apps/web`
   - `apps/api/src/mastra` and `apps/jobs`
4. Lowest-risk task if two options unlock the same amount of work

Do not select a broad task if it can be split into a smaller atomic task first.

## 4. Package-Level Execution Order

### Order A: Foundation

- root workspace
- `packages/db`
- `packages/shared`
- `apps/api`

### Order B: Security boundary

- `packages/auth`
- `apps/api` auth and permission middleware
- `apps/web` auth shell and ability provider

### Order C: AI runtime

- `apps/api/src/mastra`
- `apps/jobs`
- `apps/worker`

### Order D: Experience layer

- `packages/ui`
- `apps/web`

### Order E: Runtime hardening

- observability
- deployment
- CI/CD

## 5. Task Template

Every implementation task must be executed against this template:

### Task Header

- Task ID
- Phase
- Objective
- Dependency list
- File or module scope

### Work Rules

- touch only files required by the task scope
- do not mix unrelated refactors
- keep code runnable and typed
- use Chinese comments for intent and constraint documentation
- do not add decorative or redundant comments to trivial code paths
- every `Agent / Tool / Workflow` module must include complete Chinese module comments describing purpose, boundaries, permissions, and audit expectations
- every exported non-trivial function must include a Chinese purpose comment when its intent, side effects, constraints, or return contract are not obvious from the signature alone
- every complex permission, audit, orchestration, or security-sensitive code path must include Chinese comments explaining why the logic exists
- lack of required comments on `Agent / Tool / Workflow` modules or complex exported logic fails task completion, but trivial boilerplate and self-explanatory code do not require forced comments

### Commenting Standard

- Comments are for system intent, constraints, side effects, permission boundaries, and audit guarantees.
- Comments must be written in Chinese; identifiers remain English.
- Prefer concise module-level and function-level comments over line-by-line narration.
- Do not restate obvious syntax or variable assignments.
- For `Agent / Tool / Workflow` code, comments are mandatory on:
  - module purpose
  - allowed responsibilities
  - permission boundary
  - audit behavior
  - destructive or approval-required operations

### Validation Rules

- `pnpm biome check --write` on changed files
- `pnpm lint`
- `pnpm typecheck`
- targeted test or smoke command for the task scope
- route, UI, or workflow verification as applicable

### Completion Evidence

- changed files
- commands run
- pass/fail result
- new ready tasks unblocked

## 6. QA Gate Matrix By Phase

## Phase 1

Required gates:

- Gate A Structural
- Gate B Static
- Gate D Runtime

Mandatory checks:

- workspace scripts resolve
- migrations generate and run
- API skeleton boots
- `/health` and `/api/docs` smoke pass

## Phase 2

Required gates:

- Gate A Structural
- Gate B Static
- Gate C Contract
- Gate D Runtime

Mandatory checks:

- auth route smoke
- 401/403 behavior verification
- ability serialization and deserialization verification
- seed roles and permissions present

## Phase 3

Required gates:

- Gate B Static
- Gate C Contract
- Gate D Runtime
- Gate E AI Safety

Mandatory checks:

- Mastra route boot
- tool schemas compile
- tool permission enforcement verified
- AI audit logs recorded
- one workflow or task smoke run
- one RAG retrieval smoke run where in scope

## Phase 4

Required gates:

- Gate B Static
- Gate C Contract
- Gate D Runtime

Mandatory checks:

- authenticated dashboard loads
- permission-filtered menu behavior verified
- CRUD page smoke on at least one system module
- copilot UI streaming works where in scope

## Phase 5

Required gates:

- Gate B Static
- Gate D Runtime
- Gate E AI Safety

Mandatory checks:

- operation log and AI audit log writes verified
- telemetry export and health checks verified
- eval run produces stored results
- feedback capture verified

## Phase 6

Required gates:

- Gate A Structural
- Gate B Static
- Gate D Runtime

Mandatory checks:

- container or cloud build passes
- CI runs required jobs
- staging deploy smoke succeeds for chosen target
- rollback path documented and reviewed

## 7. Failure Handling

If a task fails:

1. mark task `failed` in `Status.md`
2. record exact failure point and command output summary
3. create the smallest corrective task
4. set corrective task to `ready`
5. do not advance the phase

Rollback rules:

- revert only the failed task scope, not unrelated user changes
- prefer surgical fixes over full rewrites
- if failure is infra-wide, restore last known green state for the affected module only

## 8. Definition of Ready

A task is `ready` only if:

- dependency tasks are `done`
- required file paths or packages already exist, or the task explicitly creates them
- environment prerequisites are documented
- validation method is known
- scope is small enough to finish in one implementation cycle

If any of the above are missing, the task stays `backlog` or `blocked`.

## 9. Definition of Done

A task is `done` only if:

- implementation matches the task objective
- changed code is formatted
- `pnpm lint` passes
- `pnpm typecheck` passes
- targeted validation passes
- `Status.md` records artifacts and next unlocked tasks

Phase `done` requires:

- all tasks in phase `done`
- no open `failed` tasks in the phase
- phase DoD from `Plan.md` satisfied

## 10. Concurrency Rules

- Main thread remains single-task active.
- Parallel work is allowed only when:
  - write scopes do not overlap
  - dependency boundaries are stable
  - results are not needed immediately on the critical path
- Preferred parallel windows:
  - `db` and `shared` in Phase 1
  - workflow jobs and RAG in Phase 3
  - independent page modules in Phase 4

## 11. Documentation Update Rules

`Status.md` must be updated:

- when a task starts
- when a task enters QA
- when QA passes or fails
- when the ready queue changes
- when a phase is completed

`Plan.md` may be updated only if:

- architecture constraints changed
- task DAG changed materially
- scope changed with explicit evidence

`Implement.md` may be updated only if:

- execution protocol itself needs correction
- QA policy or task-state rules must change

## 12. Commands Baseline

Default validation commands after code changes:

```bash
pnpm biome check --write <changed-files>
pnpm lint
pnpm typecheck
```

Additional commands by scope:

```bash
pnpm --filter db db:generate
pnpm --filter db db:migrate
pnpm dev --filter=api
pnpm dev --filter=web
pnpm test
```

If a command cannot run because the workspace is not yet bootstrapped, the blocking reason must be recorded in `Status.md` until the prerequisite task completes.

## 13. Initial Execution Sequence

The first six implementation tasks after planning should run in this order:

1. P1-T1 Create root monorepo scaffold
2. P1-T2 Create app and package skeleton directories
3. P1-T6 Add local dev infrastructure for database and cache
4. P1-T3 Define Drizzle base schema and migration pipeline
5. P1-T4 Define shared Zod schemas, constants, and CASL ability core
6. P1-T5 Build Hono + oRPC + Scalar API skeleton

Reason:

- this sequence unlocks the widest downstream surface with the least rework risk
- it respects the required `db -> shared -> api` ordering while taking advantage of allowed parallel lanes

## Preflight Review（每个任务开始前必须执行）

在开始任何任务前，先进行 5 项检查：

1. 该任务是否符合 Plan.md 当前 Phase
2. 该任务是否违反 docs/* 或 AGENTS.md
3. 该任务是否会绕过 auth / RBAC / audit / validation
4. 该任务是否扩大了当前任务范围
5. 该任务是否缺少必要前置依赖

如果任一项存在风险，先输出风险报告，不要直接写代码。

风险报告格式：

[PRECHECK-FAIL]
- task:
- violated_rules:
- missing_dependencies:
- risk_level: low | medium | high
- recommendation:
