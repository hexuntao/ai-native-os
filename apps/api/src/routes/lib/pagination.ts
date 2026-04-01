export interface PaginationPayload {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * 统一生成分页元数据，避免每个骨架路由重复计算总页数。
 */
export function createPagination(page: number, pageSize: number, total: number): PaginationPayload {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/**
 * 对内存中的聚合数组执行分页。
 *
 * 适用场景：
 * - 当前只有聚合视图，没有单独的持久化物化表
 * - 纠偏任务先补 contract skeleton，后续再替换为更高效的查询模型
 */
export function paginateArray<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const offset = (page - 1) * pageSize

  return items.slice(offset, offset + pageSize)
}
