'use client'

import { Button, type ButtonProps, cn } from '@ai-native-os/ui'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

const desktopMediaQuery = '(min-width: 1024px)'
const sidebarStorageKey = 'ai-native-os.sidebar-open'

interface SidebarContextValue {
  isDesktop: boolean
  open: boolean
  openMobile: boolean
  setOpen: (open: boolean) => void
  setOpenMobile: (open: boolean) => void
  toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

function useSidebarContext(): SidebarContextValue {
  const context = useContext(SidebarContext)

  if (!context) {
    throw new Error('Sidebar components must be used inside SidebarProvider.')
  }

  return context
}

interface SidebarProviderProps {
  children: ReactNode
  defaultOpen?: boolean
}

export function SidebarProvider({ children, defaultOpen = true }: SidebarProviderProps): ReactNode {
  const [isDesktop, setIsDesktop] = useState(false)
  const [open, setOpenState] = useState(defaultOpen)
  const [openMobile, setOpenMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(desktopMediaQuery)
    const syncDesktop = (event: MediaQueryList | MediaQueryListEvent): void => {
      setIsDesktop(event.matches)
    }

    syncDesktop(mediaQuery)
    mediaQuery.addEventListener('change', syncDesktop)

    return () => {
      mediaQuery.removeEventListener('change', syncDesktop)
    }
  }, [])

  useEffect(() => {
    const persistedState = window.localStorage.getItem(sidebarStorageKey)

    if (persistedState === 'true') {
      setOpenState(true)
    }

    if (persistedState === 'false') {
      setOpenState(false)
    }
  }, [])

  const setOpen = useCallback((nextOpen: boolean): void => {
    setOpenState(nextOpen)
    window.localStorage.setItem(sidebarStorageKey, String(nextOpen))
  }, [])

  const toggleSidebar = useCallback((): void => {
    if (isDesktop) {
      setOpen(!open)

      return
    }

    setOpenMobile(!openMobile)
  }, [isDesktop, open, openMobile, setOpen])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [toggleSidebar])

  const contextValue = useMemo<SidebarContextValue>(
    () => ({
      isDesktop,
      open,
      openMobile,
      setOpen,
      setOpenMobile,
      toggleSidebar,
    }),
    [isDesktop, open, openMobile, setOpen, toggleSidebar],
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <div className="flex min-h-screen w-full bg-muted/30">{children}</div>
    </SidebarContext.Provider>
  )
}

interface SidebarProps {
  children: ReactNode
  className?: string
}

export function Sidebar({ children, className }: SidebarProps): ReactNode {
  const { isDesktop, open, openMobile, setOpenMobile } = useSidebarContext()

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          'hidden shrink-0 transition-[width] duration-200 lg:block',
          open ? 'w-64' : 'w-[4.5rem]',
        )}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex lg:flex-col',
          open ? 'w-64' : 'w-[4.5rem]',
          className,
        )}
        data-state={open ? 'expanded' : 'collapsed'}
      >
        {children}
      </aside>

      {!isDesktop && openMobile ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            aria-label="Close sidebar overlay"
            className="flex-1 bg-foreground/20"
            onClick={() => {
              setOpenMobile(false)
            }}
            type="button"
          />
          <aside className="flex h-full w-72 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl">
            {children}
          </aside>
        </div>
      ) : null}
    </>
  )
}

interface SidebarInsetProps {
  children: ReactNode
  className?: string
}

export function SidebarInset({ children, className }: SidebarInsetProps): ReactNode {
  return (
    <main className={cn('flex min-h-screen min-w-0 flex-1 flex-col', className)}>{children}</main>
  )
}

interface SidebarSectionProps {
  children: ReactNode
  className?: string
}

export function SidebarHeader({ children, className }: SidebarSectionProps): ReactNode {
  return <div className={cn('flex flex-col', className)}>{children}</div>
}

export function SidebarContent({ children, className }: SidebarSectionProps): ReactNode {
  return <div className={cn('flex-1 overflow-y-auto overflow-x-hidden', className)}>{children}</div>
}

export function SidebarFooter({ children, className }: SidebarSectionProps): ReactNode {
  return <div className={cn('flex flex-col', className)}>{children}</div>
}

export function SidebarRail(): ReactNode {
  const { open, toggleSidebar } = useSidebarContext()

  return (
    <button
      aria-label="Toggle sidebar width"
      className="absolute top-1/2 -right-2.5 hidden h-14 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-xs text-muted-foreground shadow-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex"
      onClick={toggleSidebar}
      type="button"
    >
      {open ? '‹' : '›'}
    </button>
  )
}

export function SidebarTrigger({
  className,
  onClick,
  ...props
}: Omit<ButtonProps, 'children'>): ReactNode {
  const { toggleSidebar } = useSidebarContext()

  return (
    <Button
      {...props}
      className={cn('h-9 w-9 rounded-xl px-0', className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span className="sr-only">Toggle sidebar</span>
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 6.75C4 5.78 4.78 5 5.75 5h12.5C19.22 5 20 5.78 20 6.75v10.5c0 .97-.78 1.75-1.75 1.75H5.75A1.75 1.75 0 0 1 4 17.25V6.75Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M9 5v14" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </Button>
  )
}

export function useSidebar(): SidebarContextValue {
  return useSidebarContext()
}
