# Web AI-Native Refactor Blueprint

Date: 2026-04-22
Scope: `apps/web`
Decision: adopt Scheme A

## 1. Purpose

This blueprint defines how `apps/web` should be refactored from a route-first admin shell into an AI-native control plane while preserving the repository's current auth, RBAC, contract-first API, and Copilot runtime boundaries.

The design is informed by:

- `docs/architecture.md`
- `docs/api-conventions.md`
- `docs/rbac-design.md`
- `docs/ai-agent-design.md`
- `Challenge.md`
- [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter)
- [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
- [Linear design preview](https://getdesign.md/design-md/linear.app/preview)
- [Cursor design preview](https://getdesign.md/design-md/cursor/preview)

## 2. Why Refactor

The current web app is already a competent authenticated dashboard, but it is still organized like a traditional management console:

- navigation is grouped by `system / monitor / ai / reports`
- the app shell is page-centric rather than object-centric
- the right rail is a chat-adjacent panel instead of a true operator context rail
- AI-native first-class objects such as `agents`, `runs`, `traces`, and `approvals` do not own the information architecture
- `management/*` abstractions are carrying both admin CRUD and AI workbench responsibilities

This creates a product mismatch:

- the backend already models AI runtime, governance, RBAC, and audit as core capabilities
- the frontend still expresses them as one module among several dashboard categories

## 3. Goals

- Preserve the existing auth, CASL, audit, and oRPC/REST-compatible API boundaries.
- Rebuild the web information architecture around the AI lifecycle.
- Extract a reusable shell infrastructure similar in cleanliness to the Kiranism starter.
- Introduce a design source-of-truth with a root-level `DESIGN.md`.
- Keep migration incremental, not a rewrite.

## 4. Non-Goals

- No backend contract redesign in this plan.
- No replacement of Better Auth, CASL, CopilotKit, or current route protection model.
- No immediate redesign of every existing page.
- No premature `packages/ui` rewrite.

## 5. Target Product Model

The web app should be understood as an AI operations console with seven top-level domains:

| Domain | Responsibility | Primary Objects |
|---|---|---|
| `Home` | System-wide AI operating picture | summaries, risk queue, release pipeline |
| `Build` | Define AI capability | agents, workflows, prompts, tools |
| `Observe` | Inspect runtime behavior | runs, traces, monitor, usage |
| `Improve` | Raise quality | evals, datasets, experiments, feedback |
| `Knowledge` | Operate context layer | sources, collections, retrieval quality, sync jobs |
| `Govern` | Review safety and change control | approvals, audit, policies, prompt releases |
| `Workspace` | Human-in-the-loop execution | inbox, sessions, reports, task handoff |
| `Admin` | Foundational system administration | users, roles, permissions, menus, config |

This changes the product center of gravity:

- `Admin` moves to the edge
- `Observe`, `Govern`, and `Build` become primary
- Copilot becomes an operator workbench, not a decorative assistant

## 6. Target Directory Shape

The target structure should blend Kiranism's layout discipline with this repository's AI-native domain model.

```text
apps/web/src
├── app
│   ├── (dashboard)
│   │   ├── home
│   │   ├── build
│   │   │   ├── agents
│   │   │   ├── workflows
│   │   │   ├── prompts
│   │   │   └── tools
│   │   ├── observe
│   │   │   ├── runs
│   │   │   ├── traces
│   │   │   ├── monitor
│   │   │   └── usage
│   │   ├── improve
│   │   │   ├── evals
│   │   │   ├── datasets
│   │   │   ├── experiments
│   │   │   └── feedback
│   │   ├── knowledge
│   │   │   ├── sources
│   │   │   ├── collections
│   │   │   ├── retrieval-quality
│   │   │   └── sync-jobs
│   │   ├── govern
│   │   │   ├── approvals
│   │   │   ├── audit
│   │   │   ├── policies
│   │   │   └── prompt-releases
│   │   ├── workspace
│   │   │   ├── inbox
│   │   │   ├── sessions
│   │   │   └── reports
│   │   └── admin
│   │       ├── users
│   │       ├── roles
│   │       ├── permissions
│   │       ├── menus
│   │       └── config
├── components
│   ├── layout
│   ├── shell
│   ├── workbench
│   ├── management
│   ├── copilot
│   ├── providers
│   └── ui
├── config
│   ├── nav-config.ts
│   ├── command-config.ts
│   ├── workbench-config.ts
│   └── design-tokens.ts
├── features
│   ├── home
│   ├── agents
│   ├── runs
│   ├── prompts
│   ├── evals
│   ├── knowledge
│   ├── approvals
│   ├── audit
│   ├── monitor
│   ├── users
│   ├── roles
│   └── permissions
└── lib
    ├── shell
    ├── copilot
    ├── server
    ├── management
    └── format
```

## 7. Structural Decisions

### 7.1 Layout Layer

Borrow from the Kiranism starter:

- `AppSidebar`
- `Header`
- `PageContainer`
- config-driven navigation
- command/search surface as global infrastructure

But adjust for this product:

- replace the demo-style right info rail with a persistent `ContextRail`
- treat Copilot as a shell-level operator rail, not a feature-level component
- page content should be wrapped by layout primitives, not own the shell directly

### 7.2 Feature Layer

Borrow Kiranism's feature grouping discipline:

- route files stay thin
- feature modules own server loaders, components, and view composition
- shared page primitives stay in `components/*`

For this repository, each feature module should standardize around:

```text
features/<domain>/
├── components/
├── server/
├── view-model/
├── schemas/
└── actions/    # only when write flows are present
```

### 7.3 Design Source-of-Truth

Borrow VoltAgent's method, not a copied brand:

- add root `DESIGN.md`
- use it as the UI design contract for future AI-assisted implementation
- synthesize:
  - Linear's control-plane precision
  - Cursor's AI workflow semantics

The design system should emphasize:

- compact control-console density
- crisp semantic states
- three-column shell rhythm
- timeline and inspector patterns
- restrained but intentional typography

## 8. New Shell Contract

The shell should be split into explicit roles.

| Component | Responsibility |
|---|---|
| `components/layout/app-sidebar.tsx` | navigation, workspace switch, pinned views, recent objects |
| `components/layout/header.tsx` | global breadcrumb, object search, environment badges, notifications |
| `components/layout/page-container.tsx` | page framing, sticky page title, action slot, empty/loading states |
| `components/layout/context-rail.tsx` | current object pack, recent related events, suggested actions |
| `components/layout/command-bar.tsx` | search agents, traces, prompts, runs, users |
| `components/layout/workbench-header.tsx` | status strip and page-scoped action row for AI-native views |

Key rule:

- shell infrastructure must not assume the current grouping of `system / monitor / ai`

## 9. New Navigation Contract

Navigation should move out of `lib/shell.ts` into config.

Target flow:

1. `config/nav-config.ts` defines canonical route groups and metadata
2. `lib/shell` resolves RBAC-filtered visibility from canonical config
3. layout components render only filtered items
4. command palette and sidebar consume the same source of truth

Each nav item should include:

- title
- href
- group
- description
- icon
- objectKind
- visibility rule
- optional copilot brief ID

## 10. Copilot Refactor

The current `copilot-panel.tsx` already has route-aware context, but it remains too chat-centric.

It should become a `Contextual Copilot Rail` with four stacked regions:

1. `Current Object`
   - selected run, prompt, agent, approval, or page scope
2. `Related State`
   - role codes, capability status, linked traces, recent events
3. `Suggested Actions`
   - compare, explain, draft change, prepare approval, inspect failure
4. `Conversation`
   - streamed chat and read-only or approved actions

Important boundary:

- no hidden write actions
- every action remains permission-aware and auditable

## 11. Page Strategy

Implementation should not start by reworking every legacy route.

Three flagship pages should establish the new product language first:

### 11.1 `home`

New page:

- `AI Operations Center`
- dependency graph / release pipeline / attention queue / live incidents

### 11.2 `observe/runs`

New page:

- table + trace inspector
- first-class run filters
- links to prompt, eval, incident, approval

### 11.3 `govern/approvals`

New page:

- approval queue
- evidence bundle
- policy checks
- approve / reject / request changes

Once these are stable, existing `ai/evals`, `ai/prompts`, `ai/audit`, and admin pages can migrate to the new shell and taxonomy.

## 12. Legacy Mapping

The current route model should be migrated, not deleted all at once.

| Current Route | Target Domain |
|---|---|
| `/system/users` | `/admin/users` |
| `/system/roles` | `/admin/roles` |
| `/system/permissions` | `/admin/permissions` |
| `/system/menus` | `/admin/menus` |
| `/system/logs` | `/govern/audit` or `/observe/monitor` after contract review |
| `/monitor/server` | `/observe/monitor` |
| `/monitor/online` | `/observe/monitor` or `/workspace/sessions` after product decision |
| `/ai/knowledge` | `/knowledge/collections` |
| `/ai/evals` | `/improve/evals` |
| `/ai/audit` | `/govern/audit` |
| `/ai/prompts` | `/build/prompts` or `/govern/prompt-releases` depending page intent |
| `/reports` | `/workspace/reports` |

## 13. Task DAG

This blueprint maps to the following implementation tasks:

| Task ID | Objective | Outputs |
|---|---|---|
| `WEB-ARC-C1` | Establish IA and design source-of-truth | root `DESIGN.md`, `config/nav-config.ts` contract, route taxonomy baseline |
| `WEB-ARC-C2` | Extract shell infrastructure | layout primitives, page container, command bar, context rail |
| `WEB-ARC-C3` | Rebuild navigation around AI lifecycle | lifecycle nav groups, RBAC filtering, command-palette source unification |
| `WEB-ARC-C4` | Introduce feature-based web module layout | `features/*` migration baseline, thin route wrappers, shared feature conventions |
| `WEB-ARC-C5` | Deliver `home` AI operations center | new landing route, ops summary, release and attention panels |
| `WEB-ARC-C6` | Deliver `observe/runs` workbench | run list, trace inspector, action links |
| `WEB-ARC-C7` | Deliver `govern/approvals` workbench | approval queue, evidence pack, policy checks |
| `WEB-ARC-C8` | Migrate legacy routes into new IA incrementally | redirects, preserved contracts, migrated `ai/*`, `monitor/*`, `system/*` surfaces |
| `WEB-ARC-C9` | Remove obsolete shell abstractions and align documentation/tests | cleanup of legacy shell paths, tests, docs parity |

## 14. Validation Strategy

For implementation tasks under this blueprint:

- `pnpm biome check --write` on changed files
- `pnpm lint`
- `pnpm typecheck`
- targeted tests for shell and route behavior
- targeted smoke for auth-protected routes and RBAC-filtered navigation

Workbench-specific checks should include:

- route loads under authenticated shell
- hidden routes stay hidden for insufficient ability
- context rail reflects current route object
- Copilot capability degradation remains explicit

## 15. Risks

### Risk 1: Taxonomy drift

If new routes are added without a canonical nav config, the app will regress into mixed old/new vocabulary.

Mitigation:

- `nav-config.ts` becomes the required source of truth

### Risk 2: Half-migrated shell

If the shell changes before flagship pages exist, the product will feel incomplete.

Mitigation:

- land `home`, `observe/runs`, and `govern/approvals` immediately after shell extraction

### Risk 3: Admin abstractions leaking into AI workbenches

If `management/*` primitives continue to own all page ergonomics, AI-native pages will keep looking like CRUD screens.

Mitigation:

- split `management` and `workbench` primitives deliberately

## 16. Recommended First Execution Slice

If implementation starts now, the first three tasks should be:

1. `WEB-ARC-C1`
2. `WEB-ARC-C2`
3. `WEB-ARC-C5`

Reason:

- `WEB-ARC-C1` locks the vocabulary and visual contract
- `WEB-ARC-C2` gives the repository the reusable layout skeleton
- `WEB-ARC-C5` makes the product shift visible immediately

