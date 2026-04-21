export const designTokens = {
  color: {
    accent: 'var(--accent)',
    accentForeground: 'var(--accent-foreground)',
    background: 'var(--background)',
    border: 'var(--border)',
    card: 'var(--card)',
    destructive: 'var(--destructive)',
    destructiveForeground: 'var(--destructive-foreground)',
    foreground: 'var(--foreground)',
    muted: 'var(--muted)',
    mutedForeground: 'var(--muted-foreground)',
    primary: 'var(--primary)',
    primaryForeground: 'var(--primary-foreground)',
    secondary: 'var(--secondary)',
    secondaryForeground: 'var(--secondary-foreground)',
    sidebar: 'var(--sidebar)',
    sidebarAccent: 'var(--sidebar-accent)',
    sidebarAccentForeground: 'var(--sidebar-accent-foreground)',
    sidebarBorder: 'var(--sidebar-border)',
    sidebarForeground: 'var(--sidebar-foreground)',
    sidebarPrimary: 'var(--sidebar-primary)',
    sidebarPrimaryForeground: 'var(--sidebar-primary-foreground)',
    sidebarRing: 'var(--sidebar-ring)',
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
