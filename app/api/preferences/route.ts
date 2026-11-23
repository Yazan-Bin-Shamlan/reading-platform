import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { readerPrefsSchema } from "@/lib/reader/prefs";

const patchSchema = z.object({ reader: readerPrefsSchema.partial() });

/** Merges reader preferences into the profile, so they follow the person across devices. */
export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const profile = await db.profile.findUnique({ where: { id: user.id }, select: { preferences: true } });
  const current = (profile?.preferences ?? {}) as Record<string, unknown>;
  const reader = { ...((current.reader as object | undefined) ?? {}), ...parsed.data.reader };
  await db.profile.update({
    where: { id: user.id },
    data: { preferences: { ...current, reader } as Prisma.InputJsonObject },
  });
  return NextResponse.json({ ok: true });
}
