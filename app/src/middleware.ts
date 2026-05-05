import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('lm_auth_token')?.value;

  const isAuthRoute = request.nextUrl.pathname.startsWith('/api/auth') || request.nextUrl.pathname.startsWith('/login');
  
  if (!token && !isAuthRoute) {
    // Exclude static files, images, etc.
    if (request.nextUrl.pathname.match(/\.(png|jpeg|jpg|webp|svg|ico)$/)) {
       return NextResponse.next();
    }
    // Block API calls if not auth route
    if (request.nextUrl.pathname.startsWith('/api/')) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Redirect UI to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If going to login but already has token
  if (token && request.nextUrl.pathname === '/login') {
     return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
