import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { startUploadSchema } from "@/lib/library/schemas";
import { keys, storage } from "@/lib/storage";

/** Step 1 of an upload: hand the browser a one-time URL to PUT the PDF to. */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = startUploadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  // Only answers "do *you* already have this file?" — never reveals other people's files.
  const existing = await db.document.findFirst({
    where: { userId: user.id, contentId: parsed.data.sha256 },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ existingId: existing.id });

  const key = keys.incoming(user.id, randomUUID());
  const target = await storage().createUpload(key, parsed.data.contentType);
  return NextResponse.json({ key, target });
}
