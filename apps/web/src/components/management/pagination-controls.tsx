import { Button } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

interface PaginationControlsProps {
  nextHref?: string | undefined
  page: number
  pageSize: number
  previousHref?: string | undefined
  total: number
  totalPages: number
}

/**
 * 提供统一的上一页/下一页控制，避免各个管理页散落分页逻辑。
 */
export function PaginationControls({
  nextHref,
  page,
  pageSize,
  previousHref,
  total,
  totalPages,
}: PaginationControlsProps): ReactNode {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
      <div className="text-sm leading-6 text-muted-foreground">
        Page {page} / {Math.max(totalPages, 1)} · {pageSize} rows per page · {total} total rows
      </div>

      <div className="flex items-center gap-2">
        <Button asChild disabled={!previousHref} size="sm" variant="secondary">
          <a aria-disabled={!previousHref} href={previousHref ?? '#'}>
            Previous
          </a>
        </Button>
        <Button asChild disabled={!nextHref} size="sm" variant="secondary">
          <a aria-disabled={!nextHref} href={nextHref ?? '#'}>
            Next
          </a>
        </Button>
      </div>
    </div>
  )
}
