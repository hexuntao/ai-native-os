'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import type { AuthenticatedShellState } from '@/lib/api'
import { isNavigationItemActive } from '@/lib/shell'

interface DashboardShellProps {
  children: ReactNode
  shellState: AuthenticatedShellState
}

export function DashboardShell({ children, shellState }: DashboardShellProps): ReactNode {
  const pathname = usePathname()

  return (
    <main className="app-shell">
      <section className="metric-grid">
        <article className="metric-card panel">
          <p className="metric-label">Operator</p>
          <strong>{shellState.session.user.name}</strong>
          <span className="muted-copy">{shellState.session.user.email}</span>
        </article>
        <article className="metric-card panel">
          <p className="metric-label">Roles</p>
          <ul className="role-list">
            {shellState.roleCodes.map((roleCode) => (
              <li key={roleCode}>{roleCode}</li>
            ))}
          </ul>
        </article>
        <article className="metric-card panel">
          <p className="metric-label">Permission Rules</p>
          <strong>{shellState.permissionRuleCount}</strong>
          <span className="muted-copy">
            {shellState.hiddenNavigationCount} surfaces hidden by ability checks
          </span>
        </article>
      </section>

      <section className="dashboard-grid">
        <aside className="sidebar panel">
          <div className="sidebar-header">
            <p className="section-kicker">Authenticated Dashboard</p>
            <h1 className="sidebar-title">AI Native OS</h1>
            <p className="muted-copy">
              App Router shell with server-rendered permission filtering and client-side provider
              baseline.
            </p>
          </div>

          <nav aria-label="Primary navigation">
            <ul className="nav-list">
              {shellState.visibleNavigation.map((item) => (
                <li key={item.href}>
                  <Link
                    className="nav-link"
                    data-active={String(isNavigationItemActive(item.href, pathname))}
                    href={item.href}
                  >
                    <span className="nav-link-label">{item.label}</span>
                    <span className="nav-link-hint">{item.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <form action="/auth/sign-out" method="POST" style={{ marginTop: 18 }}>
            <button className="secondary-button" type="submit">
              Sign out
            </button>
          </form>
        </aside>

        <section className="content-panel panel">{children}</section>
      </section>
    </main>
  )
}
