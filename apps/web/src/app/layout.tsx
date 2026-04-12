import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { AppProviders } from '@/components/providers/app-providers'
import { defaultLocale, getLocaleMessages } from '@/lib/i18n'

import '@copilotkit/react-ui/styles.css'
import './globals.css'

export const metadata: Metadata = {
  description: 'AI Native OS admin console shell built on the Next.js App Router baseline.',
  title: 'AI Native OS',
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps): ReactNode {
  return (
    <html lang={defaultLocale}>
      <body className="bg-background font-[var(--font-sans)] text-foreground antialiased">
        <AppProviders locale={defaultLocale} messages={getLocaleMessages(defaultLocale)}>
          {children}
        </AppProviders>
      </body>
    </html>
  )
}
