import { notFound } from 'next/navigation'

interface MissingDashboardRoutePageProps {
  params: Promise<{
    segments: string[]
  }>
}

export default async function MissingDashboardRoutePage({
  params,
}: MissingDashboardRoutePageProps): Promise<never> {
  await params
  notFound()
}
