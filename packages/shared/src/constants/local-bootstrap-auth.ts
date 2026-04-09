export type LocalBootstrapRoleCode = 'super_admin' | 'admin' | 'editor' | 'viewer'

export interface LocalBootstrapSubject {
  email: string
  nickname: string
  roleCode: LocalBootstrapRoleCode
  username: string
}

export interface LocalBootstrapCredentials {
  email: string
  password: string
}

/**
 * 本地 / 测试环境默认登录主体。
 *
 * 约束说明：
 * - 仅用于 fresh setup、自动化测试和本地演示闭环
 * - 生产环境不应暴露这组已知口令账号
 * - 角色清单必须与 `packages/db` 的 RBAC seed 保持一一对应
 */
export const localBootstrapSubjects: readonly LocalBootstrapSubject[] = [
  {
    email: 'super_admin@ai-native-os.local',
    nickname: '超级管理员',
    roleCode: 'super_admin',
    username: 'super_admin',
  },
  {
    email: 'admin@ai-native-os.local',
    nickname: '管理员',
    roleCode: 'admin',
    username: 'admin',
  },
  {
    email: 'editor@ai-native-os.local',
    nickname: '编辑员',
    roleCode: 'editor',
    username: 'editor',
  },
  {
    email: 'viewer@ai-native-os.local',
    nickname: '查看者',
    roleCode: 'viewer',
    username: 'viewer',
  },
] as const

/**
 * 本地 bootstrap 默认口令。
 *
 * 注意：
 * - 这是显式约定的开发 / 测试口令，不是生产密钥
 * - 只有在非生产环境下才允许通过 UI 提示或 seed 注入该口令
 */
export const localBootstrapPassword = 'Passw0rd!Passw0rd!' as const

/**
 * 按角色编码读取默认 bootstrap 主体，保证 seed 与页面提示共用同一份清单。
 */
function getLocalBootstrapSubjectByRoleCode(
  roleCode: LocalBootstrapRoleCode,
): LocalBootstrapSubject {
  const matchedSubject = localBootstrapSubjects.find((subject) => subject.roleCode === roleCode)

  if (!matchedSubject) {
    throw new Error(`Missing local bootstrap subject for role code: ${roleCode}`)
  }

  return matchedSubject
}

export const localBootstrapAdminCredentials: LocalBootstrapCredentials = {
  email: getLocalBootstrapSubjectByRoleCode('admin').email,
  password: localBootstrapPassword,
}

/**
 * 判断当前环境是否允许创建和提示本地 bootstrap 账号。
 *
 * 设计边界：
 * - 生产环境默认关闭，避免把固定口令账号注入真实环境
 * - 开发、测试和未显式声明环境的本地 shell 默认开启，满足 fresh setup 闭环
 */
export function shouldEnableLocalBootstrapAuth(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production'
}

/**
 * 为登录页返回开发态默认管理员提示。
 *
 * 这里不在生产环境返回任何内容，防止 UI 暴露固定口令约定。
 */
export function resolveLocalBootstrapAdminCredentials(
  env: NodeJS.ProcessEnv = process.env,
): LocalBootstrapCredentials | undefined {
  if (!shouldEnableLocalBootstrapAuth(env)) {
    return undefined
  }

  return localBootstrapAdminCredentials
}
