import createMiddleware from 'next-intl/middleware';
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { routing } from '@/lib/i18n/routing';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. Run Supabase auth middleware to refresh tokens if necessary
  const { response } = await updateSession(request);

  // 2. Run i18n middleware
  const intlResponse = intlMiddleware(request);

  // We need to merge the headers from Supabase response into the i18n response
  // so that cookies set by Supabase are preserved.
  response.headers.forEach((value, key) => {
    // Exclude specific headers that shouldn't be overridden naively, 
    // but definitely copy 'set-cookie'
    if (key.toLowerCase() === 'set-cookie') {
      // It's safer to append cookies to avoid overwriting intl cookies (like NEXT_LOCALE)
      intlResponse.headers.append(key, value);
    }
  });

  return intlResponse;
}

export const config = {
  // Skip all paths that should not be internationalized
  matcher: ['/((?!api|_next|_vercel|auth|.*\\..*).*)']
};
