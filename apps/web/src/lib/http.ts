import type { IncomingMessage, ServerResponse } from 'node:http'

import type { WebEnvironment } from './env'

function getBodyFromRequest(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    request.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    request.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    request.on('error', reject)
  })
}

export async function readFormBody(request: IncomingMessage): Promise<URLSearchParams> {
  return new URLSearchParams(await getBodyFromRequest(request))
}

export function sendHtml(response: ServerResponse, html: string, statusCode = 200): void {
  response.writeHead(statusCode, {
    'content-type': 'text/html; charset=UTF-8',
  })
  response.end(html)
}

export function sendRedirect(
  response: ServerResponse,
  location: string,
  setCookies: string[] = [],
): void {
  response.writeHead(302, {
    location,
    ...(setCookies.length > 0 ? { 'set-cookie': setCookies } : {}),
  })
  response.end()
}

export async function proxyAuthRequest(
  path: string,
  environment: WebEnvironment,
  payload: Record<string, string | boolean>,
): Promise<Response> {
  return fetch(`${environment.apiUrl}${path}`, {
    body: JSON.stringify(payload),
    headers: {
      'content-type': 'application/json',
      origin: environment.appUrl,
    },
    method: 'POST',
  })
}

export async function proxySignOut(
  cookieHeader: string | undefined,
  environment: WebEnvironment,
): Promise<Response> {
  const headers = new Headers({
    origin: environment.appUrl,
  })

  if (cookieHeader) {
    headers.set('cookie', cookieHeader)
  }

  return fetch(`${environment.apiUrl}/api/auth/sign-out`, {
    headers,
    method: 'POST',
  })
}
