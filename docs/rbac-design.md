
# RBAC 权限设计文档

> 本文档定义 AI Native OS 系统的角色-权限模型、CASL 集成方案、前后端同构权限控制。

---

## 一、权限模型总览

### 1.1 设计目标

| 目标 | 说明 |
|------|------|
| 前后端同构 | 同一套权限定义在服务端和客户端共享使用 |
| Edge 兼容 | 权限引擎可在 Cloudflare Workers 等边缘环境运行 |
| 动态可配置 | 权限通过后台界面动态管理，无需修改代码 |
| 细粒度控制 | 支持资源级、字段级、条件级权限 |
| AI 感知 | AI Agent 受权限系统约束，不可绕过 |

### 1.2 选型：CASL + 自建 RBAC

```
数据库层（Drizzle）      → 存储角色、权限定义（动态可配置）
    ↓
权限引擎（CASL）         → 将 DB 数据转为 Ability 对象（运行时判断）
    ↓
API 中间件（Hono）       → 请求级权限校验
前端组件（React）        → UI 级权限控制（按钮/菜单/页面）
AI Agent（Mastra Tool）  → 工具级权限校验
```

---

## 二、数据库模型设计

### 2.1 ER 关系图

```
                        ┌──────────────────┐
                        │      users       │
                        │ ──────────────── │
                        │ id (uuid, PK)    │
                        │ username         │
                        │ email            │
                        │ password_hash    │
                        │ status           │
                        │ created_at       │
                        └────────┬─────────┘
                                 │
                          ┌──────┴──────┐
                          │ user_roles  │
                          │ ────────── │
                          │ user_id (FK)│
                          │ role_id (FK)│
                          └──────┬──────┘
                                 │
                        ┌────────┴─────────┐
                        │      roles       │
                        │ ──────────────── │
                        │ id (uuid, PK)    │
                        │ name             │
                        │ code (unique)    │  ← 如 'admin', 'editor', 'viewer'
                        │ description      │
                        │ sort_order       │
                        │ status           │
                        │ created_at       │
                        └────────┬─────────┘
                                 │
                       ┌─────────┴──────────┐
                       │ role_permissions   │
                       │ ──────────────── │
                       │ role_id (FK)       │
                       │ permission_id (FK) │
                       └─────────┬──────────┘
                                 │
                      ┌──────────┴───────────┐
                      │    permissions       │
                      │ ──────────────────── │
                      │ id (uuid, PK)        │
                      │ resource (string)    │  ← CASL subject: 'User', 'Role', 'Menu'
                      │ action (string)      │  ← CASL action: 'create', 'read', 'update', 'delete', 'manage'
                      │ conditions (jsonb)   │  ← CASL conditions: {"organizationId": "${user.orgId}"}
                      │ fields (text[])      │  ← 可选：限制可访问字段 ['name', 'email']
                      │ inverted (boolean)   │  ← true = cannot（禁止规则）
                      │ description          │
                      │ created_at           │
                      └──────────────────────┘
```

### 2.2 Drizzle Schema 定义

```typescript
// packages/db/src/schema/roles.ts
import { pgTable, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core'

export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  description: varchar('description', { length: 200 }),
  sortOrder: integer('sort_order').default(0),
  status: boolean('status').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// packages/db/src/schema/permissions.ts
import { pgTable, uuid, varchar, jsonb, boolean, text, timestamp } from 'drizzle-orm/pg-core'

export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  resource: varchar('resource', { length: 50 }).notNull(),   // CASL subject
  action: varchar('action', { length: 50 }).notNull(),       // CASL action
  conditions: jsonb('conditions'),                            // CASL conditions
  fields: text('fields').array(),                             // 可选字段限制
  inverted: boolean('inverted').default(false),               // cannot 规则
  description: varchar('description', { length: 200 }),
  createdAt: timestamp('created_at').defaultNow(),
})

// packages/db/src/schema/user-roles.ts
export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] }),
}))

// packages/db/src/schema/role-permissions.ts
export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: uuid('permission_id').references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}))
```

### 2.3 菜单表（与权限关联）

```typescript
// packages/db/src/schema/menus.ts
export const menus = pgTable('menus', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id').references(() => menus.id),
  name: varchar('name', { length: 50 }).notNull(),
  path: varchar('path', { length: 200 }),
  component: varchar('component', { length: 200 }),
  icon: varchar('icon', { length: 50 }),
  sortOrder: integer('sort_order').default(0),
  type: varchar('type', { length: 10 }).notNull(),  // 'directory' | 'menu' | 'button'
  // 关联权限：此菜单需要什么权限才能显示
  permissionResource: varchar('permission_resource', { length: 50 }),
  permissionAction: varchar('permission_action', { length: 50 }),
  visible: boolean('visible').default(true),
  status: boolean('status').default(true),
  createdAt: timestamp('created_at').defaultNow(),
})
```

---

## 三、CASL 集成

### 3.1 共享 Subject 定义

```typescript
// packages/shared/src/abilities/subjects.ts

// 所有受权限控制的资源类型
export type AppSubjects =
  | 'User'
  | 'Role'
  | 'Permission'
  | 'Menu'
  | 'Dict'
  | 'Config'
  | 'OperationLog'
  | 'OnlineUser'
  | 'AiAgent'
  | 'AiWorkflow'
  | 'AiKnowledge'
  | 'AiAuditLog'
  | 'Approval'
  | 'Report'
  | 'all'            // CASL 特殊值：代表所有资源

// CASL 动作定义
export type AppActions =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage'         // CASL 特殊值：代表所有动作
  | 'export'         // 自定义：导出权限
  | 'import'         // 自定义：导入权限
  | 'approve'        // 自定义：审批权限
  | 'assign'         // 自定义：分配权限（如分配角色）
```

### 3.2 Ability 构建函数（前后端共享）

```typescript
// packages/shared/src/abilities/define-ability.ts
import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from '@casl/ability'
import type { AppActions, AppSubjects } from './subjects'

export type AppAbility = MongoAbility<[AppActions, AppSubjects]>

// 权限规则接口（对应 DB 中的 permissions 表）
export interface PermissionRule {
  action: AppActions
  subject: AppSubjects
  conditions?: Record<string, unknown>
  fields?: string[]
  inverted?: boolean
}

/**
 * 根据权限规则构建 CASL Ability
 * 此函数在服务端和客户端都使用
 */
export function defineAbilityFor(rules: PermissionRule[]): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  for (const rule of rules) {
    const options: any = {}
    if (rule.conditions) options.conditions = rule.conditions
    if (rule.fields) options.fields = rule.fields

    if (rule.inverted) {
      cannot(rule.action, rule.subject, options)
    } else {
      can(rule.action, rule.subject, options)
    }
  }

  return build()
}

/**
 * 序列化 Ability（服务端 → 客户端传输）
 */
export function serializeAbility(ability: AppAbility) {
  return ability.rules
}

/**
 * 反序列化 Ability（客户端从 JWT/API 中恢复）
 */
export function deserializeAbility(rules: PermissionRule[]): AppAbility {
  return defineAbilityFor(rules)
}
```

### 3.3 CASL + 普通对象的注意事项

CASL 使用类名来确定要在对象上检查哪些权限。由于我们使用普通对象（而非类实例），需要 `subject()` 包装器。

```typescript
import { subject } from '@casl/ability'

// ❌ 不工作（普通对象没有类名）
ability.can('update', someUser)

// ✅ 使用 subject() 包装
ability.can('update', subject('User', { ...someUser }))

// ⚠️ React Server Components 兼容
// subject() 会修改对象，不兼容 RSC
// 解决方法：始终创建新对象
ability.can('update', subject('User', { ...document }))
```

---

## 四、服务端权限控制

### 4.1 从数据库加载用户权限

```typescript
// apps/api/src/lib/permission.ts
import { db } from '@db'
import { users, userRoles, roles, rolePermissions, permissions } from '@db/schema'
import { eq, inArray } from 'drizzle-orm'
import { defineAbilityFor, type PermissionRule } from '@shared/abilities'

/**
 * 根据用户 ID 从数据库加载权限并构建 CASL Ability
 */
export async function buildAbilityForUser(userId: string) {
  // 1. 查询用户的所有角色
  const userRoleRows = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId))

  const roleIds = userRoleRows.map(r => r.roleId)
  if (roleIds.length === 0) return defineAbilityFor([])

  // 2. 查询角色关联的所有权限
  const permissionRows = await db
    .select({
      resource: permissions.resource,
      action: permissions.action,
      conditions: permissions.conditions,
      fields: permissions.fields,
      inverted: permissions.inverted,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(inArray(rolePermissions.roleId, roleIds))

  // 3. 转为 CASL 规则
  const rules: PermissionRule[] = permissionRows.map(p => ({
    action: p.action as AppActions,
    subject: p.resource as AppSubjects,
    conditions: p.conditions ?? undefined,
    fields: p.fields ?? undefined,
    inverted: p.inverted ?? false,
  }))

  // 4. 构建 Ability
  return defineAbilityFor(rules)
}
```

### 4.2 Hono 权限中间件

```typescript
// apps/api/src/middleware/permission.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { subject } from '@casl/ability'
import { buildAbilityForUser } from '../lib/permission'
import type { AppActions, AppSubjects } from '@shared/abilities'

/**
 * 通用权限检查中间件
 * 用法：.use(checkAbility('read', 'User'))
 */
export function checkAbility(action: AppActions, resource: AppSubjects) {
  return createMiddleware(async (c, next) => {
    const userId = c.get('userId')     // 从 auth 中间件获取
    if (!userId) {
      throw new HTTPException(401, { message: 'Unauthorized' })
    }

    const ability = await buildAbilityForUser(userId)

    if (!ability.can(action, resource)) {
      throw new HTTPException(403, {
        message: `Forbidden: cannot ${action} ${resource}`,
      })
    }

    // 将 ability 注入上下文，后续处理可用
    c.set('ability', ability)
    await next()
  })
}

/**
 * 资源级权限检查中间件（带条件）
 * 用法：.use(checkAbilityOn('update', 'User', async (c) => fetchedUser))
 */
export function checkAbilityOn<T extends Record<string, unknown>>(
  action: AppActions,
  resource: AppSubjects,
  getResource: (c: any) => Promise<T>,
) {
  return createMiddleware(async (c, next) => {
    const userId = c.get('userId')
    const ability = await buildAbilityForUser(userId)
    const resourceObj = await getResource(c)

    if (!ability.can(action, subject(resource, { ...resourceObj }))) {
      throw new HTTPException(403, {
        message: `Forbidden: cannot ${action} this ${resource}`,
      })
    }

    c.set('ability', ability)
    await next()
  })
}
```

### 4.3 oRPC 路由中使用权限

```typescript
// apps/api/src/routes/system/users.ts
import { os } from '@/orpc'
import { checkAbility, checkAbilityOn } from '@/middleware/permission'

export const userRouter = os.prefix('/users')({

  // 列表查询 — 需要 read User 权限
  list: os
    .use(checkAbility('read', 'User'))
    .input(listUserSchema)
    .handler(async ({ input, context }) => {
      const ability = context.ability

      // 条件过滤：如果权限有 conditions，自动过滤数据
      // 例如：只能看本部门的用户
      const conditions = ability.relevantRuleFor('read', 'User')?.conditions
      const whereClause = conditions
        ? buildDrizzleWhere(conditions)
        : undefined

      return db.select().from(users).where(whereClause)
    }),

  // 删除 — 需要 delete User 权限 + 资源级检查
  delete: os
    .use(checkAbilityOn('delete', 'User', async (c) => {
      const userId = c.req.param('id')
      return db.select().from(users).where(eq(users.id, userId)).first()
    }))
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      return db.delete(users).where(eq(users.id, input.id))
    }),
})
```

---

## 五、客户端权限控制

### 5.1 登录后获取权限

```typescript
// apps/web/lib/ability.ts
import { deserializeAbility, type AppAbility } from '@shared/abilities'
import { createContext, useContext } from 'react'

// React Context
export const AbilityContext = createContext<AppAbility>(undefined!)
export const useAbility = () => useContext(AbilityContext)

// 登录后从 API 获取权限规则
export async function fetchAbility(): Promise<AppAbility> {
  const { rules } = await orpc.auth.getPermissions.query()
  return deserializeAbility(rules)
}
```

### 5.2 权限 Provider

```typescript
// apps/web/app/(dashboard)/layout.tsx
'use client'

import { AbilityContext, fetchAbility } from '@/lib/ability'
import { useQuery } from '@tanstack/react-query'

export default function DashboardLayout({ children }) {
  const { data: ability, isLoading } = useQuery({
    queryKey: ['ability'],
    queryFn: fetchAbility,
    staleTime: 5 * 60 * 1000,    // 5 分钟缓存
  })

  if (isLoading || !ability) return <LoadingScreen />

  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  )
}
```

### 5.3 UI 权限控制组件

```typescript
// apps/web/components/ui/can.tsx
'use client'

import { useAbility } from '@/lib/ability'
import { subject } from '@casl/ability'
import type { AppActions, AppSubjects } from '@shared/abilities'

interface CanProps {
  action: AppActions
  subject: AppSubjects
  resource?: Record<string, unknown>    // 可选：资源级条件检查
  fallback?: React.ReactNode            // 无权限时显示
  children: React.ReactNode
}

/**
 * 权限控制组件
 * 用法：
 *   <Can action="create" subject="User">
 *     <CreateUserButton />
 *   </Can>
 */
export function Can({ action, subject: subjectName, resource, fallback, children }: CanProps) {
  const ability = useAbility()

  const canDo = resource
    ? ability.can(action, subject(subjectName, { ...resource }))
    : ability.can(action, subjectName)

  if (!canDo) return fallback ?? null

  return <>{children}</>
}
```

### 5.4 页面中使用

```tsx
// apps/web/app/(dashboard)/system/users/page.tsx
import { Can } from '@/components/ui/can'

export default function UsersPage() {
  return (
    <div>
      <div className="flex justify-between">
        <h1>用户管理</h1>
        <Can action="create" subject="User">
          <Button>新增用户</Button>
        </Can>
      </div>

      <DataTable
        columns={[
          // ...
          {
            id: 'actions',
            cell: ({ row }) => (
              <div className="flex gap-2">
                <Can action="update" subject="User" resource={row.original}>
                  <Button variant="ghost" size="icon"><EditIcon /></Button>
                </Can>
                <Can action="delete" subject="User" resource={row.original}>
                  <Button variant="ghost" size="icon"><TrashIcon /></Button>
                </Can>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
```

### 5.5 菜单权限过滤

```typescript
// apps/web/hooks/use-filtered-menus.ts
import { useAbility } from '@/lib/ability'
import type { MenuItem } from '@/types'

export function useFilteredMenus(menus: MenuItem[]) {
  const ability = useAbility()

  function filterMenus(items: MenuItem[]): MenuItem[] {
    return items
      .filter(item => {
        // 无权限要求的菜单始终显示
        if (!item.permissionResource || !item.permissionAction) return true
        return ability.can(item.permissionAction, item.permissionResource)
      })
      .map(item => ({
        ...item,
        children: item.children ? filterMenus(item.children) : [],
      }))
      .filter(item => {
        // 过滤空目录
        if (item.type === 'directory') return item.children.length > 0
        return true
      })
  }

  return filterMenus(menus)
}
```

---

## 六、AI Agent 权限约束

### 6.1 Agent 工具中的权限检查

**所有 AI Agent 的工具调用都必须受 CASL 约束**：

```typescript
// Agent 执行上下文中包含操作者信息
// 在 CopilotKit 的 AG-UI 端点中，将当前登录用户 ID 注入 Agent 上下文

export const userManagementTool = createTool({
  id: 'user-management',
  // ...
  execute: async ({ context }) => {
    const operatorId = context.operatorId  // 当前操作者
    const ability = await buildAbilityForUser(operatorId)

    // Agent 也必须遵守权限
    if (!ability.can(context.action, 'User')) {
      return {
        error: `权限不足：你没有 ${context.action} User 的权限`,
        suggestion: '请联系管理员申请权限',
      }
    }

    // 执行操作...
  },
})
```

### 6.2 AI 权限建议（AI 增强）

```typescript
// AI 可以分析权限配置并给出建议
// 例如：检测到某角色长期未使用某权限 → 建议回收
// 例如：检测到某用户权限过高 → 建议最小权限原则

export const permissionAdvisorTool = createTool({
  id: 'permission-advisor',
  description: '分析当前权限配置并给出优化建议',
  execute: async () => {
    // 查询所有角色的权限使用情况
    // 查询最近 30 天的操作日志
    // 对比权限定义和实际使用 → 找出冗余权限
    // 返回建议列表
  },
})
```

---

## 七、预设角色和权限

### 7.1 Seed 数据

```typescript
// packages/db/src/seed/rbac.ts

export const defaultRoles = [
  {
    code: 'super_admin',
    name: '超级管理员',
    description: '拥有所有权限',
    permissions: [
      { action: 'manage', resource: 'all' },   // CASL: 全部权限
    ],
  },
  {
    code: 'admin',
    name: '管理员',
    description: '系统管理权限（不含超级管理员操作）',
    permissions: [
      { action: 'manage', resource: 'User' },
      { action: 'manage', resource: 'Role' },
      { action: 'manage', resource: 'Menu' },
      { action: 'manage', resource: 'Dict' },
      { action: 'read', resource: 'OperationLog' },
      { action: 'read', resource: 'AiAuditLog' },
      { action: 'manage', resource: 'AiKnowledge' },
      // 不能管理 Permission（只有 super_admin 可以）
    ],
  },
  {
    code: 'editor',
    name: '编辑员',
    description: '内容编辑和数据管理',
    permissions: [
      { action: 'read', resource: 'User' },
      { action: 'create', resource: 'User' },
      { action: 'update', resource: 'User' },
      // 不能删除用户
      { action: 'read', resource: 'Dict' },
      { action: 'export', resource: 'Report' },
    ],
  },
  {
    code: 'viewer',
    name: '查看者',
    description: '只读权限',
    permissions: [
      { action: 'read', resource: 'User' },
      { action: 'read', resource: 'Role' },
      { action: 'read', resource: 'Menu' },
      { action: 'read', resource: 'Dict' },
      { action: 'read', resource: 'OperationLog' },
    ],
  },
]
```
