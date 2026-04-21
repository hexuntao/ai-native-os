import { cookies } from 'next/headers';
import { loadShellState, type ShellState } from '@/lib/api';
import { resolveWebEnvironment } from '@/lib/env';

export async function loadCurrentShellState(errorMessage?: string): Promise<ShellState> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString() || undefined;

  return loadShellState(cookieHeader, resolveWebEnvironment(), errorMessage);
}
