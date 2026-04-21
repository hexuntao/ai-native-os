import { cookies } from 'next/headers';
import {
  fetchAiAuditLogsList,
  fetchAiEvalsList,
  fetchAiGovernanceOverview,
  fetchServerSummary,
  type AiAuditFilterState,
  type DashboardListFilters
} from '@/lib/ai-management';
import { resolveWebEnvironment } from '@/lib/env';

async function readCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.toString() || undefined;
}

export async function loadServerSummary() {
  return fetchServerSummary(await readCookieHeader(), resolveWebEnvironment());
}

export async function loadAiEvalsList(filters: DashboardListFilters) {
  return fetchAiEvalsList(await readCookieHeader(), resolveWebEnvironment(), filters);
}

export async function loadAiAuditLogsList(filters: AiAuditFilterState) {
  return fetchAiAuditLogsList(await readCookieHeader(), resolveWebEnvironment(), filters);
}

export async function loadAiGovernanceOverview(filters: DashboardListFilters) {
  return fetchAiGovernanceOverview(await readCookieHeader(), resolveWebEnvironment(), filters);
}
