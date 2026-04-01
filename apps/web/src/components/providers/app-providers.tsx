'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'

import { type LocaleMessages, LocaleProvider } from './locale-provider'

interface AppProvidersProps {
  children: ReactNode
  locale: string
  messages: LocaleMessages
}

export function AppProviders({ children, locale, messages }: AppProvidersProps): ReactNode {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 5 * 60 * 1000,
            staleTime: 30 * 1000,
          },
        },
      }),
  )

  return (
    <LocaleProvider locale={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </LocaleProvider>
  )
}
