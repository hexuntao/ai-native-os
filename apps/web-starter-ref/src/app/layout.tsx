import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import NextTopLoader from 'nextjs-toploader'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import Providers from '@/components/layout/providers'
import { fontVariables } from '@/components/themes/font.config'
import { DEFAULT_THEME, THEMES } from '@/components/themes/theme.config'
import ThemeProvider from '@/components/themes/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import '@copilotkit/react-ui/styles.css'
import '../styles/globals.css'

const META_THEME_COLORS = {
  light: '#ffffff',
  dark: '#09090b',
}

export const metadata: Metadata = {
  title: 'AI Native OS',
  description: '基于 next-shadcn-dashboard-starter 壳层重建的 AI-native 控制台。',
}

export const viewport: Viewport = {
  themeColor: META_THEME_COLORS.light,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const activeThemeValue = cookieStore.get('active_theme')?.value
  const isValidTheme = THEMES.some((t) => t.value === activeThemeValue)
  const themeToApply = isValidTheme && activeThemeValue ? activeThemeValue : DEFAULT_THEME

  return (
    <html lang="zh-CN" suppressHydrationWarning data-theme={themeToApply}>
      <head />
      <body
        className={cn(
          'bg-background overflow-x-hidden overscroll-none font-sans antialiased',
          fontVariables,
        )}
      >
        <NextTopLoader color="var(--primary)" showSpinner={false} />
        <NuqsAdapter>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            enableColorScheme
          >
            <Providers activeThemeValue={themeToApply}>
              <Toaster />
              {children}
            </Providers>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}
