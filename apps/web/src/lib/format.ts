const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/**
 * 统一格式化 dashboard 中的日期时间字段，避免各页出现不一致的时区与展示粒度。
 */
export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value))
}

/**
 * 统一格式化低位数统计，保证管理台摘要卡片文案稳定。
 */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}
