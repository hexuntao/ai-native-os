'use client'

import { Badge, Button } from '@ai-native-os/ui'
import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

interface OperatorSelectionItem {
  id: string
  label: string
}

interface OperatorWorkbenchProps {
  children: ReactNode
  primaryActionLabel?: string | undefined
  primaryActionTargetId?: string | undefined
  searchInputId?: string | undefined
  selectionItems: readonly OperatorSelectionItem[]
  surfaceLabel: string
}

interface OperatorWorkbenchContextValue {
  allSelected: boolean
  isSelected: (id: string) => boolean
  selectedCount: number
  toggleAll: () => void
  toggleOne: (id: string) => void
}

const checkboxClassName =
  'h-4 w-4 rounded border border-border/80 bg-background text-primary shadow-sm outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2'

const OperatorWorkbenchContext = createContext<OperatorWorkbenchContextValue | null>(null)

/**
 * 判断当前键盘事件是否发生在可编辑目标内，避免全局快捷键干扰真实输入。
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * 在当前文档中聚焦指定搜索框，用于目录页统一的 `/` 快捷键。
 */
function focusSearchInput(searchInputId: string): void {
  const searchElement = document.getElementById(searchInputId)

  if (searchElement instanceof HTMLInputElement) {
    searchElement.focus()
    searchElement.select()
  }
}

/**
 * 触发页面级主操作按钮，供 `n` 快捷键和紧凑工具条复用。
 */
function triggerPrimaryAction(primaryActionTargetId: string | undefined): void {
  if (!primaryActionTargetId) {
    return
  }

  const triggerElement = document.getElementById(primaryActionTargetId)

  if (triggerElement instanceof HTMLButtonElement) {
    triggerElement.click()
  }
}

/**
 * 复制当前选中项标签，便于操作者快速转交批处理上下文。
 */
async function copySelectionToClipboard(
  selectionItems: readonly OperatorSelectionItem[],
): Promise<void> {
  if (selectionItems.length === 0 || typeof navigator === 'undefined' || !navigator.clipboard) {
    return
  }

  const payload = selectionItems.map((item) => `${item.label} (${item.id})`).join('\n')

  await navigator.clipboard.writeText(payload)
}

/**
 * 读取目录页选择上下文，确保行级复选框和工具条共享同一批量状态。
 */
function useOperatorWorkbenchContext(): OperatorWorkbenchContextValue {
  const context = useContext(OperatorWorkbenchContext)

  if (!context) {
    throw new Error('OperatorWorkbench components must be used within OperatorWorkbench.')
  }

  return context
}

/**
 * 为目录型页面提供本地批量选择、快捷键和高密度工具条，不改变服务端数据流。
 */
export function OperatorWorkbench({
  children,
  primaryActionLabel,
  primaryActionTargetId,
  searchInputId = 'search',
  selectionItems,
  surfaceLabel,
}: OperatorWorkbenchProps): ReactNode {
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
  const [copied, setCopied] = useState(false)
  const selectableIds = useMemo(
    () => selectionItems.map((selectionItem) => selectionItem.id),
    [selectionItems],
  )

  const selectedItems = useMemo(
    () => selectionItems.filter((selectionItem) => selectedIds.includes(selectionItem.id)),
    [selectedIds, selectionItems],
  )

  const allSelected = selectableIds.length > 0 && selectedIds.length === selectableIds.length

  useEffect(() => {
    setSelectedIds((currentSelection) =>
      currentSelection.filter((selectedId) => selectableIds.includes(selectedId)),
    )
  }, [selectableIds])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) {
        if (event.key === 'Escape' && selectedIds.length > 0) {
          setSelectedIds([])
        }

        return
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === '/') {
        event.preventDefault()
        focusSearchInput(searchInputId)
        return
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        triggerPrimaryAction(primaryActionTargetId)
        return
      }

      if (
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        event.shiftKey &&
        event.key === 'A'
      ) {
        event.preventDefault()
        setSelectedIds((currentSelection) =>
          currentSelection.length === selectableIds.length ? [] : selectableIds,
        )
        return
      }

      if (event.key === 'Escape' && selectedIds.length > 0) {
        event.preventDefault()
        setSelectedIds([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [primaryActionTargetId, searchInputId, selectableIds, selectedIds.length])

  useEffect(() => {
    if (!copied) {
      return
    }

    const timeout = window.setTimeout(() => setCopied(false), 1500)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [copied])

  const contextValue: OperatorWorkbenchContextValue = {
    allSelected,
    isSelected: (id: string): boolean => selectedIds.includes(id),
    selectedCount: selectedIds.length,
    toggleAll: (): void => {
      setSelectedIds((currentSelection) =>
        currentSelection.length === selectableIds.length ? [] : selectableIds,
      )
    },
    toggleOne: (id: string): void => {
      setSelectedIds((currentSelection) =>
        currentSelection.includes(id)
          ? currentSelection.filter((selectedId) => selectedId !== id)
          : [...currentSelection, id],
      )
    },
  }

  return (
    <OperatorWorkbenchContext.Provider value={contextValue}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-border/70 bg-background/72 px-4 py-3">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{surfaceLabel}</p>
              <Badge variant={selectedIds.length > 0 ? 'accent' : 'secondary'}>
                {selectedIds.length > 0
                  ? `${selectedIds.length} selected`
                  : `${selectionItems.length} visible`}
              </Badge>
              {copied ? <Badge variant="outline">Copied</Badge> : null}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              `/` 聚焦搜索，`Shift+A` 切换全选，`Esc` 清空选择，`N` 打开主操作。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {primaryActionLabel && primaryActionTargetId ? (
              <Button
                size="sm"
                type="button"
                variant="default"
                onClick={() => triggerPrimaryAction(primaryActionTargetId)}
              >
                {primaryActionLabel}
              </Button>
            ) : null}
            <Button size="sm" type="button" variant="secondary" onClick={contextValue.toggleAll}>
              {allSelected ? 'Clear visible' : 'Select visible'}
            </Button>
            <Button
              disabled={selectedItems.length === 0}
              size="sm"
              type="button"
              variant="secondary"
              onClick={async () => {
                await copySelectionToClipboard(selectedItems)
                setCopied(true)
              }}
            >
              Copy selected
            </Button>
          </div>
        </div>

        {children}
      </div>
    </OperatorWorkbenchContext.Provider>
  )
}

/**
 * 渲染表头全选框，并正确反映全选与半选状态。
 */
export function OperatorSelectionHeader(): ReactNode {
  const checkboxRef = useRef<HTMLInputElement | null>(null)
  const { allSelected, selectedCount, toggleAll } = useOperatorWorkbenchContext()

  useEffect(() => {
    if (!checkboxRef.current) {
      return
    }

    checkboxRef.current.indeterminate = selectedCount > 0 && !allSelected
  }, [allSelected, selectedCount])

  return (
    <div className="flex items-center justify-center">
      <input
        aria-label="Select all visible rows"
        checked={allSelected}
        className={checkboxClassName}
        ref={checkboxRef}
        type="checkbox"
        onChange={toggleAll}
      />
    </div>
  )
}

interface OperatorSelectionCheckboxProps {
  itemId: string
  label: string
}

/**
 * 渲染行级选择框，供目录页在不改变服务端数据流的前提下启用本地批量操作。
 */
export function OperatorSelectionCheckbox({
  itemId,
  label,
}: OperatorSelectionCheckboxProps): ReactNode {
  const { isSelected, toggleOne } = useOperatorWorkbenchContext()

  return (
    <div className="flex items-center justify-center">
      <input
        aria-label={`Select ${label}`}
        checked={isSelected(itemId)}
        className={checkboxClassName}
        type="checkbox"
        onChange={() => toggleOne(itemId)}
      />
    </div>
  )
}
