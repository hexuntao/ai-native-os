import type { ShellState } from './api'

function renderNavigationCards(state: Extract<ShellState, { kind: 'authenticated' }>): string {
  return state.visibleNavigation
    .map(
      (item) => `
        <article class="nav-card">
          <p class="nav-kicker">${item.action} · ${item.subject}</p>
          <h3>${item.label}</h3>
          <p>${item.description}</p>
          <span>${item.href}</span>
        </article>`,
    )
    .join('')
}

function renderRoleChips(roleCodes: string[]): string {
  return roleCodes.map((roleCode) => `<li>${roleCode}</li>`).join('')
}

export function renderIndexPage(state: ShellState): string {
  const body =
    state.kind === 'authenticated'
      ? `
        <section class="hero">
          <div>
            <p class="eyebrow">Authenticated Shell</p>
            <h1>AI Native OS control surface</h1>
            <p class="lede">The shell is now reading session and ability data from the API, then filtering visible surfaces on the server before the page is rendered.</p>
          </div>
          <form method="POST" action="/logout">
            <button type="submit" class="secondary-button">Sign out</button>
          </form>
        </section>

        <section class="metrics">
          <article class="metric-card">
            <p class="metric-label">Operator</p>
            <strong>${state.session.user.name}</strong>
            <span>${state.session.user.email}</span>
          </article>
          <article class="metric-card">
            <p class="metric-label">Roles</p>
            <ul class="role-list">${renderRoleChips(state.roleCodes)}</ul>
          </article>
          <article class="metric-card">
            <p class="metric-label">Permission Rules</p>
            <strong>${state.permissionRuleCount}</strong>
            <span>${state.hiddenNavigationCount} surfaces hidden by ability checks</span>
          </article>
        </section>

        <section class="grid">
          ${renderNavigationCards(state)}
        </section>`
      : `
        <section class="hero hero-unauthenticated">
          <div>
            <p class="eyebrow">Minimal Auth Shell</p>
            <h1>Sign in to materialize your control surface.</h1>
            <p class="lede">The web shell proxies Better Auth on submit, then pulls serialized ability rules to decide which modules should appear.</p>
          </div>
          <aside class="hint-panel">
            <p>Ready accounts after seed + signup:</p>
            <ul>
              <li><code>viewer</code> sees audit and role surfaces</li>
              <li><code>admin</code> gains system management without permission editing</li>
              <li><code>super_admin</code> receives full access</li>
            </ul>
          </aside>
        </section>

        <section class="auth-panel">
          <form method="POST" action="/login" class="auth-form">
            <label>
              <span>Email</span>
              <input name="email" type="email" autocomplete="email" required />
            </label>
            <label>
              <span>Password</span>
              <input name="password" type="password" autocomplete="current-password" required />
            </label>
            ${
              state.errorMessage
                ? `<p class="error-banner">${state.errorMessage}</p>`
                : '<p class="muted-copy">Use any Better Auth account that maps by email to an RBAC user.</p>'
            }
            <button type="submit">Sign in</button>
          </form>
        </section>`

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Native OS</title>
    <style>
      :root {
        --bg: #f3ede3;
        --panel: rgba(255, 250, 240, 0.85);
        --panel-strong: #fff8ee;
        --line: rgba(40, 30, 16, 0.12);
        --text: #23180f;
        --muted: #6f5b49;
        --accent: #b84d19;
        --accent-soft: #f7cfae;
        --shadow: 0 20px 45px rgba(68, 39, 18, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Georgia", "Times New Roman", serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(184, 77, 25, 0.22), transparent 30%),
          radial-gradient(circle at top right, rgba(35, 24, 15, 0.08), transparent 26%),
          linear-gradient(135deg, #f7f0e4 0%, #efe2cf 48%, #e6d5be 100%);
      }
      main {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
        padding: 32px 0 64px;
      }
      .hero, .auth-panel, .metric-card, .nav-card, .hint-panel {
        backdrop-filter: blur(12px);
        background: var(--panel);
        border: 1px solid var(--line);
        box-shadow: var(--shadow);
      }
      .hero {
        display: grid;
        gap: 24px;
        grid-template-columns: 1.8fr 0.8fr;
        border-radius: 28px;
        padding: 28px;
        margin-bottom: 24px;
      }
      .hero-unauthenticated {
        grid-template-columns: 1.35fr 0.95fr;
      }
      .eyebrow, .nav-kicker, .metric-label {
        margin: 0 0 10px;
        font-size: 12px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--muted);
      }
      h1 {
        margin: 0;
        font-size: clamp(42px, 7vw, 78px);
        line-height: 0.94;
      }
      .lede {
        max-width: 62ch;
        font-size: 18px;
        line-height: 1.6;
        color: var(--muted);
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
        margin-bottom: 24px;
      }
      .metric-card, .nav-card, .hint-panel, .auth-panel {
        border-radius: 22px;
        padding: 22px;
      }
      .metric-card strong {
        display: block;
        font-size: 28px;
        margin-bottom: 8px;
      }
      .metric-card span, .nav-card p, .hint-panel p, .hint-panel li, .muted-copy {
        color: var(--muted);
        line-height: 1.6;
      }
      .role-list, .hint-panel ul {
        margin: 12px 0 0;
        padding-left: 18px;
      }
      .grid {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .nav-card h3 {
        margin: 0 0 10px;
        font-size: 24px;
      }
      .nav-card span {
        display: inline-flex;
        margin-top: 18px;
        padding-top: 12px;
        border-top: 1px solid var(--line);
        color: var(--accent);
        font-size: 14px;
      }
      .auth-form {
        display: grid;
        gap: 18px;
      }
      .auth-form label {
        display: grid;
        gap: 8px;
      }
      .auth-form span {
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }
      input {
        width: 100%;
        border: 1px solid rgba(35, 24, 15, 0.15);
        border-radius: 14px;
        padding: 14px 16px;
        font: inherit;
        background: rgba(255, 255, 255, 0.72);
      }
      button {
        border: none;
        border-radius: 999px;
        padding: 14px 20px;
        font: inherit;
        cursor: pointer;
        background: var(--accent);
        color: white;
      }
      .secondary-button {
        align-self: start;
        background: rgba(35, 24, 15, 0.08);
        color: var(--text);
      }
      .error-banner {
        margin: 0;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(184, 77, 25, 0.12);
        color: var(--accent);
      }
      code {
        padding: 2px 6px;
        border-radius: 999px;
        background: var(--panel-strong);
      }
      @media (max-width: 840px) {
        .hero, .hero-unauthenticated, .metrics {
          grid-template-columns: 1fr;
        }
        h1 {
          font-size: 42px;
        }
      }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`
}
