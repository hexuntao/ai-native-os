export const designTokens = {
  color: {
    accent: 'var(--primary)',
    accentForeground: 'var(--primary-foreground)',
    background: 'var(--background)',
    border: 'var(--border)',
    card: 'var(--card)',
    foreground: 'var(--foreground)',
    muted: 'var(--muted-foreground)',
  },
  radius: {
    lg: 'var(--radius-lg)',
    md: 'var(--radius-md)',
    sm: 'var(--radius-sm)',
    xl: 'var(--radius-xl)',
  },
  shadow: {
    panel: 'var(--shadow-panel)',
    soft: 'var(--shadow-soft)',
  },
} as const

export type DesignTokens = typeof designTokens
