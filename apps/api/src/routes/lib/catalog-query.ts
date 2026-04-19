import { createPagination, type PaginationPayload, paginateArray } from './pagination'

/**
 * 归一化目录型查询的搜索词，统一去除首尾空白并转为小写。
 */
export function normalizeCatalogSearchTerm(search: string | undefined): string | null {
  const normalizedSearch = search?.trim().toLowerCase()

  return normalizedSearch ? normalizedSearch : null
}

/**
 * 判断当前条目是否命中目录型搜索词，避免每个路由重复写同一段字段匹配逻辑。
 */
export function matchesCatalogSearch(
  fields: readonly string[],
  normalizedSearch: string | null,
): boolean {
  if (!normalizedSearch) {
    return true
  }

  return fields.some((field) => field.toLowerCase().includes(normalizedSearch))
}

/**
 * 对目录条目按指定字符串键排序，统一使用 localeCompare 保持稳定输出。
 */
export function sortCatalogByString<T>(items: readonly T[], select: (item: T) => string): T[] {
  return [...items].sort((left, right) => select(left).localeCompare(select(right)))
}

/**
 * 为目录型聚合结果返回统一分页结果，减少列表路由重复手工拼装。
 */
export function paginateCatalog<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): {
  data: T[]
  pagination: PaginationPayload
} {
  return {
    data: paginateArray(items, page, pageSize),
    pagination: createPagination(page, pageSize, items.length),
  }
}
