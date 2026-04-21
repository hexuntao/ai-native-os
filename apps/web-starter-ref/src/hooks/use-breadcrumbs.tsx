'use client';

import { navigationGroups, resolveNavigationItemForPath } from '@/config/nav-config';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

type BreadcrumbItem = {
  title: string;
  link: string;
};

export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const navigationItem = resolveNavigationItemForPath(pathname);

    if (navigationItem) {
      return [
        { title: 'Dashboard', link: '/dashboard/overview' },
        {
          title: navigationGroups[navigationItem.group].label,
          link: navigationItem.href
        },
        { title: navigationItem.label, link: navigationItem.href }
      ];
    }

    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      return {
        title: segment.charAt(0).toUpperCase() + segment.slice(1),
        link: path
      };
    });
  }, [pathname]);

  return breadcrumbs;
}
