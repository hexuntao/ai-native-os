import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface PagePaginationProps {
  nextHref?: string
  page: number
  pageSize: number
  previousHref?: string
  total: number
  totalPages: number
}

export function PagePagination({
  nextHref,
  page,
  pageSize,
  previousHref,
  total,
  totalPages,
}: PagePaginationProps): React.ReactNode {
  return (
    <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground text-sm">
        Page {page} of {Math.max(totalPages, 1)} · {total} items · {pageSize} per page
      </p>
      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            {previousHref ? (
              <PaginationPrevious href={previousHref} />
            ) : (
              <span className="text-muted-foreground inline-flex h-9 items-center px-3 text-sm">
                Previous
              </span>
            )}
          </PaginationItem>
          <PaginationItem>
            {nextHref ? (
              <PaginationNext href={nextHref} />
            ) : (
              <span className="text-muted-foreground inline-flex h-9 items-center px-3 text-sm">
                Next
              </span>
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
