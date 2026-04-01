import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 Tailwind 类名，并在冲突时保留最后一个语义更准确的样式。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
