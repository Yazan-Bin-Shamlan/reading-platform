import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { levels } from "@/lib/assist/filter";
import { db } from "@/lib/db";

const schema = z.object({
  enabled: z.boolean().optional(),
  level: z.enum(levels).optional(),
  density: z.number().int().min(0).max(100).optional(),
  explainLang: z.enum(["ar", "en", "both"]).optional(),
});

/** The reader's Smart Assist settings, kept on their profile. */
export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { enabled, level, density, explainLang } = parsed.data;
  await db.profile.update({
    where: { id: user.id },
    data: { assistEnabled: enabled, englishLevel: level, assistDensity: density, explainLang },
  });
  return NextResponse.json({ ok: true });
}
