import type { ReactNode } from 'react'

import AppSidebar from '@/components/layout/app-sidebar'
import Header from '@/components/layout/header'
import { InfoSidebar } from '@/components/layout/info-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps): ReactNode {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <Header />
        {children}
      </SidebarInset>
      <InfoSidebar />
    </SidebarProvider>
  )
}
