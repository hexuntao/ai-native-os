
# API 约定文档

> 本文档定义 AI Native OS 系统中所有 API 的设计规范、命名约定、错误处理、分页规范等。

---

## 一、API 架构总览

### 1.1 双通道 API 架构

```
┌─────────────────────────────────────────────────┐
│                 Hono API Server                  │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────────┐ │
│  │   oRPC 通道       │  │   Mastra 通道        │ │
│  │                   │  │                      │ │
│  │ /api/*            │  │ /mastra/*            │ │
│  │ 业务 CRUD API     │  │ AI Agent 端点        │ │
│  │ 端到端类型安全     │  │ MCP Server          │ │
│  │ 自动 OpenAPI 文档  │  │ AG-UI 端点          │ │
│  │                   │  │ Workflow 端点        │ │
│  └──────────────────┘  └──────────────────────┘ │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │           共享中间件                       │   │
│  │  Auth · Permission · RateLimit · Logger   │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 1.2 URL 路径规范

```
/api/v1/system/users              # 系统管理 - 用户
/api/v1/system/roles              # 系统管理 - 角色
/api/v1/system/permissions        # 系统管理 - 权限
/api/v1/system/menus              # 系统管理 - 菜单
/api/v1/system/dicts              # 系统管理 - 字典
/api/v1/system/config             # 系统管理 - 配置
/api/v1/monitor/logs              # 监控 - 操作日志
/api/v1/monitor/online            # 监控 - 在线用户
/api/v1/monitor/server            # 监控 - 服务信息
/api/v1/ai/knowledge              # AI - 知识库
/api/v1/ai/evals                  # AI - 评估结果
/api/v1/ai/audit                  # AI - 审计日志
/api/v1/tools/gen                 # 工具 - 代码生成
/api/v1/tools/jobs                # 工具 - 任务调度

/mastra/agents/*                  # Mastra Agent 端点（自动生成）
/mastra/workflows/*               # Mastra Workflow 端点（自动生成）
/mastra/mcp/*                     # MCP Server 端点
/api/copilotkit                   # CopilotKit AG-UI 端点

/api/auth/*                       # Better Auth 端点（自动生成）
/api/docs                         # Scalar UI（OpenAPI 文档）
```

---

## 二、oRPC 路由规范

### 2.1 路由定义结构

```typescript
// apps/api/src/routes/index.ts
import { os } from '@/orpc'
import { userRouter } from './system/users'
import { roleRouter } from './system/roles'
import { permissionRouter } from './system/permissions'
import { menuRouter } from './system/menus'
import { dictRouter } from './system/dicts'
import { configRouter } from './system/config'
import { logRouter } from './monitor/logs'
import { onlineRouter } from './monitor/online'
import { knowledgeRouter } from './ai/knowledge'
import { evalRouter } from './ai/evals'
import { auditRouter } from './ai/audit'

export const appRouter = os.prefix('/api/v1')({
  system: os.prefix('/system')({
    users: userRouter,
    roles: roleRouter,
    permissions: permissionRouter,
    menus: menuRouter,
    dicts: dictRouter,
    config: configRouter,
  }),
  monitor: os.prefix('/monitor')({
    logs: logRouter,
    online: onlineRouter,
  }),
  ai: os.prefix('/ai')({
    knowledge: knowledgeRouter,
    evals: evalRouter,
    audit: auditRouter,
  }),
})

// 导出类型（前端使用）
export type AppRouter = typeof appRouter
```

### 2.2 标准 CRUD 路由模板

每个资源模块遵循统一的路由命名：

```typescript
// 命名约定
const resourceRouter = os.prefix('/resources')({
  list:       os.input(listSchema).handler(...)      // GET    /resources
  getById:    os.input(idSchema).handler(...)         // GET    /resources/:id
  create:     os.input(createSchema).handler(...)     // POST   /resources
  update:     os.input(updateSchema).handler(...)     // PUT    /resources/:id
  delete:     os.input(idSchema).handler(...)         // DELETE /resources/:id
  batchDelete: os.input(idsSchema).handler(...)       // DELETE /resources/batch
  export:     os.input(exportSchema).handler(...)     // POST   /resources/export
  import:     os.input(importSchema).handler(...)     // POST   /resources/import
})
```

### 2.3 完整路由示例

```typescript
// apps/api/src/routes/system/users.ts
import { os } from '@/orpc'
import { z } from 'zod'
import {
  listUserSchema,
  createUserSchema,
  updateUserSchema,
  userIdSchema,
  userIdsSchema,
} from '@shared/schemas/user'
import { checkAbility } from '@/middleware/permission'
import { db } from '@db'
import { users } from '@db/schema'
import { eq, like, and, desc, sql } from 'drizzle-orm'

export const userRouter = os.prefix('/users')({

  /**
   * 用户列表（分页 + 筛选 + 排序）
   */
  list: os
    .use(checkAbility('read', 'User'))
    .input(listUserSchema)
    .handler(async ({ input }) => {
      const { page, pageSize, search, status, sortBy, sortOrder } = input

      // 构建查询条件
      const conditions = []
      if (search) {
        conditions.push(
          like(users.username, `%${search}%`)
        )
      }
      if (status !== undefined) {
        conditions.push(eq(users.status, status))
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined

      // 查询数据 + 总数
      const [data, [{ total }]] = await Promise.all([
        db
          .select()
          .from(users)
          .where(where)
          .orderBy(sortOrder === 'desc' ? desc(users[sortBy]) : users[sortBy])
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ total: sql<number>`count(*)` })
          .from(users)
          .where(where),
      ])

      return {
        data,
        pagination: {
          page,
          pageSize,
          total: Number(total),
          totalPages: Math.ceil(Number(total) / pageSize),
        },
      }
    }),

  /**
   * 获取单个用户
   */
  getById: os
    .use(checkAbility('read', 'User'))
    .input(userIdSchema)
    .handler(async ({ input }) => {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1)

      if (!user.length) {
        throw new ORPCError('NOT_FOUND', { message: '用户不存在' })
      }
      return user[0]
    }),

  /**
   * 创建用户
   */
  create: os
    .use(checkAbility('create', 'User'))
    .input(createUserSchema)
    .handler(async ({ input, context }) => {
      // 检查用户名唯一性
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1)

      if (existing.length) {
        throw new ORPCError('CONFLICT', { message: '用户名已存在' })
      }

      const [user] = await db.insert(users).values({
        ...input,
        passwordHash: await hashPassword(input.password),
      }).returning()

      // 记录操作日志
      await recordOperationLog({
        module: 'system:user',
        action: 'create',
        operatorId: context.userId,
        targetId: user.id,
        detail: `创建用户: ${user.username}`,
      })

      return user
    }),

  /**
   * 更新用户
   */
  update: os
    .use(checkAbility('update', 'User'))
    .input(updateUserSchema)
    .handler(async ({ input, context }) => {
      const { id, ...updateData } = input

      const [user] = await db
        .update(users)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning()

      await recordOperationLog({
        module: 'system:user',
        action: 'update',
        operatorId: context.userId,
        targetId: id,
        detail: `更新用户: ${user.username}`,
      })

      return user
    }),

  /**
   * 删除用户
   */
  delete: os
    .use(checkAbility('delete', 'User'))
    .input(userIdSchema)
    .handler(async ({ input, context }) => {
      await db.delete(users).where(eq(users.id, input.id))

      await recordOperationLog({
        module: 'system:user',
        action: 'delete',
        operatorId: context.userId,
        targetId: input.id,
        detail: `删除用户: ${input.id}`,
      })

      return { success: true }
    }),

  /**
   * 批量删除
   */
  batchDelete: os
    .use(checkAbility('delete', 'User'))
    .input(userIdsSchema)
    .handler(async ({ input, context }) => {
      await db.delete(users).where(inArray(users.id, input.ids))

      await recordOperationLog({
        module: 'system:user',
        action: 'batchDelete',
        operatorId: context.userId,
        detail: `批量删除用户: ${input.ids.length} 个`,
      })

      return { success: true, count: input.ids.length }
    }),

  /**
   * 导出 Excel
   */
  export: os
    .use(checkAbility('export', 'User'))
    .input(listUserSchema.optional())
    .handler(async ({ input }) => {
      // 查询数据 → excelize-wasm 生成 → 返回文件 URL
      const data = await db.select().from(users)
      const fileUrl = await generateExcel('users', data)
      return { url: fileUrl }
    }),
})
```

---

## 三、Zod Schema 规范

### 3.1 Schema 文件位置

所有 Zod Schema 定义在 `packages/shared/src/schemas/` 中，前后端共享。

### 3.2 命名约定

```typescript
// packages/shared/src/schemas/user.ts
import { z } from 'zod'

// 基础 Schema（对应数据库字段）
export const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(2).max(50),
  email: z.string().email(),
  nickname: z.string().max(50).optional(),
  avatar: z.string().url().optional(),
  status: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// 创建 Schema（省略自动生成字段）
export const createUserSchema = userSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  password: z.string().min(8).max(100),
  roleIds: z.array(z.string().uuid()).min(1),
})

// 更新 Schema（所有字段可选 + 必须有 id）
export const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true })
  .extend({
    id: z.string().uuid(),
    password: z.string().min(8).max(100).optional(),
  })

// ID Schema
export const userIdSchema = z.object({
  id: z.string().uuid(),
})

// 批量 ID Schema
export const userIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
})

// 列表查询 Schema（通用分页 + 筛选）
export const listUserSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.boolean().optional(),
  sortBy: z.enum(['createdAt', 'username', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// 导出类型
export type User = z.infer<typeof userSchema>
export type CreateUser = z.infer<typeof createUserSchema>
export type UpdateUser = z.infer<typeof updateUserSchema>
export type ListUserParams = z.infer<typeof listUserSchema>
```

### 3.3 通用分页 Schema

```typescript
// packages/shared/src/schemas/common.ts

// 通用分页请求
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
})

// 通用分页响应
export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      pageSize: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  })

// 通用排序
export const sortSchema = <T extends string>(fields: readonly T[]) =>
  z.object({
    sortBy: z.enum(fields as [T, ...T[]]).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })

// 通用时间范围筛选
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})
```

---

## 四、错误处理规范

### 4.1 错误码定义

```typescript
// packages/shared/src/constants/error-codes.ts
export const ErrorCodes = {
  // 认证错误 (401xx)
  UNAUTHORIZED: { code: 40100, message: '未登录' },
  TOKEN_EXPIRED: { code: 40101, message: 'Token 已过期' },
  INVALID_TOKEN: { code: 40102, message: '无效 Token' },

  // 权限错误 (403xx)
  FORBIDDEN: { code: 40300, message: '权限不足' },
  ROLE_REQUIRED: { code: 40301, message: '需要特定角色' },

  // 资源错误 (404xx)
  NOT_FOUND: { code: 40400, message: '资源不存在' },
  USER_NOT_FOUND: { code: 40401, message: '用户不存在' },
  ROLE_NOT_FOUND: { code: 40402, message: '角色不存在' },

  // 冲突错误 (409xx)
  CONFLICT: { code: 40900, message: '资源冲突' },
  USERNAME_EXISTS: { code: 40901, message: '用户名已存在' },
  EMAIL_EXISTS: { code: 40902, message: '邮箱已存在' },
  ROLE_CODE_EXISTS: { code: 40903, message: '角色编码已存在' },

  // 验证错误 (422xx)
  VALIDATION_ERROR: { code: 42200, message: '参数验证失败' },

  // 限流错误 (429xx)
  RATE_LIMITED: { code: 42900, message: '请求过于频繁' },

  // 服务器错误 (500xx)
  INTERNAL_ERROR: { code: 50000, message: '服务器内部错误' },
  AI_ERROR: { code: 50001, message: 'AI 服务异常' },
  DB_ERROR: { code: 50002, message: '数据库异常' },
} as const
```

### 4.2 全局错误处理中间件

```typescript
// apps/api/src/middleware/error-handler.ts
import { type ErrorHandler } from 'hono'

export const errorHandler: ErrorHandler = (err, c) => {
  // oRPC 错误
  if (err instanceof ORPCError) {
    return c.json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    }, err.status)
  }

  // HTTP 异常
  if (err instanceof HTTPException) {
    return c.json({
      success: false,
      error: {
        code: err.status * 100,
        message: err.message,
      },
    }, err.status)
  }

  // Zod 验证错误
  if (err instanceof z.ZodError) {
    return c.json({
      success: false,
      error: {
        code: 42200,
        message: '参数验证失败',
        details: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    }, 422)
  }

  // 未知错误
  console.error('Unhandled error:', err)
  return c.json({
    success: false,
    error: {
      code: 50000,
      message: '服务器内部错误',
    },
  }, 500)
}
```

---

## 五、中间件链

### 5.1 标准中间件顺序

```typescript
// apps/api/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { requestId } from 'hono/request-id'
import { logger } from './middleware/logger'
import { rateLimiter } from './middleware/rate-limit'
import { auth } from './middleware/auth'
import { errorHandler } from './middleware/error-handler'

const app = new Hono()

// 1. 安全头
app.use('*', secureHeaders())

// 2. CORS
app.use('*', cors({
  origin: process.env.FRONTEND_URL!,
  credentials: true,
}))

// 3. 请求 ID（用于链路追踪）
app.use('*', requestId())

// 4. 请求日志
app.use('*', logger())

// 5. 限流
app.use('/api/*', rateLimiter({
  windowMs: 60 * 1000,     // 1 分钟
  max: 100,                 // 最多 100 次
}))

// 6. 认证（排除公开路由）
app.use('/api/v1/*', auth())

// 7. 错误处理
app.onError(errorHandler)

// 8. 挂载路由
app.route('/', orpcRouter)
app.route('/mastra', mastraRouter)
```

---

## 六、OpenAPI 文档规范

### 6.1 oRPC 自动生成 OpenAPI

oRPC 自动将路由、Zod Schema 转为 OpenAPI 3.1 规范。

### 6.2 Scalar UI 配置

```typescript
// apps/api/src/routes/docs.ts
import { apiReference } from '@scalar/hono-api-reference'

app.get('/api/docs', apiReference({
  spec: {
    url: '/api/openapi.json',
  },
  theme: 'kepler',
  layout: 'modern',
  pageTitle: 'AI Native OS API',
}))
```

### 6.3 文档分组约定

OpenAPI Tag 与路由前缀对应：

| Tag | 路径前缀 | 说明 |
|-----|---------|------|
| `System:Users` | `/api/v1/system/users` | 用户管理 |
| `System:Roles` | `/api/v1/system/roles` | 角色管理 |
| `System:Permissions` | `/api/v1/system/permissions` | 权限管理 |
| `System:Menus` | `/api/v1/system/menus` | 菜单管理 |
| `System:Dicts` | `/api/v1/system/dicts` | 字典管理 |
| `System:Config` | `/api/v1/system/config` | 系统配置 |
| `Monitor:Logs` | `/api/v1/monitor/logs` | 操作日志 |
| `Monitor:Online` | `/api/v1/monitor/online` | 在线用户 |
| `AI:Knowledge` | `/api/v1/ai/knowledge` | 知识库管理 |
| `AI:Evals` | `/api/v1/ai/evals` | AI 评估 |
| `AI:Audit` | `/api/v1/ai/audit` | AI 审计 |

---

## 七、前端 oRPC 客户端使用

### 7.1 客户端配置

```typescript
// apps/web/lib/orpc.ts
import { createORPCClient } from '@orpc/client'
import { createORPCReactQueryUtils } from '@orpc/react-query'
import type { AppRouter } from '@api/routes'

const client = createORPCClient<AppRouter>({
  baseURL: process.env.NEXT_PUBLIC_API_URL!,
  headers: async () => {
    const token = getAuthToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
})

// TanStack Query 集成
export const orpc = createORPCReactQueryUtils(client)
```

### 7.2 前端使用示例

```typescript
// 在 React 组件中使用
function UsersPage() {
  // 查询
  const { data, isLoading } = orpc.system.users.list.useQuery({
    input: { page: 1, pageSize: 10 },
  })

  // 创建
  const createMutation = orpc.system.users.create.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.system.users.list.getQueryKey() })
      toast.success('用户创建成功')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // 调用
  createMutation.mutate({
    username: 'newuser',
    email: 'new@example.com',
    password: 'password123',
    roleIds: ['role-uuid'],
  })
}
```

---

## 八、操作日志规范

### 8.1 日志记录函数

```typescript
// apps/api/src/lib/audit.ts
import { db } from '@db'
import { operationLogs } from '@db/schema'

interface OperationLogParams {
  module: string              // 模块标识: 'system:user', 'ai:knowledge'
  action: string              // 操作: 'create', 'update', 'delete', 'export', 'login'
  operatorId: string          // 操作者 ID
  targetId?: string           // 操作目标 ID
  detail: string              // 操作描述
  requestInfo?: {             // 请求信息
    ip: string
    userAgent: string
    method: string
    path: string
  }
  status?: 'success' | 'failure'
  errorMessage?: string
}

export async function recordOperationLog(params: OperationLogParams) {
  await db.insert(operationLogs).values({
    ...params,
    status: params.status ?? 'success',
    createdAt: new Date(),
  })
}
```

### 8.2 必须记录日志的操作

| 模块 | 操作 | 日志级别 |
|------|------|---------|
| 所有模块 | create / update / delete | 必须记录 |
| 用户管理 | 登录 / 登出 / 修改密码 | 必须记录 |
| 角色权限 | 任何变更 | 必须记录 |
| 系统配置 | 任何变更 | 必须记录 |
| AI Agent | 所有工具调用 | 必须记录（到 ai_audit_logs） |
| 数据导出 | export / import | 必须记录 |
