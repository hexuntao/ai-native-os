import { redirect } from 'next/navigation';

export default async function DashboardHomePage(): Promise<never> {
  redirect('/dashboard/overview');
}
