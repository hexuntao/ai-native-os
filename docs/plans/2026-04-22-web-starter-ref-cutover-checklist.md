# Web Starter Ref Cutover Checklist

## Scope

`apps/web-starter-ref` is the candidate replacement for `apps/web` once the starter-based shell fully covers the AI-native control plane routes.

## Functional Checklist

- Login and logout complete through Better Auth inside `apps/web-starter-ref`
- RBAC-driven navigation visibility matches the authenticated subject
- `/dashboard/overview` renders the AI Operations Center with live runtime, governance, eval, and audit signals
- `/dashboard/observe/runs` renders filters, pagination, trace selection, detail evidence, and feedback entry
- `/dashboard/observe/monitor` renders runtime health, trigger posture, and telemetry state
- `/dashboard/govern/approvals` renders queue search, selected prompt evidence, and release posture
- `/dashboard/govern/audit` renders audit evidence and feedback trail
- `/dashboard/build/prompts` renders prompt governance posture and linked release evidence
- `/dashboard/improve/evals` renders eval registry posture and recent risk signals
- `/dashboard/knowledge/collections` renders read and write flows for knowledge collections
- `/dashboard/workspace/reports` renders schedule health, export history, and workflow links
- `/dashboard/admin/users`, `/roles`, `/permissions`, `/menus` render read/write surfaces with flash feedback

## Assistant Rail Checklist

- Right rail opens and collapses without disturbing starter sidebar/header layout
- Assistant rail changes content by route for overview, runs, approvals, audit, prompts, reports
- Copilot bridge summary degrades gracefully when runtime discovery fails
- Assistant panel shows authenticated route scope and read-only focus bridge
- No old `apps/web` three-column shell is reintroduced

## Route Policy Checklist

- `/dashboard/home` redirects to `/dashboard/overview`
- Canonical routes are only under `/dashboard/...`
- Catch-all fallback no longer serves placeholder product pages
- No top-level navigation item still points to a placeholder page

## Validation Commands

```bash
pnpm --filter @ai-native-os/web-starter-ref lint
pnpm --filter @ai-native-os/web-starter-ref typecheck
pnpm --filter @ai-native-os/web-starter-ref build
pnpm lint
pnpm typecheck
```
