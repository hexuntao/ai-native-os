export interface WebEnvironment {
  apiUrl: string;
  appUrl: string;
}

type EnvironmentVariables = Readonly<Record<string, string | undefined>>;

const defaultLocalAppUrl = 'http://localhost:3002';
const defaultLocalApiUrl = 'http://localhost:3001';

function normalizeDeploymentUrl(urlOrDomain: string): string {
  return urlOrDomain.startsWith('http://') || urlOrDomain.startsWith('https://')
    ? urlOrDomain
    : `https://${urlOrDomain}`;
}

function resolveVercelDeploymentUrl(
  environment: EnvironmentVariables = process.env
): string | undefined {
  if (environment.VERCEL !== '1') {
    return undefined;
  }

  const deploymentDomain = environment.VERCEL_URL?.trim();
  return deploymentDomain ? normalizeDeploymentUrl(deploymentDomain) : undefined;
}

export function resolveWebEnvironment(
  environment: EnvironmentVariables = process.env
): WebEnvironment {
  const deploymentUrl = resolveVercelDeploymentUrl(environment);

  return {
    apiUrl: environment.API_URL?.trim() || deploymentUrl || defaultLocalApiUrl,
    appUrl: environment.APP_URL?.trim() || deploymentUrl || defaultLocalAppUrl
  };
}
