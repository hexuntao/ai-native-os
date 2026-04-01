export const defaultLocale = 'zh-CN'

const localeMessages = {
  'zh-CN': {
    'dashboard.title': 'AI Native OS',
    'signin.title': 'Sign in to materialize your control surface.',
  },
} as const

export type SupportedLocale = keyof typeof localeMessages

export function getLocaleMessages(locale: SupportedLocale): Record<string, string> {
  return localeMessages[locale]
}
