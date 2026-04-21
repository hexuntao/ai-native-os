import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { Providers } from '@/components/layout/providers'

import './globals.css'

export const metadata: Metadata = {
  description: 'Starter-derived AI Native OS reference console.',
  title: 'AI Native OS Starter Ref',
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps): ReactNode {
  return (
    <html lang="en">
      <body className="bg-background font-[var(--font-sans)] text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
