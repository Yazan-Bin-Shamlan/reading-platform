import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { refreshSession } from "@/lib/supabase/proxy";

const intl = createIntlMiddleware(routing);

// Pages that need an account. Explore and Home stay public.
const PROTECTED = /^\/(?:ar|en)\/(?:library|words|settings|read)(?:\/|$)/;

export async function proxy(request: NextRequest) {
  const session = await refreshSession(request);
  const { pathname, search } = request.nextUrl;

  if (session.configured && !session.userId && PROTECTED.test(pathname)) {
    const locale = pathname.split("/")[1];
    const url = new URL(`/${locale}/sign-in`, request.url);
    url.searchParams.set("next", pathname + search);
    return session.apply(NextResponse.redirect(url));
  }

  return session.apply(intl(request));
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
