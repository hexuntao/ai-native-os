import type { ReactNode } from 'react'

interface SignInPageProps {
  errorMessage?: string
}

export function SignInPage({ errorMessage }: SignInPageProps): ReactNode {
  return (
    <main className="app-shell">
      <section className="hero-panel panel">
        <div>
          <p className="eyebrow">Next.js App Shell</p>
          <h1 className="hero-title">Sign in to materialize your control surface.</h1>
          <p className="hero-copy">
            Phase 4 now runs on the Next.js App Router baseline. Authentication remains delegated to
            Better Auth, while server-rendered ability filtering still decides which modules should
            appear.
          </p>
        </div>
        <aside className="hint-panel panel">
          <p className="section-kicker">Seeded Role Expectations</p>
          <ul className="hint-list">
            <li>
              <span className="code-pill">viewer</span> sees audit and role surfaces
            </li>
            <li>
              <span className="code-pill">admin</span> gains broader system management
            </li>
            <li>
              <span className="code-pill">super_admin</span> receives full access
            </li>
          </ul>
        </aside>
      </section>

      <section className="auth-grid">
        <article className="auth-card panel">
          <p className="section-kicker">Sign In</p>
          <form action="/auth/sign-in" className="auth-form" method="POST">
            <label className="field">
              <span className="field-label">Email</span>
              <input
                autoComplete="email"
                className="text-input"
                name="email"
                required
                type="email"
              />
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <input
                autoComplete="current-password"
                className="text-input"
                name="password"
                required
                type="password"
              />
            </label>
            {errorMessage ? (
              <p className="error-banner">{errorMessage}</p>
            ) : (
              <p className="muted-copy">
                Use any Better Auth account whose email maps to an RBAC user.
              </p>
            )}
            <button className="primary-button" type="submit">
              Sign in
            </button>
          </form>
        </article>

        <article className="card panel">
          <p className="section-kicker">Phase 4 Scope</p>
          <div className="stack">
            <p className="panel-copy">
              This task only establishes the web shell, providers, and authenticated layout. CRUD
              pages, Copilot UI, and generative interactions remain separate tasks.
            </p>
            <p className="panel-copy">
              Navigation targets are already routable so smoke tests can verify the shell boots and
              moves between pages without 404 gaps.
            </p>
          </div>
        </article>
      </section>
    </main>
  )
}
