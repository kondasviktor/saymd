/**
 * Pre-launch gate. Set SAYMD_PUBLIC=1 on Vercel when ready to go live.
 * Until then, visit /?preview=YOUR_SAYMD_PREVIEW_TOKEN once to unlock (7-day cookie).
 * Stripe webhook is always allowed through.
 */
export default function middleware(request) {
  if (process.env.SAYMD_PUBLIC === '1') {
    return;
  }

  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname.startsWith('/api/stripe-webhook-saymd')) {
    return;
  }

  if (pathname === '/coming-soon.html' || pathname === '/robots.txt') {
    return;
  }

  const token = process.env.SAYMD_PREVIEW_TOKEN;
  if (!token) {
    return Response.redirect(new URL('/coming-soon.html', request.url), 307);
  }

  const queryToken = url.searchParams.get('preview');
  const cookie = request.headers.get('cookie') || '';
  const hasCookie = cookie.includes(`saymd_preview=${token}`);

  if (queryToken === token) {
    const clean = new URL(request.url);
    clean.searchParams.delete('preview');
    return new Response(null, {
      status: 307,
      headers: {
        Location: clean.toString(),
        'Set-Cookie': `saymd_preview=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
      },
    });
  }

  if (hasCookie) {
    return;
  }

  return Response.redirect(new URL('/coming-soon.html', request.url), 307);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
