import { z } from 'zod'

import { appActions, appSubjects } from '../abilities/subjects'
import { withOpenApiSchemaDoc } from './openapi-doc'

export const permissionConditionsSchema = z.record(z.string(), z.unknown()).nullable().optional()

export const permissionRuleSchema = withOpenApiSchemaDoc(
  z.object({
    action: withOpenApiSchemaDoc(z.enum(appActions), {
      title: 'PermissionRuleAction',
      description: '当前权限规则允许或拒绝的动作。',
      examples: ['read'],
    }),
    conditions: withOpenApiSchemaDoc(permissionConditionsSchema, {
      title: 'PermissionRuleConditions',
      description: 'CASL 条件表达式；无条件规则时为 `null` 或省略。',
      examples: [{ ownerId: 'user_01' }, null],
    }),
    fields: withOpenApiSchemaDoc(z.array(z.string()).optional(), {
      title: 'PermissionRuleFields',
      description: '字段级权限范围；未设置时表示作用于该主体的全部字段。',
      examples: [['email', 'name']],
    }),
    inverted: withOpenApiSchemaDoc(z.boolean().optional(), {
      title: 'PermissionRuleInverted',
      description: '是否为拒绝规则；未设置时表示允许规则。',
      examples: [false],
    }),
    subject: withOpenApiSchemaDoc(z.enum(appSubjects), {
      title: 'PermissionRuleSubject',
      description: '规则作用的业务资源主体。',
      examples: ['User'],
    }),
  }),
  {
    title: 'PermissionRule',
    description: '归一化后的 CASL 权限规则条目。',
    examples: [
      {
        action: 'read',
        conditions: null,
        fields: ['email', 'name'],
        inverted: false,
        subject: 'User',
      },
    ],
  },
)

export const permissionRuleListSchema = withOpenApiSchemaDoc(z.array(permissionRuleSchema), {
  title: 'PermissionRuleList',
  description: '权限规则列表，按当前主体可用的 CASL 规则序列返回。',
  examples: [
    [
      {
        action: 'read',
        conditions: null,
        fields: ['email', 'name'],
        inverted: false,
        subject: 'User',
      },
    ],
  ],
})

export const currentPermissionsResponseSchema = withOpenApiSchemaDoc(
  z.object({
    permissionRules: permissionRuleListSchema,
    rbacUserId: withOpenApiSchemaDoc(z.string().uuid().nullable(), {
      title: 'CurrentPermissionsRbacUserId',
      description: '当前请求映射到的应用 RBAC 用户 ID；未映射时为 `null`。',
      examples: ['8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001'],
    }),
    roleCodes: withOpenApiSchemaDoc(z.array(z.string()), {
      title: 'CurrentPermissionsRoleCodes',
      description: '当前主体持有的角色编码列表。',
      examples: [['super_admin']],
    }),
    userId: withOpenApiSchemaDoc(z.string(), {
      title: 'CurrentPermissionsAuthUserId',
      description: '当前 Better Auth 主体 ID。',
      examples: ['auth_user_01'],
    }),
  }),
  {
    title: 'CurrentPermissionsResponse',
    description: '当前主体的 RBAC 角色与归一化权限规则响应。',
    examples: [
      {
        permissionRules: [
          {
            action: 'read',
            conditions: null,
            fields: ['email', 'name'],
            inverted: false,
            subject: 'User',
          },
        ],
        rbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
        roleCodes: ['super_admin'],
        userId: 'auth_user_01',
      },
    ],
  },
)

export const serializedAbilityResponseSchema = withOpenApiSchemaDoc(
  z.object({
    roleCodes: withOpenApiSchemaDoc(z.array(z.string()), {
      title: 'SerializedAbilityRoleCodes',
      description: '当前主体持有的角色编码列表。',
      examples: [['super_admin']],
    }),
    rules: permissionRuleListSchema,
    userId: withOpenApiSchemaDoc(z.string(), {
      title: 'SerializedAbilityAuthUserId',
      description: '当前 Better Auth 主体 ID。',
      examples: ['auth_user_01'],
    }),
  }),
  {
    title: 'SerializedAbilityResponse',
    description: '供前端反序列化的 CASL ability 规则响应。',
    examples: [
      {
        roleCodes: ['super_admin'],
        rules: [
          {
            action: 'read',
            conditions: null,
            fields: ['email', 'name'],
            inverted: false,
            subject: 'User',
          },
        ],
        userId: 'auth_user_01',
      },
    ],
  },
)
