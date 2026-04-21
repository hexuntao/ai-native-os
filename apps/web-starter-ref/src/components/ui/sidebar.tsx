'use client'

import { Button, cn } from '@ai-native-os/ui'
import type { Route } from 'next'
import Link from 'next/link'
import {
  type ButtonHTMLAttributes,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'

const desktopMediaQuery = '(min-width: 1024px)'

interface SidebarContextValue {
  open: boolean
  setOpen: (open: boolean) => void
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

export function useSidebar(): SidebarContextValue {
  return useSidebarContext()
}

interface SidebarProviderProps {
  children: ReactNode
  defaultOpen?: boolean
}

export function SidebarProvider({ children, defaultOpen = true }: SidebarProviderProps): ReactNode {
  const [isDesktop, setIsDesktop] = useState(false)
  const [open, setOpen] = useState(defaultOpen)
  const [openMobile, setOpenMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(desktopMediaQuery)
    const sync = (event: MediaQueryList | MediaQueryListEvent): void => {
      setIsDesktop(event.matches)
    }

    sync(mediaQuery)
    mediaQuery.addEventListener('change', sync)

    return () => {
      mediaQuery.removeEventListener('change', sync)
    }
  }, [])

  const toggleSidebar = (): void => {
    if (isDesktop) {
      setOpen((currentState) => !currentState)

      return
    }

    setOpenMobile((currentState) => !currentState)
  }

  const contextValue: SidebarContextValue = {
    open,
    setOpen,
    toggleSidebar,
  }

  return (
    <SidebarContext.Provider value={contextValue}>
      <div className="flex min-h-screen w-full bg-muted/35">{children}</div>
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
        </div>
      ) : null}
    </SidebarContext.Provider>
  )
}

interface SidebarProps {
  children: ReactNode
}

export function Sidebar({ children }: SidebarProps): ReactNode {
  const { open } = useSidebarContext()

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          'hidden shrink-0 transition-[width] duration-200 lg:block',
          open ? 'w-64' : 'w-16',
        )}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex lg:flex-col',
          open ? 'w-64' : 'w-16',
        )}
      >
        {children}
      </aside>
    </>
  )
}

interface SidebarInsetProps {
  children: ReactNode
}

export function SidebarInset({ children }: SidebarInsetProps): ReactNode {
  return <main className="relative flex min-h-screen min-w-0 flex-1 flex-col">{children}</main>
}

interface SidebarSectionProps {
  children: ReactNode
  className?: string
}

export function SidebarHeader({ children, className }: SidebarSectionProps): ReactNode {
  return <div className={cn('flex flex-col', className)}>{children}</div>
}

export function SidebarContent({ children, className }: SidebarSectionProps): ReactNode {
  return <div className={cn('flex-1 overflow-x-hidden overflow-y-auto', className)}>{children}</div>
}

export function SidebarFooter({ children, className }: SidebarSectionProps): ReactNode {
  return <div className={cn('flex flex-col', className)}>{children}</div>
}

export function SidebarGroup({ children, className }: SidebarSectionProps): ReactNode {
  return <section className={cn('grid gap-2 py-0', className)}>{children}</section>
}

export function SidebarGroupLabel({ children }: { children: ReactNode }): ReactNode {
  const { open } = useSidebarContext()

  if (!open) {
    return <div className="mx-auto h-px w-8 bg-sidebar-border" />
  }

  return (
    <p className="px-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{children}</p>
  )
}

export function SidebarMenu({ children }: { children: ReactNode }): ReactNode {
  return <ul className="grid gap-1">{children}</ul>
}

export function SidebarMenuItem({ children }: { children: ReactNode }): ReactNode {
  return <li>{children}</li>
}

interface SidebarMenuButtonProps {
  asChild?: boolean
  children: ReactNode
  className?: string
  isActive?: boolean
  tooltip?: string
}

export function SidebarMenuButton({
  asChild = false,
  children,
  className,
  isActive = false,
  tooltip,
}: SidebarMenuButtonProps): ReactNode {
  const { open } = useSidebarContext()
  const classes = cn(
    'flex items-center rounded-xl border border-transparent text-sm font-medium transition-colors',
    open ? 'gap-3 px-2.5 py-2' : 'justify-center px-0 py-2.5',
    isActive
      ? 'border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-muted-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground',
    className,
  )

  if (asChild) {
    return (
      <span className={classes} title={tooltip}>
        {children}
      </span>
    )
  }

  return (
    <button className={classes} title={tooltip} type="button">
      {children}
    </button>
  )
}

interface SidebarLinkButtonProps {
  className?: string
  children: ReactNode
  href: string
  title?: string
}

export function SidebarLinkButton({ children, href, ...props }: SidebarLinkButtonProps): ReactNode {
  return (
    <Link href={href as Route} {...props}>
      {children}
    </Link>
  )
}

export function SidebarRail(): ReactNode {
  const { open, toggleSidebar } = useSidebarContext()

  return (
    <button
      aria-label="Toggle Sidebar"
      className="absolute top-1/2 -right-2.5 hidden h-14 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-xs text-muted-foreground shadow-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex"
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      type="button"
    >
      {open ? '‹' : '›'}
    </button>
  )
}

export function SidebarTrigger(
  props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>,
): ReactNode {
  const { toggleSidebar } = useSidebarContext()

  return (
    <Button
      {...props}
      className={cn('h-9 w-9 rounded-xl px-0', props.className)}
      onClick={(event) => {
        props.onClick?.(event)
        toggleSidebar()
      }}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span className="sr-only">Toggle Sidebar</span>
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
