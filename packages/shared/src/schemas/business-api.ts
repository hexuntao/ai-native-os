import { z } from 'zod'

import { appActions, appSubjects } from '../abilities/subjects'
import {
  aiEvalRunStatusSchema,
  aiEvalScorerSummarySchema,
  aiEvalTriggerSourceSchema,
} from './ai-evals'
import {
  aiFeedbackEntrySchema,
  aiFeedbackSummarySchema,
  aiFeedbackUserActionSchema,
} from './ai-feedback'
import { aiKnowledgeMetadataSchema } from './ai-knowledge'
import { promptVersionEntrySchema } from './ai-prompts'
import { aiRuntimeCapabilitySchema } from './ai-runtime'
import { aiAuditLogEntrySchema } from './ai-tools'
import { paginatedResponseSchema } from './common'
import { dependencyHealthStatusSchema, telemetryHealthSchema } from './health'
import { withOpenApiSchemaDoc } from './openapi-doc'

const queryPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

const booleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => (typeof value === 'boolean' ? value : value === 'true'))

const baseSearchSchema = queryPaginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
})

const userIdSchema = withOpenApiSchemaDoc(z.string().uuid(), {
  title: 'UserId',
  description: '应用用户主键 UUID，用于定位单个后台用户主体。',
  examples: ['4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001'],
})

const usernameFieldSchema = withOpenApiSchemaDoc(z.string().trim().min(3).max(50), {
  title: 'Username',
  description: '系统内唯一用户名，用于后台用户标识与目录检索，不直接替代邮箱登录。',
  examples: ['alice_admin'],
})

const emailFieldSchema = withOpenApiSchemaDoc(z.string().trim().email(), {
  title: 'UserEmail',
  description: '登录邮箱，必须唯一；创建或更新时会同步到 Better Auth 主体。',
  examples: ['alice@example.com'],
})

const userStatusFieldSchema = withOpenApiSchemaDoc(z.boolean(), {
  title: 'UserStatus',
  description: '用户启用状态，`true` 表示启用，`false` 表示停用。',
  examples: [true],
  default: true,
})

export const listUsersInputSchema = withOpenApiSchemaDoc(
  baseSearchSchema.extend({
    status: withOpenApiSchemaDoc(booleanQuerySchema.optional(), {
      title: 'UserStatusFilter',
      description: '按启用状态过滤用户；省略时返回全部状态。',
      examples: [true],
    }),
  }),
  {
    title: 'ListUsersInput',
    description: '用户目录分页查询参数，支持按用户名/邮箱关键词与启停状态筛选。',
    examples: [
      {
        page: 1,
        pageSize: 10,
        search: 'alice',
        status: true,
      },
    ],
  },
)

const roleCodeSchema = withOpenApiSchemaDoc(z.string().trim().min(1).max(50), {
  title: 'RoleCode',
  description: 'RBAC 角色编码，必须对应一个已激活角色，例如 `admin` 或 `viewer`。',
  examples: ['admin'],
})

const nullableNicknameSchema = withOpenApiSchemaDoc(
  z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value
    }

    const trimmedValue = value.trim()

    return trimmedValue.length === 0 ? null : trimmedValue
  }, z.string().trim().min(1).max(50).nullable()),
  {
    title: 'UserNickname',
    description: '用户昵称，可为空字符串；空字符串会在入库前归一化为 `null`。',
    examples: ['Alice'],
  },
)

const requiredPasswordSchema = withOpenApiSchemaDoc(z.string().min(12).max(100), {
  title: 'UserPassword',
  description: '初始登录密码，最少 12 位；仅在创建用户或显式重置密码时使用，不会在任何响应中返回。',
  examples: ['Passw0rd!Passw0rd!'],
})

const optionalPasswordSchema = withOpenApiSchemaDoc(
  z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value
    }

    const trimmedValue = value.trim()

    return trimmedValue.length === 0 ? undefined : trimmedValue
  }, z.string().min(12).max(100).optional()),
  {
    title: 'OptionalUserPassword',
    description: '可选密码重置字段；留空表示不重置 Better Auth credential，填写时会更新登录密码。',
    examples: ['Passw0rd!Passw0rd!'],
  },
)

const roleCodesFieldSchema = withOpenApiSchemaDoc(z.array(roleCodeSchema).max(10).default([]), {
  title: 'UserRoleCodes',
  description: '用户绑定的角色编码列表，最多 10 个；后端会校验这些角色必须存在且处于激活状态。',
  examples: [['admin'], ['viewer', 'editor']],
  default: [],
})

export const userListItemSchema = withOpenApiSchemaDoc(
  z.object({
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'UserCreatedAt',
      description: '用户创建时间，ISO 8601 字符串。',
      examples: ['2026-04-09T09:30:00.000Z'],
    }),
    email: emailFieldSchema,
    id: userIdSchema,
    nickname: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'UserNicknameNullable',
      description: '用户昵称；未设置时为 `null`。',
      examples: ['Alice'],
    }),
    roleCodes: withOpenApiSchemaDoc(z.array(z.string()), {
      title: 'ResolvedUserRoleCodes',
      description: '当前用户已绑定的角色编码列表，按稳定顺序返回。',
      examples: [['admin']],
    }),
    status: userStatusFieldSchema,
    updatedAt: withOpenApiSchemaDoc(z.string(), {
      title: 'UserUpdatedAt',
      description: '用户最近一次更新时间，ISO 8601 字符串。',
      examples: ['2026-04-09T10:00:00.000Z'],
    }),
    username: usernameFieldSchema,
  }),
  {
    title: 'UserEntry',
    description: '后台用户目录条目，包含应用用户基础信息与当前归一化后的 RBAC 角色编码。',
    examples: [
      {
        id: '4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001',
        username: 'alice_admin',
        email: 'alice@example.com',
        nickname: 'Alice',
        roleCodes: ['admin'],
        status: true,
        createdAt: '2026-04-09T09:30:00.000Z',
        updatedAt: '2026-04-09T10:00:00.000Z',
      },
    ],
  },
)

export const userEntrySchema = userListItemSchema

export const userListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(userListItemSchema),
  {
    title: 'UserListResponse',
    description: '用户目录分页响应，返回当前页数据与标准分页信息。',
    examples: [
      {
        data: [
          {
            id: '4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001',
            username: 'alice_admin',
            email: 'alice@example.com',
            nickname: 'Alice',
            roleCodes: ['admin'],
            status: true,
            createdAt: '2026-04-09T09:30:00.000Z',
            updatedAt: '2026-04-09T10:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      },
    ],
  },
)

export const getUserByIdInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: userIdSchema,
  }),
  {
    title: 'GetUserByIdInput',
    description: '按用户 UUID 读取单个后台用户主体详情。',
    examples: [
      {
        id: '4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001',
      },
    ],
  },
)

export const createUserInputSchema = withOpenApiSchemaDoc(
  z.object({
    email: emailFieldSchema,
    nickname: withOpenApiSchemaDoc(nullableNicknameSchema.default(null), {
      title: 'CreateUserNickname',
      description: '用户昵称，未填写时默认写入 `null`。',
      examples: ['Alice'],
      default: null,
    }),
    password: requiredPasswordSchema,
    roleCodes: roleCodesFieldSchema,
    status: withOpenApiSchemaDoc(userStatusFieldSchema.default(true), {
      title: 'CreateUserStatus',
      description: '创建后是否立即启用；默认 `true`。',
      examples: [true],
      default: true,
    }),
    username: usernameFieldSchema,
  }),
  {
    title: 'CreateUserInput',
    description:
      '创建后台用户主体，请求会同时写入应用用户表、Better Auth 凭证主体以及 RBAC 角色绑定。',
    examples: [
      {
        username: 'alice_admin',
        email: 'alice@example.com',
        nickname: 'Alice',
        password: 'Passw0rd!Passw0rd!',
        roleCodes: ['admin'],
        status: true,
      },
    ],
  },
)

export const updateUserInputSchema = withOpenApiSchemaDoc(
  z.object({
    email: emailFieldSchema,
    id: userIdSchema,
    nickname: withOpenApiSchemaDoc(nullableNicknameSchema.default(null), {
      title: 'UpdateUserNickname',
      description: '更新后的用户昵称，空字符串会归一化为 `null`。',
      examples: ['Alice Ops'],
      default: null,
    }),
    password: optionalPasswordSchema,
    roleCodes: roleCodesFieldSchema,
    status: userStatusFieldSchema,
    username: usernameFieldSchema,
  }),
  {
    title: 'UpdateUserInput',
    description:
      '更新后台用户主体与 RBAC 角色绑定；如提供 `password`，还会同步重置 Better Auth credential。',
    examples: [
      {
        id: '4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001',
        username: 'alice_admin',
        email: 'alice@example.com',
        nickname: 'Alice Ops',
        roleCodes: ['editor'],
        status: true,
      },
    ],
  },
)

export const deleteUserInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: userIdSchema,
  }),
  {
    title: 'DeleteUserInput',
    description: '删除后台用户主体的请求参数，按 UUID 指定目标用户。',
    examples: [
      {
        id: '4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001',
      },
    ],
  },
)

export const deleteUserResultSchema = withOpenApiSchemaDoc(
  z.object({
    deleted: withOpenApiSchemaDoc(z.literal(true), {
      title: 'DeleteUserSuccessFlag',
      description: '删除成功标志，固定为 `true`。',
      examples: [true],
    }),
    id: userIdSchema,
  }),
  {
    title: 'DeleteUserResult',
    description: '用户删除成功后的标准响应。',
    examples: [
      {
        deleted: true,
        id: '4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001',
      },
    ],
  },
)

const roleIdSchema = withOpenApiSchemaDoc(z.string().uuid(), {
  title: 'RoleId',
  description: '角色主键 UUID，用于唯一标识一个 RBAC 角色。',
  examples: ['9d2a4f4b-f4a9-4f44-a9c0-6d5cfa542001'],
})

const roleNameFieldSchema = withOpenApiSchemaDoc(z.string().trim().min(1).max(50), {
  title: 'RoleName',
  description: '角色显示名称，用于后台管理页面和权限分配界面展示。',
  examples: ['系统管理员'],
})

const nullableRoleDescriptionSchema = withOpenApiSchemaDoc(
  z.string().trim().min(1).max(200).nullable(),
  {
    title: 'RoleDescription',
    description: '角色说明；未填写时返回 `null`。',
    examples: ['拥有用户、菜单与权限管理能力。'],
  },
)

const roleSortOrderSchema = withOpenApiSchemaDoc(z.number().int(), {
  title: 'RoleSortOrder',
  description: '角色排序值，数值越小越靠前。',
  examples: [10],
})

const roleStatusFieldSchema = withOpenApiSchemaDoc(z.boolean(), {
  title: 'RoleStatus',
  description: '角色启用状态，`true` 为启用，`false` 为停用。',
  examples: [true],
})

const roleUserCountSchema = withOpenApiSchemaDoc(z.number().int().min(0), {
  title: 'RoleUserCount',
  description: '当前绑定该角色的用户数量。',
  examples: [3],
})

const rolePermissionCountSchema = withOpenApiSchemaDoc(z.number().int().min(0), {
  title: 'RolePermissionCount',
  description: '当前角色已绑定的权限规则数量。',
  examples: [18],
})

const appActionFieldSchema = withOpenApiSchemaDoc(z.enum(appActions), {
  title: 'PermissionAction',
  description: 'CASL 动作枚举，例如 `read`、`manage`、`export`。',
  examples: ['read'],
})

const appSubjectFieldSchema = withOpenApiSchemaDoc(z.enum(appSubjects), {
  title: 'PermissionResource',
  description: '权限资源枚举，对应系统中可受控的业务主体。',
  examples: ['User'],
})

const permissionIdSchema = withOpenApiSchemaDoc(z.string().uuid(), {
  title: 'PermissionId',
  description: '权限规则主键 UUID。',
  examples: ['2f3dc6ce-3c88-4db0-b194-f8506bbf1001'],
})

const rolePermissionIdsFieldSchema = withOpenApiSchemaDoc(
  z.array(permissionIdSchema).max(200).default([]),
  {
    title: 'RolePermissionIds',
    description:
      '当前角色绑定的权限规则主键列表，供角色编辑表单直接回填；后端会在写入时校验这些权限必须存在。',
    examples: [['2f3dc6ce-3c88-4db0-b194-f8506bbf1001']],
    default: [],
  },
)

const permissionFieldsSchema = withOpenApiSchemaDoc(z.array(z.string()).nullable(), {
  title: 'PermissionFields',
  description: '字段级权限约束；为空表示不限制字段维度。',
  examples: [['email', 'nickname'], null],
})

const permissionConditionsSchema = withOpenApiSchemaDoc(
  z.record(z.string(), z.unknown()).nullable(),
  {
    title: 'PermissionConditions',
    description: 'CASL 条件表达式；为空表示无条件放行。',
    examples: [{ ownerId: '{{currentUserId}}' }, null],
  },
)

const permissionInvertedSchema = withOpenApiSchemaDoc(z.boolean(), {
  title: 'PermissionInverted',
  description: '是否为反向规则；`true` 表示禁止规则，`false` 表示允许规则。',
  examples: [false],
})

const permissionRoleCountSchema = withOpenApiSchemaDoc(z.number().int().min(0), {
  title: 'PermissionRoleCount',
  description: '当前引用该权限规则的角色数量。',
  examples: [2],
})

export const listRolesInputSchema = withOpenApiSchemaDoc(
  baseSearchSchema.extend({
    status: withOpenApiSchemaDoc(booleanQuerySchema.optional(), {
      title: 'RoleStatusFilter',
      description: '按角色启用状态过滤；省略时返回全部角色。',
      examples: [true],
    }),
  }),
  {
    title: 'ListRolesInput',
    description: '角色管理分页查询参数，支持按角色名称关键词与启停状态筛选。',
    examples: [
      {
        page: 1,
        pageSize: 10,
        search: '管理员',
        status: true,
      },
    ],
  },
)

export const roleListItemSchema = withOpenApiSchemaDoc(
  z.object({
    code: withOpenApiSchemaDoc(roleCodeSchema, {
      title: 'ResolvedRoleCode',
      description: '角色编码，作为 RBAC 绑定与权限推导的稳定标识。',
      examples: ['admin'],
    }),
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'RoleCreatedAt',
      description: '角色创建时间，ISO 8601 字符串。',
      examples: ['2026-04-09T09:30:00.000Z'],
    }),
    description: nullableRoleDescriptionSchema,
    id: roleIdSchema,
    name: roleNameFieldSchema,
    permissionCount: rolePermissionCountSchema,
    permissionIds: rolePermissionIdsFieldSchema,
    sortOrder: roleSortOrderSchema,
    status: roleStatusFieldSchema,
    updatedAt: withOpenApiSchemaDoc(z.string(), {
      title: 'RoleUpdatedAt',
      description: '角色最近更新时间，ISO 8601 字符串。',
      examples: ['2026-04-09T10:00:00.000Z'],
    }),
    userCount: roleUserCountSchema,
  }),
  {
    title: 'RoleEntry',
    description:
      '角色目录条目，包含角色基础信息、权限绑定主键列表以及用户数/权限数两个管理摘要，可直接用于角色编辑表单回填。',
    examples: [
      {
        id: '9d2a4f4b-f4a9-4f44-a9c0-6d5cfa542001',
        code: 'admin',
        name: '系统管理员',
        description: '拥有用户、菜单与权限管理能力。',
        sortOrder: 10,
        status: true,
        userCount: 3,
        permissionCount: 18,
        permissionIds: ['2f3dc6ce-3c88-4db0-b194-f8506bbf1001'],
        createdAt: '2026-04-09T09:30:00.000Z',
        updatedAt: '2026-04-09T10:00:00.000Z',
      },
    ],
  },
)

export const roleEntrySchema = roleListItemSchema

export const getRoleByIdInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: roleIdSchema,
  }),
  {
    title: 'GetRoleByIdInput',
    description: '按角色 UUID 读取单个角色详情，包括已绑定权限主键列表。',
    examples: [
      {
        id: '9d2a4f4b-f4a9-4f44-a9c0-6d5cfa542001',
      },
    ],
  },
)

export const createRoleInputSchema = withOpenApiSchemaDoc(
  z.object({
    code: withOpenApiSchemaDoc(roleCodeSchema, {
      title: 'CreateRoleCode',
      description:
        '新角色编码，作为稳定 RBAC 标识使用；不得复用系统保留编码，例如 `super_admin`、`admin`、`editor`、`viewer`。',
      examples: ['ops_auditor'],
    }),
    description: withOpenApiSchemaDoc(nullableRoleDescriptionSchema.default(null), {
      title: 'CreateRoleDescription',
      description: '角色说明，未填写时默认写入 `null`。',
      examples: ['面向运维审计成员的只读巡检角色。'],
      default: null,
    }),
    name: withOpenApiSchemaDoc(roleNameFieldSchema, {
      title: 'CreateRoleName',
      description: '角色显示名称，用于后台管理界面和成员分配表单。',
      examples: ['运维审计员'],
    }),
    permissionIds: rolePermissionIdsFieldSchema,
    sortOrder: withOpenApiSchemaDoc(z.coerce.number().int().min(-9999).max(9999), {
      title: 'CreateRoleSortOrder',
      description: '创建角色时的排序值；数值越小越靠前。',
      examples: [30],
      default: 0,
    }),
    status: withOpenApiSchemaDoc(roleStatusFieldSchema.default(true), {
      title: 'CreateRoleStatus',
      description: '创建后是否立即启用；默认 `true`。',
      examples: [true],
      default: true,
    }),
  }),
  {
    title: 'CreateRoleInput',
    description:
      '创建一个自定义 RBAC 角色，并同步绑定权限规则；系统保留角色编码不可通过该接口复用。',
    examples: [
      {
        code: 'ops_auditor',
        name: '运维审计员',
        description: '面向运维审计成员的只读巡检角色。',
        sortOrder: 30,
        status: true,
        permissionIds: ['2f3dc6ce-3c88-4db0-b194-f8506bbf1001'],
      },
    ],
  },
)

export const updateRoleInputSchema = withOpenApiSchemaDoc(
  z.object({
    code: withOpenApiSchemaDoc(roleCodeSchema, {
      title: 'UpdateRoleCode',
      description:
        '更新后的角色编码，仍作为稳定 RBAC 标识使用；系统保留角色与系统保留编码不可在该接口中改写。',
      examples: ['ops_auditor'],
    }),
    description: withOpenApiSchemaDoc(nullableRoleDescriptionSchema.default(null), {
      title: 'UpdateRoleDescription',
      description: '更新后的角色说明，空字符串会归一化为 `null`。',
      examples: ['面向运维审计成员的只读巡检角色。'],
      default: null,
    }),
    id: roleIdSchema,
    name: withOpenApiSchemaDoc(roleNameFieldSchema, {
      title: 'UpdateRoleName',
      description: '更新后的角色显示名称。',
      examples: ['运维审计员'],
    }),
    permissionIds: rolePermissionIdsFieldSchema,
    sortOrder: withOpenApiSchemaDoc(z.coerce.number().int().min(-9999).max(9999), {
      title: 'UpdateRoleSortOrder',
      description: '更新后的排序值；数值越小越靠前。',
      examples: [30],
    }),
    status: roleStatusFieldSchema,
  }),
  {
    title: 'UpdateRoleInput',
    description:
      '更新自定义 RBAC 角色的基础信息、启停状态与权限绑定；系统保留角色会在服务端被拒绝修改。',
    examples: [
      {
        id: '9d2a4f4b-f4a9-4f44-a9c0-6d5cfa542001',
        code: 'ops_auditor',
        name: '运维审计员',
        description: '覆盖运维巡检与审计查询的角色。',
        sortOrder: 40,
        status: true,
        permissionIds: ['2f3dc6ce-3c88-4db0-b194-f8506bbf1001'],
      },
    ],
  },
)

export const deleteRoleInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: roleIdSchema,
  }),
  {
    title: 'DeleteRoleInput',
    description: '删除角色的请求参数，按角色 UUID 指定目标。',
    examples: [
      {
        id: '9d2a4f4b-f4a9-4f44-a9c0-6d5cfa542001',
      },
    ],
  },
)

export const deleteRoleResultSchema = withOpenApiSchemaDoc(
  z.object({
    deleted: withOpenApiSchemaDoc(z.literal(true), {
      title: 'DeleteRoleSuccessFlag',
      description: '角色删除成功标志，固定为 `true`。',
      examples: [true],
    }),
    id: roleIdSchema,
  }),
  {
    title: 'DeleteRoleResult',
    description: '角色删除成功后的标准响应。',
    examples: [
      {
        deleted: true,
        id: '9d2a4f4b-f4a9-4f44-a9c0-6d5cfa542001',
      },
    ],
  },
)

export const roleListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(roleListItemSchema),
  {
    title: 'RoleListResponse',
    description: '角色管理分页响应，返回角色列表与标准分页信息。',
    examples: [
      {
        data: [
          {
            id: '9d2a4f4b-f4a9-4f44-a9c0-6d5cfa542001',
            code: 'admin',
            name: '系统管理员',
            description: '拥有用户、菜单与权限管理能力。',
            sortOrder: 10,
            status: true,
            userCount: 3,
            permissionCount: 18,
            createdAt: '2026-04-09T09:30:00.000Z',
            updatedAt: '2026-04-09T10:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      },
    ],
  },
)

export const listPermissionsInputSchema = withOpenApiSchemaDoc(
  baseSearchSchema.extend({
    action: withOpenApiSchemaDoc(appActionFieldSchema.optional(), {
      title: 'PermissionActionFilter',
      description: '按 CASL 动作过滤权限规则；省略时返回所有动作。',
      examples: ['read'],
    }),
    resource: withOpenApiSchemaDoc(appSubjectFieldSchema.optional(), {
      title: 'PermissionResourceFilter',
      description: '按资源主体过滤权限规则；省略时返回所有资源。',
      examples: ['User'],
    }),
  }),
  {
    title: 'ListPermissionsInput',
    description: '权限规则分页查询参数，支持按资源、动作和关键词搜索筛选。',
    examples: [
      {
        page: 1,
        pageSize: 10,
        search: 'User',
        resource: 'User',
        action: 'read',
      },
    ],
  },
)

export const permissionListItemSchema = withOpenApiSchemaDoc(
  z.object({
    action: appActionFieldSchema,
    conditions: permissionConditionsSchema,
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'PermissionCreatedAt',
      description: '权限规则创建时间，ISO 8601 字符串。',
      examples: ['2026-04-09T09:30:00.000Z'],
    }),
    description: withOpenApiSchemaDoc(z.string().trim().min(1).max(200).nullable(), {
      title: 'PermissionDescription',
      description: '权限规则说明；未填写时返回 `null`。',
      examples: ['允许管理员读取用户目录。'],
    }),
    fields: permissionFieldsSchema,
    id: permissionIdSchema,
    inverted: permissionInvertedSchema,
    roleCount: permissionRoleCountSchema,
    resource: appSubjectFieldSchema,
  }),
  {
    title: 'PermissionEntry',
    description: '权限规则条目，表示一条 CASL 资源动作规则及其条件约束，并附带角色引用数量摘要。',
    examples: [
      {
        id: '2f3dc6ce-3c88-4db0-b194-f8506bbf1001',
        resource: 'User',
        action: 'read',
        description: '允许管理员读取用户目录。',
        fields: ['email', 'nickname'],
        conditions: null,
        inverted: false,
        roleCount: 2,
        createdAt: '2026-04-09T09:30:00.000Z',
      },
    ],
  },
)

export const permissionEntrySchema = permissionListItemSchema

export const getPermissionByIdInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: permissionIdSchema,
  }),
  {
    title: 'GetPermissionByIdInput',
    description: '按权限 UUID 读取单个权限规则详情。',
    examples: [
      {
        id: '2f3dc6ce-3c88-4db0-b194-f8506bbf1001',
      },
    ],
  },
)

export const createPermissionInputSchema = withOpenApiSchemaDoc(
  z.object({
    action: withOpenApiSchemaDoc(appActionFieldSchema, {
      title: 'CreatePermissionAction',
      description: '新权限规则的 CASL 动作，例如 `read`、`update`、`approve`。',
      examples: ['approve'],
    }),
    conditions: withOpenApiSchemaDoc(permissionConditionsSchema.default(null), {
      title: 'CreatePermissionConditions',
      description: '创建时的 CASL 条件表达式；未填写时默认 `null`。',
      examples: [{ department: 'finance' }, null],
      default: null,
    }),
    description: withOpenApiSchemaDoc(z.string().trim().min(1).max(200).nullable().default(null), {
      title: 'CreatePermissionDescription',
      description: '权限说明，未填写时默认写入 `null`。',
      examples: ['允许财务审批员处理指定部门审批单。'],
      default: null,
    }),
    fields: withOpenApiSchemaDoc(permissionFieldsSchema.default(null), {
      title: 'CreatePermissionFields',
      description: '可选字段范围；未填写时默认 `null`，表示不限制字段维度。',
      examples: [['status', 'approverId'], null],
      default: null,
    }),
    inverted: withOpenApiSchemaDoc(permissionInvertedSchema.default(false), {
      title: 'CreatePermissionInverted',
      description: '是否创建为禁止规则；默认 `false`。',
      examples: [false],
      default: false,
    }),
    resource: withOpenApiSchemaDoc(appSubjectFieldSchema, {
      title: 'CreatePermissionResource',
      description: '新权限规则的资源主体，对应系统中的受控业务对象。',
      examples: ['Approval'],
    }),
  }),
  {
    title: 'CreatePermissionInput',
    description:
      '创建自定义权限规则；系统保留权限与 `manage:all` 提升会在服务端被拒绝，且完全重复的权限规则不会重复创建。',
    examples: [
      {
        resource: 'Approval',
        action: 'approve',
        description: '允许财务审批员处理指定部门审批单。',
        fields: ['status', 'approverId'],
        conditions: { department: 'finance' },
        inverted: false,
      },
    ],
  },
)

export const updatePermissionInputSchema = withOpenApiSchemaDoc(
  z.object({
    action: withOpenApiSchemaDoc(appActionFieldSchema, {
      title: 'UpdatePermissionAction',
      description: '更新后的 CASL 动作。',
      examples: ['approve'],
    }),
    conditions: withOpenApiSchemaDoc(permissionConditionsSchema.default(null), {
      title: 'UpdatePermissionConditions',
      description: '更新后的 CASL 条件表达式；空对象和 `null` 会按原样保存。',
      examples: [{ department: 'finance' }, null],
      default: null,
    }),
    description: withOpenApiSchemaDoc(z.string().trim().min(1).max(200).nullable().default(null), {
      title: 'UpdatePermissionDescription',
      description: '更新后的权限说明；未填写时归一化为 `null`。',
      examples: ['允许财务审批员处理指定部门审批单。'],
      default: null,
    }),
    fields: withOpenApiSchemaDoc(permissionFieldsSchema.default(null), {
      title: 'UpdatePermissionFields',
      description: '更新后的字段范围；未填写时表示不限制字段。',
      examples: [['status', 'approverId'], null],
      default: null,
    }),
    id: permissionIdSchema,
    inverted: permissionInvertedSchema,
    resource: withOpenApiSchemaDoc(appSubjectFieldSchema, {
      title: 'UpdatePermissionResource',
      description: '更新后的资源主体。',
      examples: ['Approval'],
    }),
  }),
  {
    title: 'UpdatePermissionInput',
    description:
      '更新自定义权限规则；若该权限已被角色引用，则只能修改说明，规则语义变更需先解绑角色后再操作。',
    examples: [
      {
        id: '2f3dc6ce-3c88-4db0-b194-f8506bbf1001',
        resource: 'Approval',
        action: 'approve',
        description: '允许财务审批员处理指定部门审批单。',
        fields: ['status', 'approverId'],
        conditions: { department: 'finance' },
        inverted: false,
      },
    ],
  },
)

export const deletePermissionInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: permissionIdSchema,
  }),
  {
    title: 'DeletePermissionInput',
    description: '删除权限规则的请求参数，按权限 UUID 指定目标。',
    examples: [
      {
        id: '2f3dc6ce-3c88-4db0-b194-f8506bbf1001',
      },
    ],
  },
)

export const deletePermissionResultSchema = withOpenApiSchemaDoc(
  z.object({
    deleted: withOpenApiSchemaDoc(z.literal(true), {
      title: 'DeletePermissionSuccessFlag',
      description: '权限删除成功标志，固定为 `true`。',
      examples: [true],
    }),
    id: permissionIdSchema,
  }),
  {
    title: 'DeletePermissionResult',
    description: '权限规则删除成功后的标准响应。',
    examples: [
      {
        deleted: true,
        id: '2f3dc6ce-3c88-4db0-b194-f8506bbf1001',
      },
    ],
  },
)

export const permissionListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(permissionListItemSchema),
  {
    title: 'PermissionListResponse',
    description: '权限规则分页响应，返回规则列表与标准分页信息。',
    examples: [
      {
        data: [
          {
            id: '2f3dc6ce-3c88-4db0-b194-f8506bbf1001',
            resource: 'User',
            action: 'read',
            description: '允许管理员读取用户目录。',
            fields: ['email', 'nickname'],
            conditions: null,
            inverted: false,
            roleCount: 2,
            createdAt: '2026-04-09T09:30:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      },
    ],
  },
)

const menuIdSchema = withOpenApiSchemaDoc(z.string().uuid(), {
  title: 'MenuId',
  description: '菜单记录主键，使用 UUID 表示唯一菜单节点。',
  examples: ['6f8174e8-f5d5-4c0b-b805-75af3384d101'],
})

const menuParentIdSchema = withOpenApiSchemaDoc(z.string().uuid().nullable(), {
  title: 'MenuParentId',
  description: '父级菜单主键；顶级菜单返回 `null`。',
  examples: ['2d5f0abc-7b89-4d85-a5b7-0f9154c4a110', null],
})

const menuNameFieldSchema = withOpenApiSchemaDoc(z.string().trim().min(1).max(50), {
  title: 'MenuName',
  description: '菜单名称，用于后台导航和菜单管理界面展示。',
  examples: ['菜单管理'],
})

const nullableMenuPathSchema = withOpenApiSchemaDoc(z.string().trim().min(1).max(200).nullable(), {
  title: 'MenuPath',
  description: '菜单路由路径；目录节点可为空，叶子菜单建议使用站内绝对路径，形如 `/system/menus`。',
  examples: ['/system/menus', null],
})

const nullableMenuComponentSchema = withOpenApiSchemaDoc(
  z.string().trim().min(1).max(200).nullable(),
  {
    title: 'MenuComponent',
    description: '菜单关联的前端页面组件标识；目录节点可为空。',
    examples: ['system/menus/page', null],
  },
)

const nullableMenuIconSchema = withOpenApiSchemaDoc(z.string().trim().min(1).max(50).nullable(), {
  title: 'MenuIcon',
  description: '菜单图标标识，供后台导航渲染图标时使用。',
  examples: ['menu', 'settings', null],
})

const menuTypeFieldSchema = withOpenApiSchemaDoc(z.enum(['button', 'directory', 'menu']), {
  title: 'MenuType',
  description:
    '菜单节点类型；`directory` 表示目录，`menu` 表示页面菜单，`button` 表示细粒度动作入口。',
  examples: ['menu'],
})

const menuSortOrderSchema = withOpenApiSchemaDoc(z.number().int(), {
  title: 'MenuSortOrder',
  description: '菜单排序值；数值越小在同级中越靠前。',
  examples: [30],
})

const menuStatusFieldSchema = withOpenApiSchemaDoc(z.boolean(), {
  title: 'MenuStatus',
  description: '菜单启用状态；`true` 表示启用，`false` 表示停用。',
  examples: [true],
})

const menuVisibleFieldSchema = withOpenApiSchemaDoc(z.boolean(), {
  title: 'MenuVisible',
  description: '菜单是否在导航中可见；隐藏菜单仍可作为深链或受控入口存在。',
  examples: [true],
})

const nullableMenuPermissionActionSchema = withOpenApiSchemaDoc(z.enum(appActions).nullable(), {
  title: 'MenuPermissionAction',
  description: '菜单访问所需的动作权限；未绑定权限时返回 `null`。',
  examples: ['read', null],
})

const nullableMenuPermissionResourceSchema = withOpenApiSchemaDoc(z.enum(appSubjects).nullable(), {
  title: 'MenuPermissionResource',
  description: '菜单访问所需的资源主体；未绑定权限时返回 `null`。',
  examples: ['Menu', null],
})

export const listMenusInputSchema = withOpenApiSchemaDoc(
  baseSearchSchema.extend({
    status: withOpenApiSchemaDoc(booleanQuerySchema.optional(), {
      title: 'MenuStatusFilter',
      description: '按菜单启停状态过滤；省略时返回全部状态。',
      examples: [true],
    }),
    visible: withOpenApiSchemaDoc(booleanQuerySchema.optional(), {
      title: 'MenuVisibleFilter',
      description: '按菜单可见性过滤；省略时返回全部可见性。',
      examples: [true],
    }),
  }),
  {
    title: 'ListMenusInput',
    description: '菜单管理分页查询参数，支持按名称、启停状态和可见性筛选。',
    examples: [
      {
        page: 1,
        pageSize: 10,
        search: '系统',
        status: true,
        visible: true,
      },
    ],
  },
)

export const menuListItemSchema = withOpenApiSchemaDoc(
  z.object({
    component: nullableMenuComponentSchema,
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'MenuCreatedAt',
      description: '菜单创建时间，ISO 8601 字符串。',
      examples: ['2026-04-10T08:30:00.000Z'],
    }),
    icon: nullableMenuIconSchema,
    id: menuIdSchema,
    name: menuNameFieldSchema,
    parentId: menuParentIdSchema,
    path: nullableMenuPathSchema,
    permissionAction: nullableMenuPermissionActionSchema,
    permissionResource: nullableMenuPermissionResourceSchema,
    sortOrder: menuSortOrderSchema,
    status: menuStatusFieldSchema,
    type: menuTypeFieldSchema,
    visible: menuVisibleFieldSchema,
  }),
  {
    title: 'MenuEntry',
    description: '菜单条目，描述后台导航节点、其层级关系以及绑定的权限元数据。',
    examples: [
      {
        id: '6f8174e8-f5d5-4c0b-b805-75af3384d101',
        parentId: '2d5f0abc-7b89-4d85-a5b7-0f9154c4a110',
        name: '菜单管理',
        path: '/system/menus',
        component: 'system/menus/page',
        icon: 'menu',
        sortOrder: 3,
        type: 'menu',
        permissionAction: 'read',
        permissionResource: 'Menu',
        visible: true,
        status: true,
        createdAt: '2026-04-10T08:30:00.000Z',
      },
    ],
  },
)

export const menuEntrySchema = menuListItemSchema

export const getMenuByIdInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: menuIdSchema,
  }),
  {
    title: 'GetMenuByIdInput',
    description: '按菜单 UUID 读取单个菜单节点详情。',
    examples: [
      {
        id: '6f8174e8-f5d5-4c0b-b805-75af3384d101',
      },
    ],
  },
)

export const createMenuInputSchema = withOpenApiSchemaDoc(
  z.object({
    component: withOpenApiSchemaDoc(nullableMenuComponentSchema.default(null), {
      title: 'CreateMenuComponent',
      description: '新菜单关联的前端组件标识；目录节点可为空。',
      examples: ['system/menus/page', null],
      default: null,
    }),
    icon: withOpenApiSchemaDoc(nullableMenuIconSchema.default(null), {
      title: 'CreateMenuIcon',
      description: '新菜单图标标识；未填写时默认 `null`。',
      examples: ['menu', null],
      default: null,
    }),
    name: withOpenApiSchemaDoc(menuNameFieldSchema, {
      title: 'CreateMenuName',
      description: '新菜单名称。',
      examples: ['菜单管理'],
    }),
    parentId: withOpenApiSchemaDoc(menuParentIdSchema.default(null), {
      title: 'CreateMenuParentId',
      description: '父级菜单 UUID；创建顶级菜单时传 `null`。',
      examples: ['2d5f0abc-7b89-4d85-a5b7-0f9154c4a110', null],
      default: null,
    }),
    path: withOpenApiSchemaDoc(nullableMenuPathSchema.default(null), {
      title: 'CreateMenuPath',
      description: '新菜单路径；目录节点可为空，页面菜单建议填写站内绝对路径。',
      examples: ['/system/menus', null],
      default: null,
    }),
    permissionAction: withOpenApiSchemaDoc(nullableMenuPermissionActionSchema.default(null), {
      title: 'CreateMenuPermissionAction',
      description: '菜单访问所需动作；若配置权限，必须与资源主体成对出现。',
      examples: ['read', null],
      default: null,
    }),
    permissionResource: withOpenApiSchemaDoc(nullableMenuPermissionResourceSchema.default(null), {
      title: 'CreateMenuPermissionResource',
      description: '菜单访问所需资源主体；若配置权限，必须与动作成对出现。',
      examples: ['Menu', null],
      default: null,
    }),
    sortOrder: withOpenApiSchemaDoc(z.coerce.number().int().min(-9999).max(9999), {
      title: 'CreateMenuSortOrder',
      description: '新菜单排序值；数值越小越靠前。',
      examples: [30],
    }),
    status: withOpenApiSchemaDoc(menuStatusFieldSchema.default(true), {
      title: 'CreateMenuStatus',
      description: '新菜单启用状态；默认 `true`。',
      examples: [true],
      default: true,
    }),
    type: withOpenApiSchemaDoc(menuTypeFieldSchema, {
      title: 'CreateMenuType',
      description: '新菜单节点类型。',
      examples: ['menu'],
    }),
    visible: withOpenApiSchemaDoc(menuVisibleFieldSchema.default(true), {
      title: 'CreateMenuVisible',
      description: '新菜单是否在导航中可见；默认 `true`。',
      examples: [true],
      default: true,
    }),
  }),
  {
    title: 'CreateMenuInput',
    description:
      '创建自定义菜单节点；系统会校验父子关系、路径与权限绑定完整性，并拒绝与现有路径冲突的菜单。',
    examples: [
      {
        name: '菜单管理',
        parentId: '2d5f0abc-7b89-4d85-a5b7-0f9154c4a110',
        path: '/system/menus',
        component: 'system/menus/page',
        icon: 'menu',
        sortOrder: 3,
        type: 'menu',
        permissionAction: 'read',
        permissionResource: 'Menu',
        visible: true,
        status: true,
      },
    ],
  },
)

export const updateMenuInputSchema = withOpenApiSchemaDoc(
  z.object({
    component: withOpenApiSchemaDoc(nullableMenuComponentSchema.default(null), {
      title: 'UpdateMenuComponent',
      description: '更新后的前端组件标识；目录节点可为空。',
      examples: ['system/menus/page', null],
      default: null,
    }),
    icon: withOpenApiSchemaDoc(nullableMenuIconSchema.default(null), {
      title: 'UpdateMenuIcon',
      description: '更新后的图标标识；未填写时归一化为 `null`。',
      examples: ['menu', null],
      default: null,
    }),
    id: menuIdSchema,
    name: withOpenApiSchemaDoc(menuNameFieldSchema, {
      title: 'UpdateMenuName',
      description: '更新后的菜单名称。',
      examples: ['菜单管理'],
    }),
    parentId: withOpenApiSchemaDoc(menuParentIdSchema.default(null), {
      title: 'UpdateMenuParentId',
      description: '更新后的父级菜单 UUID；顶级菜单传 `null`。',
      examples: ['2d5f0abc-7b89-4d85-a5b7-0f9154c4a110', null],
      default: null,
    }),
    path: withOpenApiSchemaDoc(nullableMenuPathSchema.default(null), {
      title: 'UpdateMenuPath',
      description: '更新后的菜单路径；目录节点可为空。',
      examples: ['/system/menus', null],
      default: null,
    }),
    permissionAction: withOpenApiSchemaDoc(nullableMenuPermissionActionSchema.default(null), {
      title: 'UpdateMenuPermissionAction',
      description: '更新后的权限动作；若配置权限，必须与资源主体成对出现。',
      examples: ['read', null],
      default: null,
    }),
    permissionResource: withOpenApiSchemaDoc(nullableMenuPermissionResourceSchema.default(null), {
      title: 'UpdateMenuPermissionResource',
      description: '更新后的权限资源主体；若配置权限，必须与动作成对出现。',
      examples: ['Menu', null],
      default: null,
    }),
    sortOrder: withOpenApiSchemaDoc(z.coerce.number().int().min(-9999).max(9999), {
      title: 'UpdateMenuSortOrder',
      description: '更新后的排序值；数值越小越靠前。',
      examples: [30],
    }),
    status: menuStatusFieldSchema,
    type: menuTypeFieldSchema,
    visible: menuVisibleFieldSchema,
  }),
  {
    title: 'UpdateMenuInput',
    description:
      '更新自定义菜单节点；系统保留菜单会被拒绝修改，并校验父子关系不成环、路径不冲突、权限绑定完整。',
    examples: [
      {
        id: '6f8174e8-f5d5-4c0b-b805-75af3384d101',
        name: '菜单管理',
        parentId: '2d5f0abc-7b89-4d85-a5b7-0f9154c4a110',
        path: '/system/menus',
        component: 'system/menus/page',
        icon: 'menu',
        sortOrder: 4,
        type: 'menu',
        permissionAction: 'read',
        permissionResource: 'Menu',
        visible: true,
        status: true,
      },
    ],
  },
)

export const deleteMenuInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: menuIdSchema,
  }),
  {
    title: 'DeleteMenuInput',
    description: '删除菜单节点的请求参数，按菜单 UUID 指定目标。',
    examples: [
      {
        id: '6f8174e8-f5d5-4c0b-b805-75af3384d101',
      },
    ],
  },
)

export const deleteMenuResultSchema = withOpenApiSchemaDoc(
  z.object({
    deleted: withOpenApiSchemaDoc(z.literal(true), {
      title: 'DeleteMenuSuccessFlag',
      description: '菜单删除成功标志，固定为 `true`。',
      examples: [true],
    }),
    id: menuIdSchema,
  }),
  {
    title: 'DeleteMenuResult',
    description: '菜单删除成功后的标准响应。',
    examples: [
      {
        deleted: true,
        id: '6f8174e8-f5d5-4c0b-b805-75af3384d101',
      },
    ],
  },
)

export const menuListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(menuListItemSchema),
  {
    title: 'MenuListResponse',
    description: '菜单管理分页响应，返回菜单节点列表与标准分页信息。',
    examples: [
      {
        data: [
          {
            id: '6f8174e8-f5d5-4c0b-b805-75af3384d101',
            parentId: '2d5f0abc-7b89-4d85-a5b7-0f9154c4a110',
            name: '菜单管理',
            path: '/system/menus',
            component: 'system/menus/page',
            icon: 'menu',
            sortOrder: 3,
            type: 'menu',
            permissionAction: 'read',
            permissionResource: 'Menu',
            visible: true,
            status: true,
            createdAt: '2026-04-10T08:30:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      },
    ],
  },
)

// 系统字典 contract-first skeleton。
export const dictEntrySchema = withOpenApiSchemaDoc(
  z.object({
    label: withOpenApiSchemaDoc(z.string(), {
      title: 'DictEntryLabel',
      description: '字典项显示名称。',
      examples: ['read'],
    }),
    sortOrder: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'DictEntrySortOrder',
      description: '字典项排序值。',
      examples: [1],
    }),
    value: withOpenApiSchemaDoc(z.string(), {
      title: 'DictEntryValue',
      description: '字典项稳定值。',
      examples: ['read'],
    }),
  }),
  {
    title: 'DictEntry',
    description: '系统字典项条目。',
    examples: [{ label: 'read', sortOrder: 1, value: 'read' }],
  },
)

export const listDictsInputSchema = withOpenApiSchemaDoc(
  baseSearchSchema
    .extend({
      source: withOpenApiSchemaDoc(z.enum(['runtime', 'seed']).optional(), {
        title: 'DictSourceFilter',
        description: '按字典来源过滤；`seed` 表示种子字典，`runtime` 表示运行时字典。',
        examples: ['seed'],
      }),
      status: withOpenApiSchemaDoc(booleanQuerySchema.optional(), {
        title: 'DictStatusFilter',
        description: '按字典启用状态过滤。',
        examples: [true],
      }),
    })
    .default({
      page: 1,
      pageSize: 10,
    }),
  {
    title: 'ListDictsInput',
    description: '系统字典分页查询参数。',
    examples: [{ page: 1, pageSize: 10, source: 'seed', status: true }],
    default: { page: 1, pageSize: 10 },
  },
)

export const dictListItemSchema = withOpenApiSchemaDoc(
  z.object({
    code: withOpenApiSchemaDoc(z.string(), {
      title: 'DictCode',
      description: '字典稳定编码。',
      examples: ['ability_actions'],
    }),
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'DictCreatedAt',
      description: '字典创建时间，ISO 8601 字符串。',
      examples: ['2026-04-02T00:00:00.000Z'],
    }),
    description: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'DictDescription',
      description: '字典说明；未填写时为 `null`。',
      examples: ['系统内置 CASL 动作集合。'],
    }),
    entries: withOpenApiSchemaDoc(z.array(dictEntrySchema), {
      title: 'DictEntries',
      description: '当前字典包含的条目列表。',
      examples: [[{ label: 'read', sortOrder: 1, value: 'read' }]],
    }),
    entryCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'DictEntryCount',
      description: '字典条目数量。',
      examples: [4],
    }),
    id: withOpenApiSchemaDoc(z.string(), {
      title: 'DictId',
      description: '字典稳定标识。',
      examples: ['dict:ability-actions'],
    }),
    name: withOpenApiSchemaDoc(z.string(), {
      title: 'DictName',
      description: '字典显示名称。',
      examples: ['权限动作'],
    }),
    source: withOpenApiSchemaDoc(z.enum(['runtime', 'seed']), {
      title: 'DictSource',
      description: '字典来源。',
      examples: ['seed'],
    }),
    status: withOpenApiSchemaDoc(z.boolean(), {
      title: 'DictStatus',
      description: '字典启用状态。',
      examples: [true],
    }),
    updatedAt: withOpenApiSchemaDoc(z.string(), {
      title: 'DictUpdatedAt',
      description: '字典更新时间，ISO 8601 字符串。',
      examples: ['2026-04-02T00:00:00.000Z'],
    }),
  }),
  {
    title: 'DictListItem',
    description: '系统字典条目，包含元信息和全部字典项。',
    examples: [
      {
        code: 'ability_actions',
        createdAt: '2026-04-02T00:00:00.000Z',
        description: '系统内置 CASL 动作集合。',
        entries: [{ label: 'read', sortOrder: 1, value: 'read' }],
        entryCount: 4,
        id: 'dict:ability-actions',
        name: '权限动作',
        source: 'seed',
        status: true,
        updatedAt: '2026-04-02T00:00:00.000Z',
      },
    ],
  },
)

export const dictListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(dictListItemSchema),
  {
    title: 'DictListResponse',
    description: '系统字典分页响应。',
    examples: [
      {
        data: [
          {
            code: 'ability_actions',
            createdAt: '2026-04-02T00:00:00.000Z',
            description: '系统内置 CASL 动作集合。',
            entries: [{ label: 'read', sortOrder: 1, value: 'read' }],
            entryCount: 4,
            id: 'dict:ability-actions',
            name: '权限动作',
            source: 'seed',
            status: true,
            updatedAt: '2026-04-02T00:00:00.000Z',
          },
        ],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
    ],
  },
)

// 系统配置 contract-first skeleton。
export const configScopeSchema = withOpenApiSchemaDoc(
  z.enum(['ai', 'application', 'deploy', 'security']),
  {
    title: 'ConfigScope',
    description: '运行时配置所属域。',
    examples: ['security'],
  },
)

export const listConfigsInputSchema = withOpenApiSchemaDoc(
  baseSearchSchema
    .extend({
      scope: withOpenApiSchemaDoc(configScopeSchema.optional(), {
        title: 'ConfigScopeFilter',
        description: '按配置作用域过滤。',
        examples: ['security'],
      }),
    })
    .default({
      page: 1,
      pageSize: 10,
    }),
  {
    title: 'ListConfigsInput',
    description: '系统运行时配置分页查询参数。',
    examples: [{ page: 1, pageSize: 10, scope: 'security' }],
    default: { page: 1, pageSize: 10 },
  },
)

export const configListItemSchema = withOpenApiSchemaDoc(
  z.object({
    description: withOpenApiSchemaDoc(z.string(), {
      title: 'ConfigDescription',
      description: '配置项用途说明。',
      examples: ['API 基础限流模式与通用配额。'],
    }),
    key: withOpenApiSchemaDoc(z.string(), {
      title: 'ConfigKey',
      description: '配置项稳定键名。',
      examples: ['security.rate_limit'],
    }),
    mutable: withOpenApiSchemaDoc(z.boolean(), {
      title: 'ConfigMutable',
      description: '该配置是否允许通过管理面修改。',
      examples: [false],
    }),
    scope: configScopeSchema,
    source: withOpenApiSchemaDoc(z.enum(['env', 'runtime', 'static']), {
      title: 'ConfigSource',
      description: '配置项来源。',
      examples: ['runtime'],
    }),
    updatedAt: withOpenApiSchemaDoc(z.string(), {
      title: 'ConfigUpdatedAt',
      description: '配置摘要最近更新时间，ISO 8601 字符串。',
      examples: ['2026-04-11T06:30:00.000Z'],
    }),
    value: withOpenApiSchemaDoc(z.string(), {
      title: 'ConfigValue',
      description: '脱敏后的配置值或状态摘要。',
      examples: ['enabled:120/60000ms'],
    }),
  }),
  {
    title: 'ConfigListItem',
    description: '系统运行时配置摘要条目，仅返回可安全暴露的非敏感信息。',
    examples: [
      {
        description: 'API 基础限流模式与通用配额。',
        key: 'security.rate_limit',
        mutable: false,
        scope: 'security',
        source: 'runtime',
        updatedAt: '2026-04-11T06:30:00.000Z',
        value: 'enabled:120/60000ms',
      },
    ],
  },
)

export const configListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(configListItemSchema),
  {
    title: 'ConfigListResponse',
    description: '系统配置分页响应。',
    examples: [
      {
        data: [
          {
            description: 'API 基础限流模式与通用配额。',
            key: 'security.rate_limit',
            mutable: false,
            scope: 'security',
            source: 'runtime',
            updatedAt: '2026-04-11T06:30:00.000Z',
            value: 'enabled:120/60000ms',
          },
        ],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
    ],
  },
)

export const listOperationLogsInputSchema = withOpenApiSchemaDoc(
  baseSearchSchema.extend({
    module: withOpenApiSchemaDoc(z.string().trim().min(1).max(100).optional(), {
      title: 'OperationLogModuleFilter',
      description: '按模块名过滤操作日志。',
      examples: ['system_users'],
    }),
    status: withOpenApiSchemaDoc(z.enum(['error', 'success']).optional(), {
      title: 'OperationLogStatusFilter',
      description: '按操作结果状态过滤操作日志。',
      examples: ['success'],
    }),
  }),
  {
    title: 'ListOperationLogsInput',
    description: '操作日志分页查询参数。',
    examples: [{ page: 1, pageSize: 10, module: 'system_users', status: 'success' }],
  },
)

export const operationLogListItemSchema = withOpenApiSchemaDoc(
  z.object({
    action: withOpenApiSchemaDoc(z.string(), {
      title: 'OperationLogAction',
      description: '操作动作标识。',
      examples: ['create_user'],
    }),
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'OperationLogCreatedAt',
      description: '日志创建时间，ISO 8601 字符串。',
      examples: ['2026-04-11T06:30:00.000Z'],
    }),
    detail: withOpenApiSchemaDoc(z.string(), {
      title: 'OperationLogDetail',
      description: '操作详情描述。',
      examples: ['Created user alice_admin.'],
    }),
    errorMessage: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'OperationLogErrorMessage',
      description: '操作失败时的错误消息；成功时为 `null`。',
      examples: [null],
    }),
    id: withOpenApiSchemaDoc(z.string().uuid(), {
      title: 'OperationLogId',
      description: '操作日志主键 UUID。',
      examples: ['9c29d02d-a283-42f6-a6b3-a61bd59b1001'],
    }),
    module: withOpenApiSchemaDoc(z.string(), {
      title: 'OperationLogModule',
      description: '日志所属模块。',
      examples: ['system_users'],
    }),
    operatorId: withOpenApiSchemaDoc(z.string().uuid(), {
      title: 'OperationLogOperatorId',
      description: '触发操作的 RBAC 用户 ID。',
      examples: ['8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001'],
    }),
    requestId: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'OperationLogRequestId',
      description: '关联请求 ID；无请求上下文时为 `null`。',
      examples: ['req_01'],
    }),
    status: withOpenApiSchemaDoc(z.string(), {
      title: 'OperationLogStatus',
      description: '操作结果状态。',
      examples: ['success'],
    }),
    targetId: withOpenApiSchemaDoc(z.string().uuid().nullable(), {
      title: 'OperationLogTargetId',
      description: '操作目标资源 UUID；无目标时为 `null`。',
      examples: ['5ce76d62-d8d4-4c61-ae2d-4b63135d1001'],
    }),
  }),
  {
    title: 'OperationLogListItem',
    description: '单条操作日志条目。',
    examples: [
      {
        action: 'create_user',
        createdAt: '2026-04-11T06:30:00.000Z',
        detail: 'Created user alice_admin.',
        errorMessage: null,
        id: '9c29d02d-a283-42f6-a6b3-a61bd59b1001',
        module: 'system_users',
        operatorId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
        requestId: 'req_01',
        status: 'success',
        targetId: '5ce76d62-d8d4-4c61-ae2d-4b63135d1001',
      },
    ],
  },
)

export const operationLogListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(operationLogListItemSchema),
  {
    title: 'OperationLogListResponse',
    description: '操作日志分页响应。',
    examples: [
      {
        data: [
          {
            action: 'create_user',
            createdAt: '2026-04-11T06:30:00.000Z',
            detail: 'Created user alice_admin.',
            errorMessage: null,
            id: '9c29d02d-a283-42f6-a6b3-a61bd59b1001',
            module: 'system_users',
            operatorId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
            requestId: 'req_01',
            status: 'success',
            targetId: '5ce76d62-d8d4-4c61-ae2d-4b63135d1001',
          },
        ],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
    ],
  },
)

export const listOnlineUsersInputSchema = withOpenApiSchemaDoc(baseSearchSchema, {
  title: 'ListOnlineUsersInput',
  description: '在线会话分页查询参数，支持按邮箱或用户名关键词检索。',
  examples: [{ page: 1, pageSize: 10, search: 'admin' }],
})

export const onlineUserListItemSchema = withOpenApiSchemaDoc(
  z.object({
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'OnlineSessionCreatedAt',
      description: '会话创建时间，ISO 8601 字符串。',
      examples: ['2026-04-11T06:30:00.000Z'],
    }),
    email: withOpenApiSchemaDoc(z.string().email(), {
      title: 'OnlineSessionEmail',
      description: '登录主体邮箱。',
      examples: ['admin@ai-native-os.local'],
    }),
    expiresAt: withOpenApiSchemaDoc(z.string(), {
      title: 'OnlineSessionExpiresAt',
      description: '会话过期时间，ISO 8601 字符串。',
      examples: ['2026-04-11T08:30:00.000Z'],
    }),
    ipAddress: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'OnlineSessionIpAddress',
      description: '会话 IP 地址；未记录时为 `null`。',
      examples: ['127.0.0.1'],
    }),
    name: withOpenApiSchemaDoc(z.string(), {
      title: 'OnlineSessionUserName',
      description: 'Better Auth 用户显示名。',
      examples: ['super_admin'],
    }),
    rbacUserId: withOpenApiSchemaDoc(z.string().uuid().nullable(), {
      title: 'OnlineSessionRbacUserId',
      description: '映射到应用 RBAC 用户的 UUID；未映射时为 `null`。',
      examples: ['8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001'],
    }),
    roleCodes: withOpenApiSchemaDoc(z.array(z.string()), {
      title: 'OnlineSessionRoleCodes',
      description: '当前会话映射到的角色编码列表。',
      examples: [['super_admin']],
    }),
    sessionId: withOpenApiSchemaDoc(z.string(), {
      title: 'OnlineSessionId',
      description: 'Better Auth 会话 ID。',
      examples: ['sess_01'],
    }),
    userAgent: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'OnlineSessionUserAgent',
      description: '会话 User-Agent；未记录时为 `null`。',
      examples: ['Mozilla/5.0'],
    }),
    userId: withOpenApiSchemaDoc(z.string(), {
      title: 'OnlineSessionAuthUserId',
      description: 'Better Auth 用户 ID。',
      examples: ['auth_user_01'],
    }),
  }),
  {
    title: 'OnlineUserListItem',
    description: '在线会话条目，聚合了 Better Auth 会话与 RBAC 角色信息。',
    examples: [
      {
        createdAt: '2026-04-11T06:30:00.000Z',
        email: 'admin@ai-native-os.local',
        expiresAt: '2026-04-11T08:30:00.000Z',
        ipAddress: '127.0.0.1',
        name: 'super_admin',
        rbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
        roleCodes: ['super_admin'],
        sessionId: 'sess_01',
        userAgent: 'Mozilla/5.0',
        userId: 'auth_user_01',
      },
    ],
  },
)

export const onlineUserListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(onlineUserListItemSchema),
  {
    title: 'OnlineUserListResponse',
    description: '在线会话分页响应。',
    examples: [
      {
        data: [
          {
            createdAt: '2026-04-11T06:30:00.000Z',
            email: 'admin@ai-native-os.local',
            expiresAt: '2026-04-11T08:30:00.000Z',
            ipAddress: '127.0.0.1',
            name: 'super_admin',
            rbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
            roleCodes: ['super_admin'],
            sessionId: 'sess_01',
            userAgent: 'Mozilla/5.0',
            userId: 'auth_user_01',
          },
        ],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
    ],
  },
)

export const serverSummarySchema = withOpenApiSchemaDoc(
  z.object({
    environment: withOpenApiSchemaDoc(
      z.object({
        nodeEnv: withOpenApiSchemaDoc(z.string(), {
          title: 'ServerSummaryNodeEnv',
          description: '当前 API 进程运行环境。',
          examples: ['development'],
        }),
        port: withOpenApiSchemaDoc(z.number().int(), {
          title: 'ServerSummaryPort',
          description: '当前 API 进程监听端口。',
          examples: [3001],
        }),
      }),
      {
        title: 'ServerSummaryEnvironment',
        description: '服务端环境摘要。',
      },
    ),
    health: withOpenApiSchemaDoc(
      z.object({
        api: withOpenApiSchemaDoc(z.literal('ok'), {
          title: 'ServerSummaryApiHealth',
          description: 'API 进程健康状态常量。',
          examples: ['ok'],
        }),
        ai: aiRuntimeCapabilitySchema,
        database: dependencyHealthStatusSchema,
        redis: dependencyHealthStatusSchema,
        status: withOpenApiSchemaDoc(z.enum(['degraded', 'ok']), {
          title: 'ServerSummaryHealthStatus',
          description: '整体健康状态。',
          examples: ['ok'],
        }),
        telemetry: telemetryHealthSchema,
      }),
      {
        title: 'ServerSummaryHealth',
        description: '服务端健康检查摘要。',
      },
    ),
    runtime: withOpenApiSchemaDoc(
      z.object({
        agentCount: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'ServerSummaryAgentCount',
          description: '当前已注册 Agent 数量。',
          examples: [2],
        }),
        enabledAgentCount: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'ServerSummaryEnabledAgentCount',
          description: '当前主体可用 Agent 数量。',
          examples: [1],
        }),
        runtimeStage: withOpenApiSchemaDoc(
          z.enum(['agents_ready', 'tools_only', 'workflows_ready']),
          {
            title: 'ServerSummaryRuntimeStage',
            description: 'Mastra 当前运行阶段。',
            examples: ['workflows_ready'],
          },
        ),
        toolCount: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'ServerSummaryToolCount',
          description: '当前已注册 Tool 数量。',
          examples: [3],
        }),
        workflowCount: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'ServerSummaryWorkflowCount',
          description: '当前已注册 Workflow 数量。',
          examples: [1],
        }),
      }),
      {
        title: 'ServerSummaryRuntime',
        description: 'Mastra 运行时摘要。',
      },
    ),
  }),
  {
    title: 'ServerSummary',
    description: '监控页使用的服务端运行时总览。',
    examples: [
      {
        environment: {
          nodeEnv: 'development',
          port: 3001,
        },
        health: {
          api: 'ok',
          ai: {
            copilot: 'degraded',
            defaultModel: 'gpt-4.1-mini',
            embeddingProvider: 'deterministic-local',
            openaiApiKeyConfigured: false,
            reason: 'OPENAI_API_KEY is not configured.',
            remoteEmbeddings: 'degraded',
            status: 'degraded',
            unavailableSurfaces: ['copilot', 'agents'],
          },
          database: 'ok',
          redis: 'ok',
          status: 'ok',
          telemetry: {
            openTelemetry: 'unknown',
            sentry: 'unknown',
          },
        },
        runtime: {
          agentCount: 2,
          enabledAgentCount: 1,
          runtimeStage: 'workflows_ready',
          toolCount: 3,
          workflowCount: 1,
        },
      },
    ],
  },
)

export const listKnowledgeInputSchema = withOpenApiSchemaDoc(
  baseSearchSchema.extend({
    sourceType: withOpenApiSchemaDoc(z.string().trim().min(1).max(50).optional(), {
      title: 'KnowledgeSourceTypeFilter',
      description: '按知识来源类型过滤，例如 `manual`、`document`、`web`。',
      examples: ['manual'],
    }),
  }),
  {
    title: 'ListKnowledgeInput',
    description: '知识库文档分页查询参数，支持按标题/内容关键词和来源类型筛选。',
    examples: [
      {
        page: 1,
        pageSize: 10,
        search: '财务',
        sourceType: 'manual',
      },
    ],
  },
)

const knowledgeDocumentIdSchema = withOpenApiSchemaDoc(z.string().uuid(), {
  title: 'KnowledgeDocumentId',
  description: '知识文档主键 UUID，用于定位单个知识文档资源。',
  examples: ['f1cf1bb3-6b79-4e52-bef1-3ab0d9e25001'],
})

const knowledgeTitleFieldSchema = withOpenApiSchemaDoc(z.string().trim().min(1).max(255), {
  title: 'KnowledgeTitleField',
  description: '知识文档标题，用于后台管理检索与检索结果展示。',
  examples: ['财务审批制度 2026 版'],
})

const knowledgeSourceTypeFieldSchema = withOpenApiSchemaDoc(z.string().trim().min(1).max(50), {
  title: 'KnowledgeSourceTypeField',
  description: '知识来源类型，例如 `manual`、`document`、`policy`、`web`。',
  examples: ['manual'],
})

const knowledgeSourceUriFieldSchema = withOpenApiSchemaDoc(
  z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value
    }

    const trimmedValue = value.trim()

    return trimmedValue.length === 0 ? null : trimmedValue
  }, z.string().trim().max(500).nullable()),
  {
    title: 'KnowledgeSourceUriField',
    description: '知识原始来源地址；没有外部来源地址时为 `null`。',
    examples: ['https://internal.example.com/wiki/finance'],
  },
)

const knowledgeContentFieldSchema = withOpenApiSchemaDoc(z.string().trim().min(1).max(100_000), {
  title: 'KnowledgeContent',
  description:
    '知识文档完整正文。创建和更新都会基于该全文重新切分 chunk 并生成 embedding，不支持只提交增量片段。',
  examples: ['第一条：财务审批需由部门负责人初审，金额超过十万元时进入复核流程。'],
})

const knowledgeChunkSizeFieldSchema = withOpenApiSchemaDoc(
  z.number().int().min(128).max(2048).default(512),
  {
    title: 'KnowledgeChunkSize',
    description: '切分知识文档时每个 chunk 的目标字符窗口大小。',
    examples: [512],
    default: 512,
  },
)

const knowledgeChunkOverlapFieldSchema = withOpenApiSchemaDoc(
  z.number().int().min(0).max(512).default(64),
  {
    title: 'KnowledgeChunkOverlap',
    description: '相邻 chunk 之间保留的重叠字符数，用于减少语义断裂。',
    examples: [64],
    default: 64,
  },
)

const optionalKnowledgeDocumentIdSchema = withOpenApiSchemaDoc(z.string().uuid().optional(), {
  title: 'OptionalKnowledgeDocumentId',
  description: '可选知识文档主键；创建时省略表示由系统生成稳定 UUID。',
  examples: ['f1cf1bb3-6b79-4e52-bef1-3ab0d9e25001'],
})

export const getKnowledgeByIdInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: knowledgeDocumentIdSchema,
  }),
  {
    title: 'GetKnowledgeByIdInput',
    description: '读取单个知识文档详情所需的路径参数。',
    examples: [
      {
        id: 'f1cf1bb3-6b79-4e52-bef1-3ab0d9e25001',
      },
    ],
  },
)

export const createKnowledgeInputSchema = withOpenApiSchemaDoc(
  z.object({
    chunkOverlap: knowledgeChunkOverlapFieldSchema,
    chunkSize: knowledgeChunkSizeFieldSchema,
    content: knowledgeContentFieldSchema,
    documentId: optionalKnowledgeDocumentIdSchema,
    metadata: aiKnowledgeMetadataSchema.default({}),
    sourceType: knowledgeSourceTypeFieldSchema,
    sourceUri: knowledgeSourceUriFieldSchema.default(null),
    title: knowledgeTitleFieldSchema,
  }),
  {
    title: 'CreateKnowledgeInput',
    description:
      '创建知识文档的请求体。服务端会对全文执行 chunking、embedding，并将整文档写入向量索引。',
    examples: [
      {
        chunkOverlap: 64,
        chunkSize: 512,
        content: '第一条：财务审批需由部门负责人初审，金额超过十万元时进入复核流程。',
        metadata: {
          category: 'finance',
          year: 2026,
        },
        sourceType: 'manual',
        sourceUri: null,
        title: '财务审批制度 2026 版',
      },
    ],
  },
)

export const updateKnowledgeInputSchema = withOpenApiSchemaDoc(
  z.object({
    chunkOverlap: knowledgeChunkOverlapFieldSchema,
    chunkSize: knowledgeChunkSizeFieldSchema,
    content: knowledgeContentFieldSchema,
    id: knowledgeDocumentIdSchema,
    metadata: aiKnowledgeMetadataSchema.default({}),
    sourceType: knowledgeSourceTypeFieldSchema,
    sourceUri: knowledgeSourceUriFieldSchema.default(null),
    title: knowledgeTitleFieldSchema,
  }),
  {
    title: 'UpdateKnowledgeInput',
    description:
      '更新知识文档的请求体。更新语义为“提交完整新正文并重建整文档索引”，不会对旧 chunk 做局部 patch。',
    examples: [
      {
        chunkOverlap: 64,
        chunkSize: 512,
        content:
          '第一条：财务审批需由部门负责人初审，金额超过十万元时进入复核流程。第二条：报销单需附原始票据。',
        id: 'f1cf1bb3-6b79-4e52-bef1-3ab0d9e25001',
        metadata: {
          category: 'finance',
          version: '2026.2',
        },
        sourceType: 'manual',
        sourceUri: null,
        title: '财务审批制度 2026 版（修订）',
      },
    ],
  },
)

export const deleteKnowledgeInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: knowledgeDocumentIdSchema,
  }),
  {
    title: 'DeleteKnowledgeInput',
    description: '删除知识文档所需的路径参数。',
    examples: [
      {
        id: 'f1cf1bb3-6b79-4e52-bef1-3ab0d9e25001',
      },
    ],
  },
)

export const knowledgeChunkSummarySchema = withOpenApiSchemaDoc(
  z.object({
    chunkIndex: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'KnowledgeChunkIndex',
      description: 'chunk 在当前文档中的顺序索引。',
      examples: [0],
    }),
    contentPreview: withOpenApiSchemaDoc(z.string().min(1), {
      title: 'KnowledgeChunkPreview',
      description: 'chunk 内容预览，用于详情页快速查看已索引内容切片。',
      examples: ['第一条：财务审批需由部门负责人初审，金额超过十万元时进入复核流程。'],
    }),
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'KnowledgeChunkCreatedAt',
      description: 'chunk 入库时间，ISO 8601 字符串。',
      examples: ['2026-04-11T06:00:00.000Z'],
    }),
    tokenCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'KnowledgeChunkTokenCount',
      description: '当前 chunk 的估算 token 数量。',
      examples: [38],
    }),
  }),
  {
    title: 'KnowledgeChunkSummary',
    description: '知识文档详情中返回的 chunk 摘要条目。',
    examples: [
      {
        chunkIndex: 0,
        contentPreview: '第一条：财务审批需由部门负责人初审，金额超过十万元时进入复核流程。',
        createdAt: '2026-04-11T06:00:00.000Z',
        tokenCount: 38,
      },
    ],
  },
)

export const knowledgeListItemSchema = withOpenApiSchemaDoc(
  z.object({
    chunkCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'KnowledgeChunkCount',
      description: '当前文档已切分并索引的 chunk 数量。',
      examples: [4],
    }),
    documentId: withOpenApiSchemaDoc(z.string().uuid(), {
      title: 'KnowledgeDocumentId',
      description: '知识文档主键 UUID。',
      examples: ['f1cf1bb3-6b79-4e52-bef1-3ab0d9e25001'],
    }),
    lastIndexedAt: withOpenApiSchemaDoc(z.string(), {
      title: 'KnowledgeLastIndexedAt',
      description: '最近一次索引时间，ISO 8601 字符串。',
      examples: ['2026-04-11T06:00:00.000Z'],
    }),
    metadata: aiKnowledgeMetadataSchema,
    sourceType: withOpenApiSchemaDoc(z.string(), {
      title: 'KnowledgeSourceType',
      description: '知识来源类型，例如人工录入、导入文档或外部抓取。',
      examples: ['manual'],
    }),
    sourceUri: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'KnowledgeSourceUri',
      description: '知识原始来源地址；没有外部地址时为 `null`。',
      examples: ['https://internal.example.com/wiki/finance'],
    }),
    title: withOpenApiSchemaDoc(z.string(), {
      title: 'KnowledgeTitle',
      description: '知识文档标题。',
      examples: ['财务审批制度 2026 版'],
    }),
  }),
  {
    title: 'KnowledgeListItem',
    description: '知识库文档级摘要条目，由 chunk 存储聚合而成。',
    examples: [
      {
        chunkCount: 4,
        documentId: 'f1cf1bb3-6b79-4e52-bef1-3ab0d9e25001',
        lastIndexedAt: '2026-04-11T06:00:00.000Z',
        metadata: {
          category: 'finance',
          year: 2026,
        },
        sourceType: 'manual',
        sourceUri: null,
        title: '财务审批制度 2026 版',
      },
    ],
  },
)

export const knowledgeEntrySchema = withOpenApiSchemaDoc(
  z.object({
    chunkCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'KnowledgeEntryChunkCount',
      description: '当前知识文档已索引的 chunk 总数。',
      examples: [4],
    }),
    chunks: withOpenApiSchemaDoc(z.array(knowledgeChunkSummarySchema), {
      title: 'KnowledgeEntryChunks',
      description: '知识文档当前已索引的 chunk 摘要列表。',
    }),
    documentId: knowledgeDocumentIdSchema,
    lastIndexedAt: withOpenApiSchemaDoc(z.string(), {
      title: 'KnowledgeEntryLastIndexedAt',
      description: '最近一次成功索引时间，ISO 8601 字符串。',
      examples: ['2026-04-11T06:00:00.000Z'],
    }),
    metadata: aiKnowledgeMetadataSchema,
    sourceType: knowledgeSourceTypeFieldSchema,
    sourceUri: knowledgeSourceUriFieldSchema,
    title: knowledgeTitleFieldSchema,
  }),
  {
    title: 'KnowledgeEntry',
    description:
      '单个知识文档详情，包含文档级摘要和 chunk 预览。注意：该详情不会回放完整原文，只返回索引后的稳定摘要。',
    examples: [
      {
        chunkCount: 4,
        chunks: [
          {
            chunkIndex: 0,
            contentPreview: '第一条：财务审批需由部门负责人初审，金额超过十万元时进入复核流程。',
            createdAt: '2026-04-11T06:00:00.000Z',
            tokenCount: 38,
          },
        ],
        documentId: 'f1cf1bb3-6b79-4e52-bef1-3ab0d9e25001',
        lastIndexedAt: '2026-04-11T06:00:00.000Z',
        metadata: {
          category: 'finance',
          year: 2026,
        },
        sourceType: 'manual',
        sourceUri: null,
        title: '财务审批制度 2026 版',
      },
    ],
  },
)

export const knowledgeListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(knowledgeListItemSchema),
  {
    title: 'KnowledgeListResponse',
    description: '知识库分页响应，返回文档级摘要列表与标准分页信息。',
    examples: [
      {
        data: [
          {
            chunkCount: 4,
            documentId: 'f1cf1bb3-6b79-4e52-bef1-3ab0d9e25001',
            lastIndexedAt: '2026-04-11T06:00:00.000Z',
            metadata: {
              category: 'finance',
              year: 2026,
            },
            sourceType: 'manual',
            sourceUri: null,
            title: '财务审批制度 2026 版',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      },
    ],
  },
)

export const deleteKnowledgeResultSchema = withOpenApiSchemaDoc(
  z.object({
    deleted: withOpenApiSchemaDoc(z.boolean(), {
      title: 'KnowledgeDeletedFlag',
      description: '是否成功删除该知识文档。',
      examples: [true],
    }),
    id: knowledgeDocumentIdSchema,
    removedChunkCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'KnowledgeRemovedChunkCount',
      description: '本次删除操作清理掉的 chunk 数量。',
      examples: [4],
    }),
  }),
  {
    title: 'DeleteKnowledgeResult',
    description: '知识文档删除结果。',
    examples: [
      {
        deleted: true,
        id: 'f1cf1bb3-6b79-4e52-bef1-3ab0d9e25001',
        removedChunkCount: 4,
      },
    ],
  },
)

export const listAiAuditLogsInputSchema = withOpenApiSchemaDoc(
  queryPaginationSchema.extend({
    status: withOpenApiSchemaDoc(z.enum(['error', 'forbidden', 'success']).optional(), {
      title: 'AiAuditStatusFilter',
      description: '按 AI 调用执行状态过滤审计日志。',
      examples: ['success'],
    }),
    toolId: withOpenApiSchemaDoc(z.string().trim().min(1).max(100).optional(), {
      title: 'AiAuditToolIdFilter',
      description: '按 Tool 标识过滤 AI 审计日志。',
      examples: ['tool_user_directory'],
    }),
  }),
  {
    title: 'ListAiAuditLogsInput',
    description: 'AI 审计日志分页查询参数，支持按 Tool 和执行状态筛选。',
    examples: [
      {
        page: 1,
        pageSize: 10,
        status: 'success',
        toolId: 'tool_user_directory',
      },
    ],
  },
)

const aiAuditLogIdSchema = withOpenApiSchemaDoc(z.string().uuid(), {
  title: 'AiAuditLogIdParam',
  description: 'AI 审计日志主键 UUID，用于读取单条审计明细。',
  examples: ['f2c4f471-0f3a-4b6d-9d7a-31968e812001'],
})

const aiFeedbackIdSchema = withOpenApiSchemaDoc(z.string().uuid(), {
  title: 'AiFeedbackIdParam',
  description: 'AI 反馈记录主键 UUID，用于读取单条反馈明细。',
  examples: ['e476f380-9504-42fb-9f5b-d5ed214df001'],
})

export const getAiAuditLogByIdInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: aiAuditLogIdSchema,
  }),
  {
    title: 'GetAiAuditLogByIdInput',
    description: '读取单条 AI 审计日志详情所需的路径参数。',
    examples: [
      {
        id: 'f2c4f471-0f3a-4b6d-9d7a-31968e812001',
      },
    ],
  },
)

export const aiAuditRequestInfoSchema = withOpenApiSchemaDoc(
  z.record(z.string(), z.string()).nullable(),
  {
    title: 'AiAuditRequestInfo',
    description: 'AI 调用关联的请求上下文字段，用于排障和链路追踪；没有上下文时为 `null`。',
    examples: [
      {
        requestId: 'req_01',
        sourceType: 'manual',
      },
      null,
    ],
  },
)

export const aiAuditDetailSchema = withOpenApiSchemaDoc(
  aiAuditLogEntrySchema.extend({
    feedback: withOpenApiSchemaDoc(z.array(aiFeedbackEntrySchema), {
      title: 'AiAuditFeedbackEntries',
      description: '关联到当前 AI 审计日志的全部反馈记录，按时间倒序返回。',
    }),
    requestInfo: aiAuditRequestInfoSchema,
  }),
  {
    title: 'AiAuditDetail',
    description: '单条 AI 审计日志详情，补充反馈列表与请求上下文，供治理页回放完整处置链路。',
    examples: [
      {
        action: 'read',
        actorAuthUserId: 'auth_user_01',
        actorRbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
        createdAt: '2026-04-11T03:00:00.000Z',
        errorMessage: null,
        feedback: [
          {
            accepted: false,
            actorAuthUserId: 'auth_user_01',
            actorRbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
            auditLogId: 'f2c4f471-0f3a-4b6d-9d7a-31968e812001',
            correction: '请改为仅导出财务部用户，并隐藏手机号字段。',
            createdAt: '2026-04-11T03:15:00.000Z',
            feedbackText: '原始导出范围过大。',
            id: 'e476f380-9504-42fb-9f5b-d5ed214df001',
            userAction: 'overridden',
          },
        ],
        feedbackCount: 1,
        humanOverride: true,
        id: 'f2c4f471-0f3a-4b6d-9d7a-31968e812001',
        latestFeedbackAt: '2026-04-11T03:15:00.000Z',
        latestUserAction: 'overridden',
        requestId: 'req_01',
        requestInfo: {
          requestId: 'req_01',
          sourceType: 'manual',
        },
        roleCodes: ['super_admin'],
        status: 'success',
        subject: 'User',
        toolId: 'tool_user_directory',
      },
    ],
  },
)

export const aiAuditListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(aiAuditLogEntrySchema),
  {
    title: 'AiAuditListResponse',
    description: 'AI 审计日志分页响应，返回 Tool 调用轨迹与反馈汇总。',
    examples: [
      {
        data: [
          {
            action: 'read',
            actorAuthUserId: 'auth_user_01',
            actorRbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
            createdAt: '2026-04-11T03:00:00.000Z',
            errorMessage: null,
            feedbackCount: 2,
            humanOverride: false,
            id: 'f2c4f471-0f3a-4b6d-9d7a-31968e812001',
            latestFeedbackAt: '2026-04-11T03:15:00.000Z',
            latestUserAction: 'accepted',
            requestId: 'req_01',
            roleCodes: ['super_admin'],
            status: 'success',
            subject: 'User',
            toolId: 'tool_user_directory',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      },
    ],
  },
)

export const listAiFeedbackInputSchema = withOpenApiSchemaDoc(
  queryPaginationSchema.extend({
    accepted: withOpenApiSchemaDoc(booleanQuerySchema.optional(), {
      title: 'AiFeedbackAcceptedFilter',
      description: '按最终是否采纳 AI 结果过滤反馈列表。',
      examples: [false],
    }),
    auditLogId: withOpenApiSchemaDoc(z.string().uuid().optional(), {
      title: 'AiFeedbackAuditLogFilter',
      description: '按 AI 审计日志 UUID 过滤反馈。',
      examples: ['f2c4f471-0f3a-4b6d-9d7a-31968e812001'],
    }),
    search: withOpenApiSchemaDoc(z.string().trim().min(1).max(100).optional(), {
      title: 'AiFeedbackSearch',
      description: '按反馈文本或修正文案关键词检索。',
      examples: ['财务'],
    }),
    userAction: withOpenApiSchemaDoc(aiFeedbackUserActionSchema.optional(), {
      title: 'AiFeedbackUserActionFilter',
      description: '按用户最终动作过滤反馈列表。',
      examples: ['overridden'],
    }),
  }),
  {
    title: 'ListAiFeedbackInput',
    description: 'AI 反馈分页查询参数，支持按采纳状态、动作类型、审计日志和关键词筛选。',
    examples: [
      {
        page: 1,
        pageSize: 10,
        accepted: false,
        userAction: 'overridden',
      },
    ],
  },
)

export const getAiFeedbackByIdInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: aiFeedbackIdSchema,
  }),
  {
    title: 'GetAiFeedbackByIdInput',
    description: '读取单条 AI 反馈详情所需的路径参数。',
    examples: [
      {
        id: 'e476f380-9504-42fb-9f5b-d5ed214df001',
      },
    ],
  },
)

export const aiFeedbackAuditSummarySchema = withOpenApiSchemaDoc(
  z.object({
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'AiFeedbackAuditCreatedAt',
      description: '关联 AI 审计日志的创建时间，ISO 8601 字符串。',
      examples: ['2026-04-11T03:00:00.000Z'],
    }),
    id: aiAuditLogIdSchema,
    requestId: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiFeedbackAuditRequestId',
      description: '关联 AI 审计日志对应的请求 ID；没有时为 `null`。',
      examples: ['req_01'],
    }),
    status: withOpenApiSchemaDoc(z.enum(['error', 'forbidden', 'success']), {
      title: 'AiFeedbackAuditStatus',
      description: '关联 AI 审计日志的执行状态。',
      examples: ['success'],
    }),
    subject: withOpenApiSchemaDoc(z.enum(appSubjects), {
      title: 'AiFeedbackAuditSubject',
      description: '关联 AI 审计日志作用到的业务主体。',
      examples: ['User'],
    }),
    toolId: withOpenApiSchemaDoc(z.string(), {
      title: 'AiFeedbackAuditToolId',
      description: '关联 AI 审计日志对应的 Tool 标识。',
      examples: ['tool_user_directory'],
    }),
  }),
  {
    title: 'AiFeedbackAuditSummary',
    description: '反馈详情附带的 AI 审计日志摘要，用于说明该反馈作用于哪一次 AI 调用。',
    examples: [
      {
        createdAt: '2026-04-11T03:00:00.000Z',
        id: 'f2c4f471-0f3a-4b6d-9d7a-31968e812001',
        requestId: 'req_01',
        status: 'success',
        subject: 'User',
        toolId: 'tool_user_directory',
      },
    ],
  },
)

export const aiFeedbackDetailSchema = withOpenApiSchemaDoc(
  aiFeedbackEntrySchema.extend({
    auditLog: aiFeedbackAuditSummarySchema,
  }),
  {
    title: 'AiFeedbackDetail',
    description: '单条 AI 反馈详情，补充其所关联 AI 审计日志的最小上下文摘要。',
    examples: [
      {
        accepted: false,
        actorAuthUserId: 'auth_user_01',
        actorRbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
        auditLog: {
          createdAt: '2026-04-11T03:00:00.000Z',
          id: 'f2c4f471-0f3a-4b6d-9d7a-31968e812001',
          requestId: 'req_01',
          status: 'success',
          subject: 'User',
          toolId: 'tool_user_directory',
        },
        auditLogId: 'f2c4f471-0f3a-4b6d-9d7a-31968e812001',
        correction: '请改为仅导出财务部用户，并隐藏手机号字段。',
        createdAt: '2026-04-11T03:15:00.000Z',
        feedbackText: '原始导出范围过大。',
        id: 'e476f380-9504-42fb-9f5b-d5ed214df001',
        userAction: 'overridden',
      },
    ],
  },
)

export const aiFeedbackListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(aiFeedbackEntrySchema).extend({
    summary: aiFeedbackSummarySchema,
  }),
  {
    title: 'AiFeedbackListResponse',
    description: 'AI 反馈分页响应，返回反馈条目、分页信息和动作汇总。',
    examples: [
      {
        data: [
          {
            accepted: false,
            actorAuthUserId: 'auth_user_01',
            actorRbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
            auditLogId: 'f2c4f471-0f3a-4b6d-9d7a-31968e812001',
            correction: '请改为仅导出财务部用户，并隐藏手机号字段。',
            createdAt: '2026-04-11T02:30:00.000Z',
            feedbackText: '原始导出范围过大。',
            id: 'e476f380-9504-42fb-9f5b-d5ed214df001',
            userAction: 'overridden',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
        summary: {
          accepted: 4,
          edited: 2,
          humanOverrideCount: 1,
          overridden: 1,
          rejected: 3,
        },
      },
    ],
  },
)

export const listAiEvalsInputSchema = withOpenApiSchemaDoc(queryPaginationSchema, {
  title: 'ListAiEvalsInput',
  description: 'AI 评测目录分页查询参数。',
  examples: [
    {
      page: 1,
      pageSize: 10,
    },
  ],
})

export const aiEvalListItemSchema = withOpenApiSchemaDoc(
  z.object({
    backing: withOpenApiSchemaDoc(z.literal('mastra'), {
      title: 'AiEvalBacking',
      description: '当前评测目录的底层执行引擎。',
      examples: ['mastra'],
    }),
    datasetSize: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiEvalDatasetSize',
      description: '当前评测绑定的数据集样本数。',
      examples: [12],
    }),
    id: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalId',
      description: '评测目录标识符。',
      examples: ['admin-copilot-regression'],
    }),
    lastRunAverageScore: withOpenApiSchemaDoc(z.number().min(0).max(1).nullable(), {
      title: 'AiEvalLastRunAverageScore',
      description: '最近一次运行的平均分；未运行时为 `null`。',
      examples: [0.91],
    }),
    lastRunAt: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiEvalLastRunAt',
      description: '最近一次评测运行时间；未运行时为 `null`。',
      examples: ['2026-04-11T04:30:00.000Z'],
    }),
    lastRunStatus: withOpenApiSchemaDoc(aiEvalRunStatusSchema.nullable(), {
      title: 'AiEvalLastRunStatus',
      description: '最近一次评测运行状态；未运行时为 `null`。',
      examples: ['completed'],
    }),
    name: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalName',
      description: '评测目录显示名称。',
      examples: ['Admin Copilot Regression'],
    }),
    notes: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalNotes',
      description: '评测目录说明文本。',
      examples: ['覆盖后台问答和报表工作流回归样本。'],
    }),
    scorerCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiEvalScorerCount',
      description: '当前评测注册的评分器数量。',
      examples: [3],
    }),
    status: withOpenApiSchemaDoc(z.enum(['not_configured', 'registered']), {
      title: 'AiEvalCatalogStatus',
      description: '评测目录状态，表示已注册或未完成配置。',
      examples: ['registered'],
    }),
  }),
  {
    title: 'AiEvalListItem',
    description: 'AI 评测目录条目，包含最近运行结果与目录元信息。',
    examples: [
      {
        backing: 'mastra',
        datasetSize: 12,
        id: 'admin-copilot-regression',
        lastRunAverageScore: 0.91,
        lastRunAt: '2026-04-11T04:30:00.000Z',
        lastRunStatus: 'completed',
        name: 'Admin Copilot Regression',
        notes: '覆盖后台问答和报表工作流回归样本。',
        scorerCount: 3,
        status: 'registered',
      },
    ],
  },
)

export const aiEvalListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(aiEvalListItemSchema).extend({
    summary: withOpenApiSchemaDoc(
      z.object({
        configured: withOpenApiSchemaDoc(z.boolean(), {
          title: 'AiEvalConfigured',
          description: '当前运行时是否已正确配置评测执行环境。',
          examples: [true],
        }),
        reason: withOpenApiSchemaDoc(z.string(), {
          title: 'AiEvalSummaryReason',
          description: '评测目录汇总说明，例如降级原因或配置状态说明。',
          examples: ['Mastra eval runner is configured.'],
        }),
        totalDatasets: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'AiEvalTotalDatasets',
          description: '当前注册评测目录对应的数据集总数。',
          examples: [4],
        }),
        totalExperiments: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'AiEvalTotalExperiments',
          description: '当前已持久化的评测实验总数。',
          examples: [7],
        }),
      }),
      {
        title: 'AiEvalListSummary',
        description: 'AI 评测目录附带的整体汇总信息。',
        examples: [
          {
            configured: true,
            reason: 'Mastra eval runner is configured.',
            totalDatasets: 4,
            totalExperiments: 7,
          },
        ],
      },
    ),
  }),
  {
    title: 'AiEvalListResponse',
    description: 'AI 评测目录分页响应，返回评测条目、分页信息和环境汇总。',
    examples: [
      {
        data: [
          {
            backing: 'mastra',
            datasetSize: 12,
            id: 'admin-copilot-regression',
            lastRunAverageScore: 0.91,
            lastRunAt: '2026-04-11T04:30:00.000Z',
            lastRunStatus: 'completed',
            name: 'Admin Copilot Regression',
            notes: '覆盖后台问答和报表工作流回归样本。',
            scorerCount: 3,
            status: 'registered',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
        summary: {
          configured: true,
          reason: 'Mastra eval runner is configured.',
          totalDatasets: 4,
          totalExperiments: 7,
        },
      },
    ],
  },
)

const aiEvalIdSchema = withOpenApiSchemaDoc(z.string().trim().min(1).max(120), {
  title: 'AiEvalIdParam',
  description: 'AI 评测套件标识符，用于读取单个评测详情或触发一次评测运行。',
  examples: ['report-schedule'],
})

export const getAiEvalByIdInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: aiEvalIdSchema,
  }),
  {
    title: 'GetAiEvalByIdInput',
    description: '读取单个 AI 评测详情所需的路径参数。',
    examples: [
      {
        id: 'report-schedule',
      },
    ],
  },
)

export const runAiEvalInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: aiEvalIdSchema,
  }),
  {
    title: 'RunAiEvalInput',
    description: '触发一次 AI 评测运行所需的路径参数。',
    examples: [
      {
        id: 'report-schedule',
      },
    ],
  },
)

export const aiEvalRunEntrySchema = withOpenApiSchemaDoc(
  z.object({
    actorAuthUserId: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalRunActorAuthUserId',
      description: '触发本次评测运行的 Better Auth 主体 ID。',
      examples: ['auth_user_01'],
    }),
    actorRbacUserId: withOpenApiSchemaDoc(z.string().uuid().nullable(), {
      title: 'AiEvalRunActorRbacUserId',
      description: '触发本次评测运行的应用 RBAC 用户 ID；未映射时为 `null`。',
      examples: ['8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001'],
    }),
    completedAt: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiEvalRunCompletedAt',
      description: '本次评测运行完成时间；未完成时为 `null`。',
      examples: ['2026-04-11T04:30:00.000Z'],
    }),
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalRunCreatedAt',
      description: '本次评测运行记录创建时间，ISO 8601 字符串。',
      examples: ['2026-04-11T04:00:00.000Z'],
    }),
    datasetId: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalRunDatasetId',
      description: '本次评测运行实际使用的数据集 ID。',
      examples: ['dataset_report_schedule'],
    }),
    datasetName: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalRunDatasetName',
      description: '本次评测运行实际使用的数据集名称。',
      examples: ['report-schedule-baseline'],
    }),
    evalKey: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalRunEvalKey',
      description: '评测套件稳定标识。',
      examples: ['report-schedule'],
    }),
    evalName: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalRunEvalName',
      description: '评测套件显示名称。',
      examples: ['Report Schedule Regression'],
    }),
    experimentId: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalRunExperimentId',
      description: 'Mastra 实验 ID，用于串联实验追踪记录。',
      examples: ['exp_report_schedule_20260411'],
    }),
    failedCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiEvalRunFailedCount',
      description: '本次评测运行失败样本数。',
      examples: [0],
    }),
    id: withOpenApiSchemaDoc(z.string().uuid(), {
      title: 'AiEvalRunId',
      description: 'AI 评测运行主键 UUID。',
      examples: ['5b7d3be0-6f15-46ec-8ea6-3189d085f001'],
    }),
    requestId: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiEvalRunRequestId',
      description: '关联请求 ID，用于串联 API、任务和实验日志。',
      examples: ['req_eval_01'],
    }),
    scoreAverage: withOpenApiSchemaDoc(z.number().min(0).max(1).nullable(), {
      title: 'AiEvalRunAverageScore',
      description: '本次评测运行平均分；未完成时为 `null`。',
      examples: [0.91],
    }),
    scoreMax: withOpenApiSchemaDoc(z.number().min(0).max(1).nullable(), {
      title: 'AiEvalRunMaxScore',
      description: '本次评测运行最高分；未完成时为 `null`。',
      examples: [1],
    }),
    scoreMin: withOpenApiSchemaDoc(z.number().min(0).max(1).nullable(), {
      title: 'AiEvalRunMinScore',
      description: '本次评测运行最低分；未完成时为 `null`。',
      examples: [0.72],
    }),
    scorerSummary: withOpenApiSchemaDoc(aiEvalScorerSummarySchema, {
      title: 'AiEvalRunScorerSummary',
      description: '本次评测运行按评分器聚合后的统计结果。',
    }),
    skippedCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiEvalRunSkippedCount',
      description: '本次评测运行跳过的样本数。',
      examples: [0],
    }),
    startedAt: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalRunStartedAt',
      description: '本次评测运行开始时间，ISO 8601 字符串。',
      examples: ['2026-04-11T04:20:00.000Z'],
    }),
    status: aiEvalRunStatusSchema,
    succeededCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiEvalRunSucceededCount',
      description: '本次评测运行成功样本数。',
      examples: [12],
    }),
    totalItems: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiEvalRunTotalItems',
      description: '本次评测运行总样本数。',
      examples: [12],
    }),
    triggerSource: aiEvalTriggerSourceSchema,
  }),
  {
    title: 'AiEvalRunEntry',
    description: '单次 AI 评测运行记录，包含实验元信息、评分摘要和触发主体。',
    examples: [
      {
        actorAuthUserId: 'auth_user_01',
        actorRbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
        completedAt: '2026-04-11T04:30:00.000Z',
        createdAt: '2026-04-11T04:20:00.000Z',
        datasetId: 'dataset_report_schedule',
        datasetName: 'report-schedule-baseline',
        evalKey: 'report-schedule',
        evalName: 'Report Schedule Regression',
        experimentId: 'exp_report_schedule_20260411',
        failedCount: 0,
        id: '5b7d3be0-6f15-46ec-8ea6-3189d085f001',
        requestId: 'req_eval_01',
        scoreAverage: 0.91,
        scoreMax: 1,
        scoreMin: 0.72,
        scorerSummary: {
          factuality: {
            averageScore: 0.91,
            maxScore: 1,
            minScore: 0.72,
            sampleCount: 12,
          },
        },
        skippedCount: 0,
        startedAt: '2026-04-11T04:20:00.000Z',
        status: 'completed',
        succeededCount: 12,
        totalItems: 12,
        triggerSource: 'manual',
      },
    ],
  },
)

export const aiEvalDetailSchema = withOpenApiSchemaDoc(
  aiEvalListItemSchema.extend({
    environment: withOpenApiSchemaDoc(
      z.object({
        configured: withOpenApiSchemaDoc(z.boolean(), {
          title: 'AiEvalDetailConfigured',
          description: '当前评测运行时是否已完成配置。',
          examples: [true],
        }),
        reason: withOpenApiSchemaDoc(z.string(), {
          title: 'AiEvalDetailReason',
          description: '当前评测运行时说明，例如已配置状态或降级原因。',
          examples: ['Mastra eval suites are configured and persisted run results are available.'],
        }),
      }),
      {
        title: 'AiEvalDetailEnvironment',
        description: '单个评测详情附带的运行时环境说明。',
      },
    ),
    recentRuns: withOpenApiSchemaDoc(z.array(aiEvalRunEntrySchema), {
      title: 'AiEvalRecentRuns',
      description: '该评测套件最近的运行记录，按创建时间倒序返回。',
    }),
  }),
  {
    title: 'AiEvalDetail',
    description: '单个 AI 评测详情，补充最近运行记录和当前运行时环境说明。',
    examples: [
      {
        backing: 'mastra',
        datasetSize: 12,
        environment: {
          configured: true,
          reason: 'Mastra eval suites are configured and persisted run results are available.',
        },
        id: 'report-schedule',
        lastRunAverageScore: 0.91,
        lastRunAt: '2026-04-11T04:30:00.000Z',
        lastRunStatus: 'completed',
        name: 'Report Schedule Regression',
        notes: '覆盖报表计划任务的回归评测样本。',
        recentRuns: [
          {
            actorAuthUserId: 'auth_user_01',
            actorRbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
            completedAt: '2026-04-11T04:30:00.000Z',
            createdAt: '2026-04-11T04:20:00.000Z',
            datasetId: 'dataset_report_schedule',
            datasetName: 'report-schedule-baseline',
            evalKey: 'report-schedule',
            evalName: 'Report Schedule Regression',
            experimentId: 'exp_report_schedule_20260411',
            failedCount: 0,
            id: '5b7d3be0-6f15-46ec-8ea6-3189d085f001',
            requestId: 'req_eval_01',
            scoreAverage: 0.91,
            scoreMax: 1,
            scoreMin: 0.72,
            scorerSummary: {
              factuality: {
                averageScore: 0.91,
                maxScore: 1,
                minScore: 0.72,
                sampleCount: 12,
              },
            },
            skippedCount: 0,
            startedAt: '2026-04-11T04:20:00.000Z',
            status: 'completed',
            succeededCount: 12,
            totalItems: 12,
            triggerSource: 'manual',
          },
        ],
        scorerCount: 3,
        status: 'registered',
      },
    ],
  },
)

export const aiEvalRunResultSchema = withOpenApiSchemaDoc(
  z.object({
    completedAt: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiEvalRunResultCompletedAt',
      description: '本次触发运行完成时间；未完成时为 `null`。',
      examples: ['2026-04-11T04:30:00.000Z'],
    }),
    datasetId: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalRunResultDatasetId',
      description: '本次触发运行实际使用的数据集 ID。',
      examples: ['dataset_report_schedule'],
    }),
    datasetName: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalRunResultDatasetName',
      description: '本次触发运行实际使用的数据集名称。',
      examples: ['report-schedule-baseline'],
    }),
    evalId: aiEvalIdSchema,
    evalName: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalRunResultName',
      description: '本次触发运行的评测显示名称。',
      examples: ['Report Schedule Regression'],
    }),
    experimentId: withOpenApiSchemaDoc(z.string(), {
      title: 'AiEvalRunResultExperimentId',
      description: '本次触发运行对应的实验 ID。',
      examples: ['exp_report_schedule_20260411'],
    }),
    requestId: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiEvalRunResultRequestId',
      description: '串联本次运行的请求 ID；未传播时为 `null`。',
      examples: ['req_eval_01'],
    }),
    scoreAverage: withOpenApiSchemaDoc(z.number().min(0).max(1).nullable(), {
      title: 'AiEvalRunResultAverageScore',
      description: '本次触发运行的平均分；未完成时为 `null`。',
      examples: [0.91],
    }),
    status: aiEvalRunStatusSchema,
    totalItems: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiEvalRunResultTotalItems',
      description: '本次运行实际处理的样本数。',
      examples: [12],
    }),
  }),
  {
    title: 'AiEvalRunResult',
    description: '一次 AI 评测触发命令的结果摘要，用于治理页面确认执行结果。',
    examples: [
      {
        completedAt: '2026-04-11T04:30:00.000Z',
        datasetId: 'dataset_report_schedule',
        datasetName: 'report-schedule-baseline',
        evalId: 'report-schedule',
        evalName: 'Report Schedule Regression',
        experimentId: 'exp_report_schedule_20260411',
        requestId: 'req_eval_01',
        scoreAverage: 0.91,
        status: 'completed',
        totalItems: 12,
      },
    ],
  },
)

const promptVersionIdSchema = withOpenApiSchemaDoc(z.string().uuid(), {
  title: 'PromptVersionIdParam',
  description: 'Prompt 版本主键 UUID，用于读取单个 Prompt 版本详情。',
  examples: ['b87ecb02-478d-40ff-b2d8-3f62fd9f9001'],
})

export const getPromptVersionByIdInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: promptVersionIdSchema,
  }),
  {
    title: 'GetPromptVersionByIdInput',
    description: '读取单个 Prompt 版本详情所需的路径参数。',
    examples: [
      {
        id: 'b87ecb02-478d-40ff-b2d8-3f62fd9f9001',
      },
    ],
  },
)

export const promptVersionDetailSchema = withOpenApiSchemaDoc(promptVersionEntrySchema.extend({}), {
  title: 'PromptVersionDetail',
  description: '单个 Prompt 版本详情，供治理页面查看具体版本状态、证据和回滚关系。',
  examples: [
    {
      activatedAt: null,
      activatedByAuthUserId: null,
      activatedByRbacUserId: null,
      createdAt: '2026-04-11T04:00:00.000Z',
      createdByAuthUserId: 'auth_user_01',
      createdByRbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
      evalEvidence: null,
      id: 'b87ecb02-478d-40ff-b2d8-3f62fd9f9001',
      isActive: false,
      notes: '提高财务问答的事实一致性。',
      promptKey: 'admin.copilot.answer',
      promptText: '你是后台管理 Copilot，请优先返回结构化结论。',
      releasePolicy: {
        minAverageScore: 0.8,
        scorerThresholds: {},
      },
      releaseReady: false,
      releaseReason: '缺少评测证据。',
      rolledBackFromVersionId: null,
      status: 'draft',
      updatedAt: '2026-04-11T04:00:00.000Z',
      version: 3,
    },
  ],
})

// 工具发现 contract-first skeleton。
export const toolGenKindSchema = withOpenApiSchemaDoc(z.enum(['agent', 'copilot', 'prompt']), {
  title: 'ToolGenKind',
  description: '生成类入口类型。',
  examples: ['agent', 'copilot', 'prompt'],
})
export const toolGenStatusSchema = withOpenApiSchemaDoc(z.enum(['available', 'planned']), {
  title: 'ToolGenStatus',
  description: '生成类入口状态。',
  examples: ['available', 'planned'],
})

export const listToolGenInputSchema = withOpenApiSchemaDoc(
  baseSearchSchema
    .extend({
      kind: withOpenApiSchemaDoc(toolGenKindSchema.optional(), {
        title: 'ToolGenKindFilter',
        description: '按生成入口类型过滤。',
        examples: ['copilot'],
      }),
      status: withOpenApiSchemaDoc(toolGenStatusSchema.optional(), {
        title: 'ToolGenStatusFilter',
        description: '按生成入口状态过滤。',
        examples: ['available'],
      }),
    })
    .default({
      page: 1,
      pageSize: 10,
    }),
  {
    title: 'ListToolGenInput',
    description: '生成能力目录分页查询参数。',
    examples: [{ page: 1, pageSize: 10, kind: 'copilot', status: 'available' }],
    default: { page: 1, pageSize: 10 },
  },
)

export const toolGenListItemSchema = withOpenApiSchemaDoc(
  z.object({
    backing: withOpenApiSchemaDoc(z.enum(['copilotkit', 'mastra-agent', 'prompt-governance']), {
      title: 'ToolGenBacking',
      description: '当前入口背后的实际实现层。',
      examples: ['copilotkit'],
    }),
    description: withOpenApiSchemaDoc(z.string(), {
      title: 'ToolGenDescription',
      description: '生成入口用途说明。',
      examples: ['面向后台管理员的只读 Copilot 入口。'],
    }),
    id: withOpenApiSchemaDoc(z.string(), {
      title: 'ToolGenId',
      description: '生成入口稳定标识。',
      examples: ['admin-copilot'],
    }),
    kind: toolGenKindSchema,
    name: withOpenApiSchemaDoc(z.string(), {
      title: 'ToolGenName',
      description: '生成入口显示名称。',
      examples: ['Admin Copilot'],
    }),
    routePath: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'ToolGenRoutePath',
      description: '对应入口路径；没有直接入口时为 `null`。',
      examples: ['/mastra/agents/admin-copilot'],
    }),
    status: toolGenStatusSchema,
  }),
  {
    title: 'ToolGenListItem',
    description: '生成能力目录条目。',
    examples: [
      {
        backing: 'copilotkit',
        description: '面向后台管理员的只读 Copilot 入口。',
        id: 'admin-copilot',
        kind: 'copilot',
        name: 'Admin Copilot',
        routePath: '/mastra/agents/admin-copilot',
        status: 'available',
      },
    ],
  },
)

export const toolGenListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(toolGenListItemSchema).extend({
    summary: withOpenApiSchemaDoc(
      z.object({
        availableCount: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'ToolGenAvailableCount',
          description: '当前筛选结果中可用入口数量。',
          examples: [2],
        }),
        plannedCount: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'ToolGenPlannedCount',
          description: '当前筛选结果中规划中入口数量。',
          examples: [1],
        }),
      }),
      {
        title: 'ToolGenListSummary',
        description: '生成能力目录汇总信息。',
      },
    ),
  }),
  {
    title: 'ToolGenListResponse',
    description: '生成能力目录分页响应。',
    examples: [
      {
        data: [
          {
            backing: 'copilotkit',
            description: '面向后台管理员的只读 Copilot 入口。',
            id: 'admin-copilot',
            kind: 'copilot',
            name: 'Admin Copilot',
            routePath: '/mastra/agents/admin-copilot',
            status: 'available',
          },
        ],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        summary: {
          availableCount: 1,
          plannedCount: 0,
        },
      },
    ],
  },
)

export const toolJobModeSchema = withOpenApiSchemaDoc(z.enum(['manual', 'scheduled']), {
  title: 'ToolJobMode',
  description: '任务执行模式。',
  examples: ['manual', 'scheduled'],
})

export const listToolJobsInputSchema = withOpenApiSchemaDoc(
  baseSearchSchema
    .extend({
      mode: withOpenApiSchemaDoc(toolJobModeSchema.optional(), {
        title: 'ToolJobModeFilter',
        description: '按任务执行模式过滤。',
        examples: ['scheduled'],
      }),
    })
    .default({
      page: 1,
      pageSize: 10,
    }),
  {
    title: 'ListToolJobsInput',
    description: '任务调度目录分页查询参数。',
    examples: [{ page: 1, pageSize: 10, mode: 'scheduled' }],
    default: { page: 1, pageSize: 10 },
  },
)

export const toolJobListItemSchema = withOpenApiSchemaDoc(
  z.object({
    description: withOpenApiSchemaDoc(z.string(), {
      title: 'ToolJobDescription',
      description: '任务目录条目说明。',
      examples: ['定时生成报表并写入审计日志。'],
    }),
    id: withOpenApiSchemaDoc(z.string(), {
      title: 'ToolJobId',
      description: '任务标识。',
      examples: ['report-schedule'],
    }),
    mode: toolJobModeSchema,
    name: withOpenApiSchemaDoc(z.string(), {
      title: 'ToolJobName',
      description: '任务显示名称。',
      examples: ['Report Schedule'],
    }),
    schedule: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'ToolJobSchedule',
      description: '定时任务表达式；手动任务为 `null`。',
      examples: ['0 8 * * *'],
    }),
    status: withOpenApiSchemaDoc(z.enum(['registered', 'scheduled']), {
      title: 'ToolJobStatus',
      description: '任务目录状态。',
      examples: ['scheduled'],
    }),
    triggerConfigPath: withOpenApiSchemaDoc(z.string(), {
      title: 'ToolJobTriggerConfigPath',
      description: 'Trigger.dev 配置文件路径。',
      examples: ['apps/jobs/trigger.config.ts'],
    }),
    workflowId: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'ToolJobWorkflowId',
      description: '若当前任务绑定已注册 Workflow，则返回对应 Workflow ID；否则为 `null`。',
      examples: ['report-schedule'],
    }),
  }),
  {
    title: 'ToolJobListItem',
    description: '任务调度目录条目。',
    examples: [
      {
        description: '定时生成报表并写入审计日志。',
        id: 'report-schedule',
        mode: 'scheduled',
        name: 'Report Schedule',
        schedule: '0 8 * * *',
        status: 'scheduled',
        triggerConfigPath: 'apps/jobs/trigger.config.ts',
        workflowId: 'report-schedule',
      },
    ],
  },
)

export const toolJobsListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(toolJobListItemSchema).extend({
    summary: withOpenApiSchemaDoc(
      z.object({
        registeredCount: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'ToolJobRegisteredCount',
          description: '任务目录总数。',
          examples: [2],
        }),
        scheduledCount: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'ToolJobScheduledCount',
          description: '定时任务数量。',
          examples: [1],
        }),
        workflowLinkedCount: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'ToolJobWorkflowLinkedCount',
          description: '已绑定 Workflow 的任务数量。',
          examples: [1],
        }),
      }),
      {
        title: 'ToolJobsListSummary',
        description: '任务调度目录汇总信息。',
      },
    ),
  }),
  {
    title: 'ToolJobsListResponse',
    description: '任务调度目录分页响应。',
    examples: [
      {
        data: [
          {
            description: '定时生成报表并写入审计日志。',
            id: 'report-schedule',
            mode: 'scheduled',
            name: 'Report Schedule',
            schedule: '0 8 * * *',
            status: 'scheduled',
            triggerConfigPath: 'apps/jobs/trigger.config.ts',
            workflowId: 'report-schedule',
          },
        ],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        summary: {
          registeredCount: 1,
          scheduledCount: 1,
          workflowLinkedCount: 1,
        },
      },
    ],
  },
)

export type ListUsersInput = z.infer<typeof listUsersInputSchema>
export type GetUserByIdInput = z.infer<typeof getUserByIdInputSchema>
export type CreateUserInput = z.infer<typeof createUserInputSchema>
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>
export type DeleteUserInput = z.infer<typeof deleteUserInputSchema>
export type UserEntry = z.infer<typeof userEntrySchema>
export type UserListResponse = z.infer<typeof userListResponseSchema>
export type DeleteUserResult = z.infer<typeof deleteUserResultSchema>
export type ListRolesInput = z.infer<typeof listRolesInputSchema>
export type GetRoleByIdInput = z.infer<typeof getRoleByIdInputSchema>
export type CreateRoleInput = z.infer<typeof createRoleInputSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleInputSchema>
export type DeleteRoleInput = z.infer<typeof deleteRoleInputSchema>
export type RoleEntry = z.infer<typeof roleEntrySchema>
export type RoleListResponse = z.infer<typeof roleListResponseSchema>
export type DeleteRoleResult = z.infer<typeof deleteRoleResultSchema>
export type ListPermissionsInput = z.infer<typeof listPermissionsInputSchema>
export type GetPermissionByIdInput = z.infer<typeof getPermissionByIdInputSchema>
export type CreatePermissionInput = z.infer<typeof createPermissionInputSchema>
export type UpdatePermissionInput = z.infer<typeof updatePermissionInputSchema>
export type DeletePermissionInput = z.infer<typeof deletePermissionInputSchema>
export type PermissionEntry = z.infer<typeof permissionEntrySchema>
export type PermissionListResponse = z.infer<typeof permissionListResponseSchema>
export type DeletePermissionResult = z.infer<typeof deletePermissionResultSchema>
export type ListMenusInput = z.infer<typeof listMenusInputSchema>
export type GetMenuByIdInput = z.infer<typeof getMenuByIdInputSchema>
export type CreateMenuInput = z.infer<typeof createMenuInputSchema>
export type UpdateMenuInput = z.infer<typeof updateMenuInputSchema>
export type DeleteMenuInput = z.infer<typeof deleteMenuInputSchema>
export type MenuEntry = z.infer<typeof menuEntrySchema>
export type MenuListResponse = z.infer<typeof menuListResponseSchema>
export type DeleteMenuResult = z.infer<typeof deleteMenuResultSchema>
export type ListDictsInput = z.infer<typeof listDictsInputSchema>
export type DictListResponse = z.infer<typeof dictListResponseSchema>
export type ListConfigsInput = z.infer<typeof listConfigsInputSchema>
export type ConfigListResponse = z.infer<typeof configListResponseSchema>
export type ListOperationLogsInput = z.infer<typeof listOperationLogsInputSchema>
export type OperationLogListResponse = z.infer<typeof operationLogListResponseSchema>
export type ListOnlineUsersInput = z.infer<typeof listOnlineUsersInputSchema>
export type OnlineUserListResponse = z.infer<typeof onlineUserListResponseSchema>
export type ServerSummary = z.infer<typeof serverSummarySchema>
export type ListKnowledgeInput = z.infer<typeof listKnowledgeInputSchema>
export type GetKnowledgeByIdInput = z.infer<typeof getKnowledgeByIdInputSchema>
export type CreateKnowledgeInput = z.infer<typeof createKnowledgeInputSchema>
export type UpdateKnowledgeInput = z.infer<typeof updateKnowledgeInputSchema>
export type DeleteKnowledgeInput = z.infer<typeof deleteKnowledgeInputSchema>
export type KnowledgeEntry = z.infer<typeof knowledgeEntrySchema>
export type KnowledgeListResponse = z.infer<typeof knowledgeListResponseSchema>
export type DeleteKnowledgeResult = z.infer<typeof deleteKnowledgeResultSchema>
export type ListAiAuditLogsInput = z.infer<typeof listAiAuditLogsInputSchema>
export type GetAiAuditLogByIdInput = z.infer<typeof getAiAuditLogByIdInputSchema>
export type AiAuditDetail = z.infer<typeof aiAuditDetailSchema>
export type AiAuditListResponse = z.infer<typeof aiAuditListResponseSchema>
export type ListAiFeedbackInput = z.infer<typeof listAiFeedbackInputSchema>
export type GetAiFeedbackByIdInput = z.infer<typeof getAiFeedbackByIdInputSchema>
export type AiFeedbackDetail = z.infer<typeof aiFeedbackDetailSchema>
export type AiFeedbackListResponse = z.infer<typeof aiFeedbackListResponseSchema>
export type ListAiEvalsInput = z.infer<typeof listAiEvalsInputSchema>
export type GetAiEvalByIdInput = z.infer<typeof getAiEvalByIdInputSchema>
export type RunAiEvalInput = z.infer<typeof runAiEvalInputSchema>
export type AiEvalRunEntry = z.infer<typeof aiEvalRunEntrySchema>
export type AiEvalDetail = z.infer<typeof aiEvalDetailSchema>
export type AiEvalRunResult = z.infer<typeof aiEvalRunResultSchema>
export type AiEvalListResponse = z.infer<typeof aiEvalListResponseSchema>
export type GetPromptVersionByIdInput = z.infer<typeof getPromptVersionByIdInputSchema>
export type PromptVersionDetail = z.infer<typeof promptVersionDetailSchema>
export type ListToolGenInput = z.infer<typeof listToolGenInputSchema>
export type ToolGenListResponse = z.infer<typeof toolGenListResponseSchema>
export type ListToolJobsInput = z.infer<typeof listToolJobsInputSchema>
export type ToolJobsListResponse = z.infer<typeof toolJobsListResponseSchema>
