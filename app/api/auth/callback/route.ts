import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

// Email links and Google sign-in both land here with a one-time ?code=.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"), "/");
  const code = searchParams.get("code");
  const supabase = await createClient();

  if (code && supabase) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await db.profile.upsert({
        where: { id: data.user.id },
        create: { id: data.user.id, displayName: data.user.user_metadata?.full_name ?? null },
        update: {},
      });
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  const locale = next.split("/")[1] === "en" ? "en" : "ar";
  return NextResponse.redirect(new URL(`/${locale}/sign-in?error=1`, origin));
}
