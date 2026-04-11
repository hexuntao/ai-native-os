import { z } from 'zod'

import { appActions, appSubjects } from '../abilities/subjects'
import { aiEvalRunStatusSchema } from './ai-evals'
import {
  aiFeedbackEntrySchema,
  aiFeedbackSummarySchema,
  aiFeedbackUserActionSchema,
} from './ai-feedback'
import { aiKnowledgeMetadataSchema } from './ai-knowledge'
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
export const dictEntrySchema = z.object({
  label: z.string(),
  sortOrder: z.number().int().min(0),
  value: z.string(),
})

export const listDictsInputSchema = baseSearchSchema
  .extend({
    source: z.enum(['runtime', 'seed']).optional(),
    status: booleanQuerySchema.optional(),
  })
  .default({
    page: 1,
    pageSize: 10,
  })

export const dictListItemSchema = z.object({
  code: z.string(),
  createdAt: z.string(),
  description: z.string().nullable(),
  entries: z.array(dictEntrySchema),
  entryCount: z.number().int().min(0),
  id: z.string(),
  name: z.string(),
  source: z.enum(['runtime', 'seed']),
  status: z.boolean(),
  updatedAt: z.string(),
})

export const dictListResponseSchema = paginatedResponseSchema(dictListItemSchema)

// 系统配置 contract-first skeleton。
export const configScopeSchema = z.enum(['ai', 'application', 'deploy', 'security'])

export const listConfigsInputSchema = baseSearchSchema
  .extend({
    scope: configScopeSchema.optional(),
  })
  .default({
    page: 1,
    pageSize: 10,
  })

export const configListItemSchema = z.object({
  description: z.string(),
  key: z.string(),
  mutable: z.boolean(),
  scope: configScopeSchema,
  source: z.enum(['env', 'runtime', 'static']),
  updatedAt: z.string(),
  value: z.string(),
})

export const configListResponseSchema = paginatedResponseSchema(configListItemSchema)

export const listOperationLogsInputSchema = baseSearchSchema.extend({
  module: z.string().trim().min(1).max(100).optional(),
  status: z.enum(['error', 'success']).optional(),
})

export const operationLogListItemSchema = z.object({
  action: z.string(),
  createdAt: z.string(),
  detail: z.string(),
  errorMessage: z.string().nullable(),
  id: z.string().uuid(),
  module: z.string(),
  operatorId: z.string().uuid(),
  requestId: z.string().nullable(),
  status: z.string(),
  targetId: z.string().uuid().nullable(),
})

export const operationLogListResponseSchema = paginatedResponseSchema(operationLogListItemSchema)

export const listOnlineUsersInputSchema = baseSearchSchema

export const onlineUserListItemSchema = z.object({
  createdAt: z.string(),
  email: z.string().email(),
  expiresAt: z.string(),
  ipAddress: z.string().nullable(),
  name: z.string(),
  rbacUserId: z.string().uuid().nullable(),
  roleCodes: z.array(z.string()),
  sessionId: z.string(),
  userAgent: z.string().nullable(),
  userId: z.string(),
})

export const onlineUserListResponseSchema = paginatedResponseSchema(onlineUserListItemSchema)

export const serverSummarySchema = z.object({
  environment: z.object({
    nodeEnv: z.string(),
    port: z.number().int(),
  }),
  health: z.object({
    api: z.literal('ok'),
    ai: aiRuntimeCapabilitySchema,
    database: dependencyHealthStatusSchema,
    redis: dependencyHealthStatusSchema,
    status: z.enum(['degraded', 'ok']),
    telemetry: telemetryHealthSchema,
  }),
  runtime: z.object({
    agentCount: z.number().int().min(0),
    enabledAgentCount: z.number().int().min(0),
    runtimeStage: z.enum(['agents_ready', 'tools_only', 'workflows_ready']),
    toolCount: z.number().int().min(0),
    workflowCount: z.number().int().min(0),
  }),
})

export const listKnowledgeInputSchema = baseSearchSchema.extend({
  sourceType: z.string().trim().min(1).max(50).optional(),
})

export const knowledgeListItemSchema = z.object({
  chunkCount: z.number().int().min(0),
  documentId: z.string().uuid(),
  lastIndexedAt: z.string(),
  metadata: aiKnowledgeMetadataSchema,
  sourceType: z.string(),
  sourceUri: z.string().nullable(),
  title: z.string(),
})

export const knowledgeListResponseSchema = paginatedResponseSchema(knowledgeListItemSchema)

export const listAiAuditLogsInputSchema = queryPaginationSchema.extend({
  status: z.enum(['error', 'forbidden', 'success']).optional(),
  toolId: z.string().trim().min(1).max(100).optional(),
})

export const aiAuditListResponseSchema = paginatedResponseSchema(aiAuditLogEntrySchema)

export const listAiFeedbackInputSchema = queryPaginationSchema.extend({
  accepted: booleanQuerySchema.optional(),
  auditLogId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(100).optional(),
  userAction: aiFeedbackUserActionSchema.optional(),
})

export const aiFeedbackListResponseSchema = paginatedResponseSchema(aiFeedbackEntrySchema).extend({
  summary: aiFeedbackSummarySchema,
})

export const listAiEvalsInputSchema = queryPaginationSchema

export const aiEvalListItemSchema = z.object({
  backing: z.literal('mastra'),
  datasetSize: z.number().int().min(0),
  id: z.string(),
  lastRunAverageScore: z.number().min(0).max(1).nullable(),
  lastRunAt: z.string().nullable(),
  lastRunStatus: aiEvalRunStatusSchema.nullable(),
  name: z.string(),
  notes: z.string(),
  scorerCount: z.number().int().min(0),
  status: z.enum(['not_configured', 'registered']),
})

export const aiEvalListResponseSchema = paginatedResponseSchema(aiEvalListItemSchema).extend({
  summary: z.object({
    configured: z.boolean(),
    reason: z.string(),
    totalDatasets: z.number().int().min(0),
    totalExperiments: z.number().int().min(0),
  }),
})

// 工具发现 contract-first skeleton。
export const toolGenKindSchema = z.enum(['agent', 'copilot', 'prompt'])
export const toolGenStatusSchema = z.enum(['available', 'planned'])

export const listToolGenInputSchema = baseSearchSchema
  .extend({
    kind: toolGenKindSchema.optional(),
    status: toolGenStatusSchema.optional(),
  })
  .default({
    page: 1,
    pageSize: 10,
  })

export const toolGenListItemSchema = z.object({
  backing: z.enum(['copilotkit', 'mastra-agent', 'prompt-governance']),
  description: z.string(),
  id: z.string(),
  kind: toolGenKindSchema,
  name: z.string(),
  routePath: z.string().nullable(),
  status: toolGenStatusSchema,
})

export const toolGenListResponseSchema = paginatedResponseSchema(toolGenListItemSchema).extend({
  summary: z.object({
    availableCount: z.number().int().min(0),
    plannedCount: z.number().int().min(0),
  }),
})

export const toolJobModeSchema = z.enum(['manual', 'scheduled'])

export const listToolJobsInputSchema = baseSearchSchema
  .extend({
    mode: toolJobModeSchema.optional(),
  })
  .default({
    page: 1,
    pageSize: 10,
  })

export const toolJobListItemSchema = z.object({
  description: z.string(),
  id: z.string(),
  mode: toolJobModeSchema,
  name: z.string(),
  schedule: z.string().nullable(),
  status: z.enum(['registered', 'scheduled']),
  triggerConfigPath: z.string(),
  workflowId: z.string().nullable(),
})

export const toolJobsListResponseSchema = paginatedResponseSchema(toolJobListItemSchema).extend({
  summary: z.object({
    registeredCount: z.number().int().min(0),
    scheduledCount: z.number().int().min(0),
    workflowLinkedCount: z.number().int().min(0),
  }),
})

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
export type KnowledgeListResponse = z.infer<typeof knowledgeListResponseSchema>
export type ListAiAuditLogsInput = z.infer<typeof listAiAuditLogsInputSchema>
export type AiAuditListResponse = z.infer<typeof aiAuditListResponseSchema>
export type ListAiFeedbackInput = z.infer<typeof listAiFeedbackInputSchema>
export type AiFeedbackListResponse = z.infer<typeof aiFeedbackListResponseSchema>
export type ListAiEvalsInput = z.infer<typeof listAiEvalsInputSchema>
export type AiEvalListResponse = z.infer<typeof aiEvalListResponseSchema>
export type ListToolGenInput = z.infer<typeof listToolGenInputSchema>
export type ToolGenListResponse = z.infer<typeof toolGenListResponseSchema>
export type ListToolJobsInput = z.infer<typeof listToolJobsInputSchema>
export type ToolJobsListResponse = z.infer<typeof toolJobsListResponseSchema>
