'use client'

import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ai-native-os/ui'
import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

interface OperatorPreviewFact {
  label: string
  value: string
}

interface OperatorPreviewPayload {
  description?: string | undefined
  eyebrow?: string | undefined
  facts?: readonly OperatorPreviewFact[] | undefined
  title: string
}

interface OperatorSelectionItem {
  id: string
  label: string
  preview?: OperatorPreviewPayload | undefined
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
  focusPreview: (id: string) => void
  isSelected: (id: string) => boolean
  previewedId: string | null
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
 * 把当前选中集序列化为 Markdown 交接块，便于运营和审计场景直接贴给他人。
 */
function createMarkdownHandoffPayload(selectionItems: readonly OperatorSelectionItem[]): string {
  return selectionItems
    .map((selectionItem) => {
      const preview = selectionItem.preview
      const factLines =
        preview?.facts?.map((fact) => `- ${fact.label}: ${fact.value}`).join('\n') ?? ''

      return [
        `## ${preview?.title ?? selectionItem.label}`,
        preview?.description ?? selectionItem.label,
        factLines,
        `- id: ${selectionItem.id}`,
      ]
        .filter((line) => line.length > 0)
        .join('\n')
    })
    .join('\n\n')
}

/**
 * 把当前选中集序列化为结构化 JSON，便于后续导入工单、聊天或审计系统。
 */
function createJsonHandoffPayload(selectionItems: readonly OperatorSelectionItem[]): string {
  return JSON.stringify(
    selectionItems.map((selectionItem) => ({
      id: selectionItem.id,
      label: selectionItem.label,
      preview: selectionItem.preview ?? null,
    })),
    null,
    2,
  )
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
  const [exportOpen, setExportOpen] = useState(false)
  const [focusedPreviewId, setFocusedPreviewId] = useState<string | null>(null)
  const selectableIds = useMemo(
    () => selectionItems.map((selectionItem) => selectionItem.id),
    [selectionItems],
  )

  const selectedItems = useMemo(
    () => selectionItems.filter((selectionItem) => selectedIds.includes(selectionItem.id)),
    [selectedIds, selectionItems],
  )
  const previewableItems = useMemo(
    () => selectionItems.filter((selectionItem) => selectionItem.preview),
    [selectionItems],
  )
  const effectivePreviewId = useMemo(() => {
    if (
      focusedPreviewId &&
      previewableItems.some((selectionItem) => selectionItem.id === focusedPreviewId)
    ) {
      return focusedPreviewId
    }

    const selectedPreviewItem = selectedItems.find((selectionItem) => selectionItem.preview)

    if (selectedPreviewItem) {
      return selectedPreviewItem.id
    }

    return previewableItems[0]?.id ?? null
  }, [focusedPreviewId, previewableItems, selectedItems])
  const previewedItem = useMemo(
    () => selectionItems.find((selectionItem) => selectionItem.id === effectivePreviewId) ?? null,
    [effectivePreviewId, selectionItems],
  )
  const exportableItems =
    selectedItems.length > 0 ? selectedItems : previewedItem ? [previewedItem] : []
  const markdownPayload = useMemo(
    () => createMarkdownHandoffPayload(exportableItems),
    [exportableItems],
  )
  const jsonPayload = useMemo(() => createJsonHandoffPayload(exportableItems), [exportableItems])

  const allSelected = selectableIds.length > 0 && selectedIds.length === selectableIds.length

  useEffect(() => {
    setSelectedIds((currentSelection) =>
      currentSelection.filter((selectedId) => selectableIds.includes(selectedId)),
    )
  }, [selectableIds])

  useEffect(() => {
    if (
      focusedPreviewId &&
      selectionItems.some((selectionItem) => selectionItem.id === focusedPreviewId)
    ) {
      return
    }

    setFocusedPreviewId(null)
  }, [focusedPreviewId, selectionItems])

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

      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'e') {
        if (exportableItems.length === 0) {
          return
        }

        event.preventDefault()
        setExportOpen(true)
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
  }, [
    exportableItems.length,
    primaryActionTargetId,
    searchInputId,
    selectableIds,
    selectedIds.length,
  ])

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
    focusPreview: (id: string): void => {
      setFocusedPreviewId(id)
    },
    isSelected: (id: string): boolean => selectedIds.includes(id),
    previewedId: effectivePreviewId,
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
              `/` 聚焦搜索，`Shift+A` 切换全选，`Esc` 清空选择，`N` 打开主操作，`E` 打开交接导出。
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
            <Button
              disabled={exportableItems.length === 0}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => setExportOpen(true)}
            >
              Export handoff
            </Button>
          </div>
        </div>

        {previewedItem?.preview ? (
          <div className="grid gap-4 rounded-[var(--radius-xl)] border border-border/70 bg-background/72 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid gap-3">
              <div className="grid gap-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {previewedItem.preview.eyebrow ?? 'Quick preview'}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    {previewedItem.preview.title}
                  </h3>
                  {selectedIds.includes(previewedItem.id) ? (
                    <Badge variant="accent">selected</Badge>
                  ) : null}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {previewedItem.preview.description ?? previewedItem.label}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(previewedItem.preview.facts ?? []).map((fact) => (
                  <div
                    className="rounded-[var(--radius-lg)] border border-border/70 bg-card/85 px-4 py-3"
                    key={`${previewedItem.id}-${fact.label}`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {fact.label}
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">{fact.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border/70 bg-card/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Handoff guardrails
              </p>
              <div className="grid gap-2 text-sm leading-6 text-muted-foreground">
                <p>只导出当前可见且已选中的行，避免误把整页数据发送给外部协作者。</p>
                <p>未显式选择时，导出会退回到当前 preview 项，而不是整页全量数据。</p>
                <p>Preview 按钮只切换本地上下文，不触发任何后端写操作。</p>
              </div>
            </div>
          </div>
        ) : null}

        {children}

        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Export operator handoff</DialogTitle>
              <DialogDescription>
                导出当前选中集的交接摘要与结构化 JSON；未选择任何行时，会导出当前 preview 项。
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">Markdown handoff</p>
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(markdownPayload)
                      setCopied(true)
                    }}
                  >
                    Copy markdown
                  </Button>
                </div>
                <textarea
                  className="min-h-72 w-full rounded-[var(--radius-lg)] border border-border/70 bg-card/85 px-4 py-3 font-mono text-xs leading-6 text-foreground outline-none"
                  readOnly
                  value={markdownPayload}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">JSON payload</p>
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(jsonPayload)
                      setCopied(true)
                    }}
                  >
                    Copy JSON
                  </Button>
                </div>
                <textarea
                  className="min-h-72 w-full rounded-[var(--radius-lg)] border border-border/70 bg-card/85 px-4 py-3 font-mono text-xs leading-6 text-foreground outline-none"
                  readOnly
                  value={jsonPayload}
                />
              </div>
            </div>

            <DialogFooter className="gap-3 sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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

interface OperatorPreviewButtonProps {
  itemId: string
  label: string
}

/**
 * 渲染行级 preview 触发器，用于把当前行提升为工作台右侧的预览上下文。
 */
export function OperatorPreviewButton({ itemId, label }: OperatorPreviewButtonProps): ReactNode {
  const { focusPreview, previewedId } = useOperatorWorkbenchContext()

  return (
    <Button
      aria-pressed={previewedId === itemId}
      size="sm"
      type="button"
      variant={previewedId === itemId ? 'default' : 'secondary'}
      onClick={() => focusPreview(itemId)}
    >
      {previewedId === itemId ? `${label} previewing` : label}
    </Button>
  )
}
