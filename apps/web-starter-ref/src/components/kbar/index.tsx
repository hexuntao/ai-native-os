'use client';
import { useShellContext } from '@/components/layout/shell-provider';
import { KBarAnimator, KBarPortal, KBarPositioner, KBarProvider, KBarSearch } from 'kbar';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import RenderResults from './render-result';
import useThemeSwitching from './use-theme-switching';

export default function KBar({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { groupedNavigation } = useShellContext();

  const actions = useMemo(() => {
    const navigateTo = (url: string): void => {
      router.push(url as Route);
    };

    const allItems = groupedNavigation.flatMap((group) => group.items);

    return allItems.flatMap((navItem) => {
      return [
        {
          id: `${navItem.label.toLowerCase()}Action`,
          name: navItem.label,
          shortcut: navItem.shortcut,
          keywords: `${navItem.label.toLowerCase()} ${navItem.description.toLowerCase()}`,
          section: 'Navigation',
          subtitle: `Go to ${navItem.label}`,
          perform: () => navigateTo(navItem.href)
        }
      ];
    });
  }, [groupedNavigation, router]);

  return (
    <KBarProvider actions={actions}>
      <KBarComponent>{children}</KBarComponent>
    </KBarProvider>
  );
}
const KBarComponent = ({ children }: { children: React.ReactNode }) => {
  useThemeSwitching();

  return (
    <>
      <KBarPortal>
        <KBarPositioner className='bg-background/80 fixed inset-0 z-99999 p-0! backdrop-blur-sm'>
          <KBarAnimator className='bg-card text-card-foreground relative mt-64! w-full max-w-[600px] -translate-y-12! overflow-hidden rounded-lg border shadow-lg'>
            <div className='bg-card border-border sticky top-0 z-10 border-b'>
              <KBarSearch className='bg-card w-full border-none px-6 py-4 text-lg outline-hidden focus:ring-0 focus:ring-offset-0 focus:outline-hidden' />
            </div>
            <div className='max-h-[400px]'>
              <RenderResults />
            </div>
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      {children}
    </>
  );
};
