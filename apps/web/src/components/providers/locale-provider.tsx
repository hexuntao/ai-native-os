'use client'

import { createContext, type ReactNode, useContext } from 'react'

export type LocaleMessages = Record<string, string>

interface LocaleContextValue {
  locale: string
  messages: LocaleMessages
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

interface LocaleProviderProps {
  children: ReactNode
  locale: string
  messages: LocaleMessages
}

export function LocaleProvider({ children, locale, messages }: LocaleProviderProps): ReactNode {
  return (
    <LocaleContext.Provider
      value={{
        locale,
        messages,
      }}
    >
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocaleContext(): LocaleContextValue {
  const context = useContext(LocaleContext)

  if (!context) {
    throw new Error('LocaleProvider is required before calling useLocaleContext')
  }

  return context
}
