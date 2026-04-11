import { type Database, db, defaultMenus, menus, writeOperationLog } from '@ai-native-os/db'
import {
  type AppActions,
  type AppSubjects,
  type CreateMenuInput,
  createMenuInputSchema,
  type DeleteMenuInput,
  type DeleteMenuResult,
  deleteMenuInputSchema,
  deleteMenuResultSchema,
  type GetMenuByIdInput,
  getMenuByIdInputSchema,
  type ListMenusInput,
  listMenusInputSchema,
  type MenuEntry,
  type MenuListResponse,
  menuEntrySchema,
  menuListResponseSchema,
  type UpdateMenuInput,
  updateMenuInputSchema,
} from '@ai-native-os/shared'
import { ORPCError } from '@orpc/server'
import { and, count, desc, eq, ilike, ne, or } from 'drizzle-orm'

import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination } from '@/routes/lib/pagination'

type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type DatabaseExecutor = Database | DatabaseTransaction
type MenuType = 'button' | 'directory' | 'menu'

interface MenuMutationContext {
  actorRbacUserId: string | null
  requestId: string
}

interface MenuRowProjection {
  component: string | null
  createdAt: Date
  icon: string | null
  id: string
  name: string
  parentId: string | null
  path: string | null
  permissionAction: AppActions | null
  permissionResource: AppSubjects | null
  sortOrder: number
  status: boolean
  type: MenuType
  visible: boolean
}

const menuReadPermissions = [
  { action: 'read', subject: 'Menu' },
  { action: 'manage', subject: 'Menu' },
] as const

const menuWritePermissions = [
  { action: 'manage', subject: 'Menu' },
  { action: 'manage', subject: 'all' },
] as const

const protectedSeedMenuIds = new Set(defaultMenus.map((menu) => menu.id))

/**
 * 归一化可空文本字段，避免空字符串和纯空白进入菜单持久化层。
 */
function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const normalizedValue = value.trim()

  return normalizedValue.length > 0 ? normalizedValue : null
}

/**
 * 归一化权限绑定；动作与资源必须成对出现，否则拒绝写入半残缺绑定。
 */
function normalizePermissionBinding(input: {
  permissionAction: AppActions | null | undefined
  permissionResource: AppSubjects | null | undefined
}): {
  permissionAction: AppActions | null
  permissionResource: AppSubjects | null
} {
  const permissionAction = input.permissionAction ?? null
  const permissionResource = input.permissionResource ?? null

  if ((permissionAction === null) !== (permissionResource === null)) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Permission action and resource must be provided together',
    })
  }

  return {
    permissionAction,
    permissionResource,
  }
}

/**
 * 归一化菜单写入载荷，统一收敛空值、排序和权限绑定格式。
 */
function normalizeMenuMutationInput(
  input: Pick<
    CreateMenuInput | UpdateMenuInput,
    | 'component'
    | 'icon'
    | 'name'
    | 'parentId'
    | 'path'
    | 'permissionAction'
    | 'permissionResource'
    | 'sortOrder'
    | 'status'
    | 'type'
    | 'visible'
  >,
): {
  component: string | null
  icon: string | null
  name: string
  parentId: string | null
  path: string | null
  permissionAction: AppActions | null
  permissionResource: AppSubjects | null
  sortOrder: number
  status: boolean
  type: MenuType
  visible: boolean
} {
  const normalizedPermissionBinding = normalizePermissionBinding({
    permissionAction: input.permissionAction,
    permissionResource: input.permissionResource,
  })

  return {
    component: normalizeNullableText(input.component),
    icon: normalizeNullableText(input.icon),
    name: input.name.trim(),
    parentId: input.parentId ?? null,
    path: normalizeNullableText(input.path),
    permissionAction: normalizedPermissionBinding.permissionAction,
    permissionResource: normalizedPermissionBinding.permissionResource,
    sortOrder: input.sortOrder,
    status: input.status,
    type: input.type,
    visible: input.visible,
  }
}

/**
 * 把数据库菜单行转换为稳定 API 输出，避免在多个入口重复映射字段。
 */
function mapMenuRowToEntry(row: MenuRowProjection): MenuEntry {
  return {
    component: row.component,
    createdAt: row.createdAt.toISOString(),
    icon: row.icon,
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    path: row.path,
    permissionAction: row.permissionAction,
    permissionResource: row.permissionResource,
    sortOrder: row.sortOrder,
    status: row.status,
    type: row.type,
    visible: row.visible,
  }
}

/**
 * 读取单个菜单节点，供详情接口和写后回读复用。
 */
async function loadMenuEntryById(
  menuId: string,
  database: DatabaseExecutor = db,
): Promise<MenuEntry | null> {
  const [row] = await database
    .select({
      component: menus.component,
      createdAt: menus.createdAt,
      icon: menus.icon,
      id: menus.id,
      name: menus.name,
      parentId: menus.parentId,
      path: menus.path,
      permissionAction: menus.permissionAction,
      permissionResource: menus.permissionResource,
      sortOrder: menus.sortOrder,
      status: menus.status,
      type: menus.type,
      visible: menus.visible,
    })
    .from(menus)
    .where(eq(menus.id, menuId))
    .limit(1)

  if (!row) {
    return null
  }

  return mapMenuRowToEntry({
    ...row,
    permissionAction: row.permissionAction as AppActions | null,
    permissionResource: row.permissionResource as AppSubjects | null,
    type: row.type as MenuType,
  })
}

/**
 * 校验菜单种子节点边界，避免后台管理页直接漂移基础导航基线。
 */
function assertSeedMenuBoundary(menuId: string, operationLabel: string): void {
  if (protectedSeedMenuIds.has(menuId)) {
    throw new ORPCError('BAD_REQUEST', {
      message: `Seeded menus are read-only and cannot be ${operationLabel}`,
    })
  }
}

/**
 * 校验菜单类型、路径和组件的基本组合是否合法。
 */
function assertMenuShapeBoundary(input: {
  component: string | null
  path: string | null
  type: MenuType
}): void {
  if (input.path !== null && !input.path.startsWith('/')) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Menu path must start with "/"',
    })
  }

  if (input.type === 'directory') {
    return
  }

  if (input.path === null) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Leaf menu nodes must provide a route path',
    })
  }

  if (input.type === 'menu' && input.component === null) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Menu type "menu" must provide a component identifier',
    })
  }
}

/**
 * 读取父级菜单节点并校验是否存在。
 */
async function loadParentMenuEntry(
  parentId: string | null,
  database: DatabaseExecutor = db,
): Promise<MenuEntry | null> {
  if (parentId === null) {
    return null
  }

  const parentMenuEntry = await loadMenuEntryById(parentId, database)

  if (!parentMenuEntry) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Parent menu does not exist',
    })
  }

  return parentMenuEntry
}

/**
 * 校验父级节点关系，避免把菜单挂到叶子节点下或形成自引用。
 */
async function assertParentBoundary(
  input: {
    id?: string
    parentId: string | null
  },
  database: DatabaseExecutor = db,
): Promise<void> {
  if (input.parentId === null) {
    return
  }

  if (input.id && input.id === input.parentId) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Menu cannot be its own parent',
    })
  }

  const parentMenuEntry = await loadParentMenuEntry(input.parentId, database)

  if (parentMenuEntry && parentMenuEntry.type !== 'directory') {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Parent menu must be a directory node',
    })
  }
}

/**
 * 校验更新后的父级链路不成环，避免菜单树进入无限递归结构。
 */
async function assertNoMenuCycle(
  menuId: string,
  parentId: string | null,
  database: DatabaseExecutor = db,
): Promise<void> {
  let cursorMenuId = parentId

  while (cursorMenuId !== null) {
    if (cursorMenuId === menuId) {
      throw new ORPCError('BAD_REQUEST', {
        message: 'Menu parent chain cannot create a cycle',
      })
    }

    const nextParentEntry = await loadMenuEntryById(cursorMenuId, database)
    cursorMenuId = nextParentEntry?.parentId ?? null
  }
}

/**
 * 校验路径唯一性，避免多个菜单节点声明同一路由入口。
 */
async function assertMenuPathUniqueness(
  path: string | null,
  ignoreMenuId?: string,
  database: DatabaseExecutor = db,
): Promise<void> {
  if (path === null) {
    return
  }

  const duplicatePathRows = await database
    .select({
      id: menus.id,
    })
    .from(menus)
    .where(
      ignoreMenuId ? and(eq(menus.path, path), ne(menus.id, ignoreMenuId)) : eq(menus.path, path),
    )
    .limit(1)

  if (duplicatePathRows.length > 0) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Menu path already exists',
    })
  }
}

/**
 * 统计某菜单当前的直接子节点数量，供删除保护复用。
 */
async function loadChildMenuCount(
  menuId: string,
  database: DatabaseExecutor = db,
): Promise<number> {
  const [row] = await database
    .select({
      total: count(),
    })
    .from(menus)
    .where(eq(menus.parentId, menuId))

  return row?.total ?? 0
}

/**
 * 查询菜单列表。
 */
export async function listMenus(input: ListMenusInput): Promise<MenuListResponse> {
  const filters = []

  if (input.search) {
    const searchFilter = or(
      ilike(menus.name, `%${input.search}%`),
      ilike(menus.path, `%${input.search}%`),
    )

    if (searchFilter) {
      filters.push(searchFilter)
    }
  }

  if (input.visible !== undefined) {
    filters.push(eq(menus.visible, input.visible))
  }

  if (input.status !== undefined) {
    filters.push(eq(menus.status, input.status))
  }

  const where = filters.length > 0 ? and(...filters) : undefined
  const totalRow = await db.select({ total: count() }).from(menus).where(where)
  const total = totalRow[0]?.total ?? 0
  const pageRows = await db
    .select({
      component: menus.component,
      createdAt: menus.createdAt,
      icon: menus.icon,
      id: menus.id,
      name: menus.name,
      parentId: menus.parentId,
      path: menus.path,
      permissionAction: menus.permissionAction,
      permissionResource: menus.permissionResource,
      sortOrder: menus.sortOrder,
      status: menus.status,
      type: menus.type,
      visible: menus.visible,
    })
    .from(menus)
    .where(where)
    .orderBy(menus.parentId, menus.sortOrder, desc(menus.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)

  return {
    data: pageRows.map((row) =>
      mapMenuRowToEntry({
        ...row,
        permissionAction: row.permissionAction as AppActions | null,
        permissionResource: row.permissionResource as AppSubjects | null,
        type: row.type as MenuType,
      }),
    ),
    pagination: createPagination(input.page, input.pageSize, total),
  }
}

/**
 * 读取单个菜单详情。
 */
export async function getMenuById(input: GetMenuByIdInput): Promise<MenuEntry> {
  const menuEntry = await loadMenuEntryById(input.id)

  if (!menuEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Menu not found',
    })
  }

  return menuEntry
}

/**
 * 创建自定义菜单节点，并记录操作审计。
 */
export async function createMenuEntry(
  input: CreateMenuInput,
  context: MenuMutationContext,
): Promise<MenuEntry> {
  const normalizedInput = normalizeMenuMutationInput(input)

  assertMenuShapeBoundary(normalizedInput)
  await assertParentBoundary({
    parentId: normalizedInput.parentId,
  })
  await assertMenuPathUniqueness(normalizedInput.path)

  const createdEntry = await db.transaction(async (transaction) => {
    const [createdMenuRow] = await transaction
      .insert(menus)
      .values({
        component: normalizedInput.component,
        icon: normalizedInput.icon,
        name: normalizedInput.name,
        parentId: normalizedInput.parentId,
        path: normalizedInput.path,
        permissionAction: normalizedInput.permissionAction,
        permissionResource: normalizedInput.permissionResource,
        sortOrder: normalizedInput.sortOrder,
        status: normalizedInput.status,
        type: normalizedInput.type,
        visible: normalizedInput.visible,
      })
      .returning({
        id: menus.id,
      })

    if (!createdMenuRow) {
      throw new Error('Failed to create menu')
    }

    return loadMenuEntryById(createdMenuRow.id, transaction)
  })

  if (!createdEntry) {
    throw new Error('Failed to reload created menu')
  }

  await writeOperationLog({
    action: 'create_menu',
    detail: `Created menu ${createdEntry.name} (${createdEntry.type}).`,
    module: 'system_menus',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      menuPath: createdEntry.path,
      requestId: context.requestId,
      type: createdEntry.type,
    },
    targetId: createdEntry.id,
  })

  return createdEntry
}

/**
 * 更新自定义菜单节点，并阻止种子菜单或非法树结构漂移。
 */
export async function updateMenuEntry(
  input: UpdateMenuInput,
  context: MenuMutationContext,
): Promise<MenuEntry> {
  const currentEntry = await loadMenuEntryById(input.id)

  if (!currentEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Menu not found',
    })
  }

  assertSeedMenuBoundary(currentEntry.id, 'updated')

  const normalizedInput = normalizeMenuMutationInput(input)

  assertMenuShapeBoundary(normalizedInput)
  await assertParentBoundary({
    id: input.id,
    parentId: normalizedInput.parentId,
  })
  await assertNoMenuCycle(input.id, normalizedInput.parentId)
  await assertMenuPathUniqueness(normalizedInput.path, input.id)

  const updatedEntry = await db.transaction(async (transaction) => {
    await transaction
      .update(menus)
      .set({
        component: normalizedInput.component,
        icon: normalizedInput.icon,
        name: normalizedInput.name,
        parentId: normalizedInput.parentId,
        path: normalizedInput.path,
        permissionAction: normalizedInput.permissionAction,
        permissionResource: normalizedInput.permissionResource,
        sortOrder: normalizedInput.sortOrder,
        status: normalizedInput.status,
        type: normalizedInput.type,
        visible: normalizedInput.visible,
      })
      .where(eq(menus.id, input.id))

    return loadMenuEntryById(input.id, transaction)
  })

  if (!updatedEntry) {
    throw new Error('Failed to reload updated menu')
  }

  await writeOperationLog({
    action: 'update_menu',
    detail: `Updated menu ${updatedEntry.name} (${updatedEntry.type}).`,
    module: 'system_menus',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      menuPath: updatedEntry.path,
      requestId: context.requestId,
      type: updatedEntry.type,
    },
    targetId: updatedEntry.id,
  })

  return updatedEntry
}

/**
 * 删除自定义菜单；仅允许删除无子节点的菜单，避免导航树被隐式截断。
 */
export async function deleteMenuEntry(
  input: DeleteMenuInput,
  context: MenuMutationContext,
): Promise<DeleteMenuResult> {
  const currentEntry = await loadMenuEntryById(input.id)

  if (!currentEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Menu not found',
    })
  }

  assertSeedMenuBoundary(currentEntry.id, 'deleted')

  const childMenuCount = await loadChildMenuCount(currentEntry.id)

  if (childMenuCount > 0) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Child menus must be removed before deleting this menu',
    })
  }

  await db.delete(menus).where(eq(menus.id, input.id))

  await writeOperationLog({
    action: 'delete_menu',
    detail: `Deleted menu ${currentEntry.name}.`,
    module: 'system_menus',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      menuPath: currentEntry.path,
      requestId: context.requestId,
      type: currentEntry.type,
    },
    targetId: currentEntry.id,
  })

  return {
    deleted: true,
    id: currentEntry.id,
  }
}

/**
 * 对外暴露菜单列表读取 procedure。
 */
export const menusListProcedure = requireAnyPermission(menuReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/menus',
    tags: ['System:Menus'],
    summary: '查询菜单列表',
    description:
      '分页返回菜单节点目录，并附带路径、层级关系和权限绑定元数据，供菜单管理界面直接展示。',
  })
  .input(listMenusInputSchema)
  .output(menuListResponseSchema)
  .handler(async ({ input }) => listMenus(input))

/**
 * 对外暴露单菜单详情 procedure。
 */
export const menusGetByIdProcedure = requireAnyPermission(menuReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/menus/:id',
    tags: ['System:Menus'],
    summary: '读取单个菜单详情',
    description: '按菜单 UUID 读取单个菜单节点详情，返回路径、组件、父级和权限绑定信息。',
  })
  .input(getMenuByIdInputSchema)
  .output(menuEntrySchema)
  .handler(async ({ input }) => getMenuById(input))

/**
 * 对外暴露菜单创建 procedure。
 */
export const menusCreateProcedure = requireAnyPermission(menuWritePermissions)
  .route({
    method: 'POST',
    path: '/api/v1/system/menus',
    tags: ['System:Menus'],
    summary: '创建菜单',
    description:
      '创建自定义菜单节点并写入路径、层级和权限绑定元数据；服务端会校验父级存在、路径唯一和权限绑定完整性，并记录审计日志。',
  })
  .input(createMenuInputSchema)
  .output(menuEntrySchema)
  .handler(async ({ context, input }) =>
    createMenuEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

/**
 * 对外暴露菜单更新 procedure。
 */
export const menusUpdateProcedure = requireAnyPermission(menuWritePermissions)
  .route({
    method: 'PUT',
    path: '/api/v1/system/menus/:id',
    tags: ['System:Menus'],
    summary: '更新菜单',
    description:
      '更新自定义菜单节点的名称、层级、路径、类型、可见性和权限绑定；系统保留菜单、成环父链和路径冲突会在服务端被拒绝。',
  })
  .input(updateMenuInputSchema)
  .output(menuEntrySchema)
  .handler(async ({ context, input }) =>
    updateMenuEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

/**
 * 对外暴露菜单删除 procedure。
 */
export const menusDeleteProcedure = requireAnyPermission(menuWritePermissions)
  .route({
    method: 'DELETE',
    path: '/api/v1/system/menus/:id',
    tags: ['System:Menus'],
    summary: '删除菜单',
    description:
      '删除一个没有子节点的自定义菜单；系统保留菜单和仍承载子节点的菜单会在服务端被拒绝删除，并记录审计日志。',
  })
  .input(deleteMenuInputSchema)
  .output(deleteMenuResultSchema)
  .handler(async ({ context, input }) =>
    deleteMenuEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )
