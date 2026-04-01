import * as React from 'react'

import { cn } from '../lib/cn'

/**
 * 提供共享表格骨架，统一表头、分隔线与响应式滚动行为。
 */
export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto">
    <table className={cn('w-full caption-bottom text-sm', className)} ref={ref} {...props} />
  </div>
))

Table.displayName = 'Table'

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    className={cn('[&_tr]:border-b [&_tr]:border-border/70', className)}
    ref={ref}
    {...props}
  />
))

TableHeader.displayName = 'TableHeader'

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    className={cn('[&_tr:last-child]:border-0 [&_tr]:border-b [&_tr]:border-border/60', className)}
    ref={ref}
    {...props}
  />
))

TableBody.displayName = 'TableBody'

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    className={cn('border-t border-border/70 bg-card/70 font-medium', className)}
    ref={ref}
    {...props}
  />
))

TableFooter.displayName = 'TableFooter'

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr className={cn('transition-colors hover:bg-card/60', className)} ref={ref} {...props} />
))

TableRow.displayName = 'TableRow'

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    className={cn(
      'h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground',
      className,
    )}
    ref={ref}
    {...props}
  />
))

TableHead.displayName = 'TableHead'

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td className={cn('px-4 py-3 align-middle text-foreground', className)} ref={ref} {...props} />
))

TableCell.displayName = 'TableCell'

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption className={cn('mt-4 text-sm text-muted-foreground', className)} ref={ref} {...props} />
))

TableCaption.displayName = 'TableCaption'
