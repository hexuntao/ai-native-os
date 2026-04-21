import type { StarterRefNavItem } from '@/config/nav-config'

export function isItemActive(url: string, pathname: string): boolean {
  return pathname === url || pathname.startsWith(`${url}/`)
}

export function flattenNavItems(items: readonly StarterRefNavItem[]): readonly StarterRefNavItem[] {
  return items.flatMap((item) => {
    if (!item.items?.length) {
      return [item]
    }

    return [item, ...flattenNavItems(item.items)]
  })
}

export function resolveBreadcrumb(pathname: string): {
  moduleLabel: string
  pageLabel: string
} {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length <= 1) {
    return {
      moduleLabel: 'Dashboard',
      pageLabel: 'Home',
    }
  }

  const moduleLabel = segments[1] ?? 'dashboard'
  const pageLabel = segments.at(-1) ?? 'Home'

  return {
    moduleLabel: moduleLabel.slice(0, 1).toUpperCase() + moduleLabel.slice(1),
    pageLabel: pageLabel
      .split('-')
      .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
      .join(' '),
  }
}
