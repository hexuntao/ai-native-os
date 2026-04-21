'use client';

import * as React from 'react';
import type { AuthenticatedShellState } from '@/lib/api';
import type { NavigationGroup } from '@/lib/shell';
import type { ReactNode } from 'react';

interface ShellContextValue {
  groupedNavigation: NavigationGroup[];
  shellState: AuthenticatedShellState;
}

const ShellContext = React.createContext<ShellContextValue | null>(null);

export function ShellProvider({
  children,
  groupedNavigation,
  shellState
}: React.PropsWithChildren<ShellContextValue>): ReactNode {
  return (
    <ShellContext.Provider
      value={{
        groupedNavigation,
        shellState
      }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export function useShellContext(): ShellContextValue {
  const context = React.useContext(ShellContext);

  if (!context) {
    throw new Error('useShellContext must be used within ShellProvider.');
  }

  return context;
}
