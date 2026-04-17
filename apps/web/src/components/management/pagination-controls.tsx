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
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4"
    >
      <div className="text-sm leading-6 text-muted-foreground">
        Page {page} / {Math.max(totalPages, 1)} · {pageSize} rows per page · {total} total rows
      </div>

      <div className="flex items-center gap-2">
        {previousHref ? (
          <Button asChild size="sm" variant="secondary">
            <a aria-label={`Go to page ${Math.max(page - 1, 1)}`} href={previousHref}>
              Previous
            </a>
          </Button>
        ) : (
          <span className="inline-flex h-9 items-center justify-center rounded-full border border-border/80 px-4 text-sm text-muted-foreground opacity-60">
            Previous
          </span>
        )}
        {nextHref ? (
          <Button asChild size="sm" variant="secondary">
            <a aria-label={`Go to page ${page + 1}`} href={nextHref}>
              Next
            </a>
          </Button>
        ) : (
          <span className="inline-flex h-9 items-center justify-center rounded-full border border-border/80 px-4 text-sm text-muted-foreground opacity-60">
            Next
          </span>
        )}
      </div>
    </nav>
  )
}
