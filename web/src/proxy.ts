import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function unauthorized() {
  return new NextResponse('Auth Required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Gym Reserve Secure Admin Area"',
    },
  });
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl;

  if (url.pathname.startsWith('/admin')) {
    const adminUser = process.env.ADMIN_USER;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUser || !adminPassword) {
      console.error('ADMIN_USER and ADMIN_PASSWORD must be configured.');
      return new NextResponse('Admin credentials are not configured.', { status: 500 });
    }

    const authorizationHeader = request.headers.get('authorization');
    if (authorizationHeader?.startsWith('Basic ')) {
      try {
        const authValue = authorizationHeader.split(' ')[1];
        const decoded = atob(authValue);
        const separatorIndex = decoded.indexOf(':');
        const user = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : '';
        const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : '';

        if (user === adminUser && password === adminPassword) {
          return NextResponse.next();
        }
      } catch (err) {
        console.error('Basic auth parsing error:', err);
      }
    }

    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
