import { redirect } from 'next/navigation';

export default async function DashboardHomePage() {
  redirect('/dashboard/overview');
}
