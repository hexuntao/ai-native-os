import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { InfoSidebar } from '@/components/layout/info-sidebar';
import { ShellProvider } from '@/components/layout/shell-provider';
import { InfobarProvider } from '@/components/ui/infobar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loadCurrentShellState } from '@/lib/server-shell';
import { groupNavigationItems } from '@/lib/shell';

export const metadata: Metadata = {
  title: 'AI Native OS Control Plane',
  description: 'Starter-based AI-native operator workspace',
  robots: {
    index: false,
    follow: false
  }
};

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}): Promise<React.ReactNode> {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';
  const shellState = await loadCurrentShellState();

  if (shellState.kind !== 'authenticated') {
    redirect('/');
  }

  const groupedNavigation = groupNavigationItems(shellState.visibleNavigation);

  return (
    <ShellProvider groupedNavigation={groupedNavigation} shellState={shellState}>
      <KBar>
        <SidebarProvider defaultOpen={defaultOpen}>
          <InfobarProvider defaultOpen={false}>
            <AppSidebar />
            <SidebarInset>
              <Header />
              {children}
            </SidebarInset>
            <InfoSidebar side='right' />
          </InfobarProvider>
        </SidebarProvider>
      </KBar>
    </ShellProvider>
  );
}
