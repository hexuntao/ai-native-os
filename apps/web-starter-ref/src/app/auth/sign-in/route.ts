import { NextResponse } from 'next/server';
import { resolveWebEnvironment } from '@/lib/env';
import { appendSetCookieHeaders, performSignIn } from '@/lib/proxy-auth';

const loginRedirectPath = '/dashboard/overview';

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const email = formData.get('email');
  const password = formData.get('password');
  const environment = resolveWebEnvironment();

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return NextResponse.redirect(new URL('/?error=missing_credentials', request.url), 303);
  }

  const upstreamResponse = await performSignIn({
    email,
    environment,
    password
  });

  if (!upstreamResponse.ok) {
    return NextResponse.redirect(new URL('/?error=invalid_credentials', request.url), 303);
  }

  const response = NextResponse.redirect(new URL(loginRedirectPath, request.url), 303);
  appendSetCookieHeaders(response, upstreamResponse.headers);

  return response;
}
