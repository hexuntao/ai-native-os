import {
  type AiAuditListResponse,
  type AiEvalListResponse,
  type AiGovernanceOverview,
  aiAuditListResponseSchema,
  aiEvalListResponseSchema,
  aiGovernanceOverviewSchema,
  type ServerSummary,
  serverSummarySchema
} from '@ai-native-os/shared';
import type { WebEnvironment } from '@/lib/env';

export interface DashboardListFilters {
  page: number;
  pageSize: number;
  search: string | undefined;
}

export interface AiAuditFilterState extends DashboardListFilters {
  status: 'all' | 'error' | 'forbidden' | 'success';
  toolId: string | undefined;
}

function createJsonRequestInit(
  cookieHeader: string | undefined,
  environment: WebEnvironment
): RequestInit {
  const headers = new Headers({
    accept: 'application/json',
    origin: environment.appUrl
  });

  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }

  return {
    cache: 'no-store',
    headers
  };
}

function createQueryString(query: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  return searchParams.toString();
}

async function fetchEnvelope<T>(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  path: string,
  query: Record<string, string | undefined>,
  parse: (payload: unknown) => T
): Promise<T> {
  const queryString = createQueryString(query);
  const requestUrl = `${environment.apiUrl}${path}${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(requestUrl, createJsonRequestInit(cookieHeader, environment));

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }

  const envelope = (await response.json()) as {
    json: unknown;
  };

  return parse(envelope.json);
}

export async function fetchServerSummary(
  cookieHeader: string | undefined,
  environment: WebEnvironment
): Promise<ServerSummary> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/monitor/server',
    {},
    serverSummarySchema.parse
  );
}

export async function fetchAiEvalsList(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  filters: DashboardListFilters
): Promise<AiEvalListResponse> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/ai/evals',
    {
      page: String(filters.page),
      pageSize: String(filters.pageSize)
    },
    aiEvalListResponseSchema.parse
  );
}

export async function fetchAiAuditLogsList(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  filters: AiAuditFilterState
): Promise<AiAuditListResponse> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/ai/audit',
    {
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      status: filters.status === 'all' ? undefined : filters.status,
      toolId: filters.toolId
    },
    aiAuditListResponseSchema.parse
  );
}

export async function fetchAiGovernanceOverview(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
  filters: DashboardListFilters
): Promise<AiGovernanceOverview> {
  return fetchEnvelope(
    cookieHeader,
    environment,
    '/api/v1/ai/governance/overview',
    {
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      search: filters.search
    },
    aiGovernanceOverviewSchema.parse
  );
}
