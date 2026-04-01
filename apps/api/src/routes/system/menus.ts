import { db, menus } from '@ai-native-os/db'
import {
  type AppActions,
  type AppSubjects,
  type ListMenusInput,
  listMenusInputSchema,
  type MenuListResponse,
  menuListResponseSchema,
} from '@ai-native-os/shared'
import { and, count, desc, eq, ilike } from 'drizzle-orm'

import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination } from '@/routes/lib/pagination'

/**
 * 提供菜单管理页所需的 contract-first 菜单列表。
 */
export async function listMenus(input: ListMenusInput): Promise<MenuListResponse> {
  const filters = []

  if (input.search) {
    filters.push(ilike(menus.name, `%${input.search}%`))
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
    .select()
    .from(menus)
    .where(where)
    .orderBy(menus.sortOrder, desc(menus.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)

  return {
    data: pageRows.map((row) => ({
      component: row.component,
      createdAt: row.createdAt.toISOString(),
      icon: row.icon,
      id: row.id,
      name: row.name,
      parentId: row.parentId,
      path: row.path,
      permissionAction: row.permissionAction as AppActions | null,
      permissionResource: row.permissionResource as AppSubjects | null,
      sortOrder: row.sortOrder,
      status: row.status,
      type: row.type,
      visible: row.visible,
    })),
    pagination: createPagination(input.page, input.pageSize, total),
  }
}

/**
 * 提供菜单管理页所需的 contract-first 菜单列表。
 */
export const menusListProcedure = requireAnyPermission([
  { action: 'read', subject: 'Menu' },
  { action: 'manage', subject: 'Menu' },
])
  .route({
    method: 'GET',
    path: '/api/v1/system/menus',
    tags: ['System:Menus'],
    summary: 'List system menus',
    description: 'Returns paginated menu definitions and their permission bindings.',
  })
  .input(listMenusInputSchema)
  .output(menuListResponseSchema)
  .handler(async ({ input }) => listMenus(input))
