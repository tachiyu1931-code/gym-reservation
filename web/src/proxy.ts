import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const url = request.nextUrl;

  // /admin 配下のパスにBasic認証を適用
  if (url.pathname.startsWith('/admin')) {
    const authorizationHeader = request.headers.get('authorization');

    if (authorizationHeader) {
      try {
        // Basic [Base64(user:password)]
        const authValue = authorizationHeader.split(' ')[1];
        const decoded = atob(authValue);
        const [user, password] = decoded.split(':');

        const adminUser = process.env.ADMIN_USER || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'password123';

        if (user === adminUser && password === adminPassword) {
          return NextResponse.next();
        }
      } catch (err) {
        console.error('Basic auth parsing error:', err);
      }
    }

    // 認証情報がない、または間違っている場合はダイアログを表示させる
    return new NextResponse('Auth Required.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Gym Reserve Secure Admin Area"',
      },
    });
  }

  return NextResponse.next();
}

// 適用するパスのパターン
export const config = {
  matcher: ['/admin/:path*'],
};
