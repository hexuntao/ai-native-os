import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { loadCurrentShellState } from '@/lib/server-shell';
import { resolveDashboardLandingHref } from '@/lib/shell';

export default async function Dashboard(): Promise<never> {
  const shellState = await loadCurrentShellState();

  if (shellState.kind !== 'authenticated') {
    redirect('/' as Route);
  }

  redirect(resolveDashboardLandingHref(shellState) as Route);
}
