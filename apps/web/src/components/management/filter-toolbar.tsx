import { Button, Field, FieldLabel, Input } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

interface FilterToolbarProps {
  actionHref: string
  children?: ReactNode
  pageSize: number
  resetHref: string
  searchDefaultValue?: string | undefined
  searchLabel?: string
  searchPlaceholder: string
}

/**
 * 统一管理台的 GET 筛选工具栏，确保不同页面的查询行为和重置行为保持一致。
 */
export function FilterToolbar({
  actionHref,
  children,
  pageSize,
  resetHref,
  searchDefaultValue,
  searchLabel = 'Search',
  searchPlaceholder,
}: FilterToolbarProps): ReactNode {
  return (
    <form
      action={actionHref}
      className="grid gap-4 rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4 lg:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,1fr))_auto]"
      method="GET"
    >
      <input name="page" type="hidden" value="1" />
      <input name="pageSize" type="hidden" value={String(pageSize)} />

      <Field>
        <FieldLabel htmlFor="search">{searchLabel}</FieldLabel>
        <Input
          defaultValue={searchDefaultValue}
          id="search"
          name="search"
          placeholder={searchPlaceholder}
        />
      </Field>

      {children}

      <div className="flex items-end gap-3">
        <Button type="submit">Apply</Button>
        <Button asChild type="button" variant="secondary">
          <a href={resetHref}>Reset</a>
        </Button>
      </div>
    </form>
  )
}
