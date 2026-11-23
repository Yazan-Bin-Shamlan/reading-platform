import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { finalizeSchema } from "@/lib/library/schemas";
import { keys, storage } from "@/lib/storage";
import { extractLater, TEXT_VERSION } from "@/lib/text/extract";

// Text extraction starts right after the response (see extractLater).
export const maxDuration = 300;

const MAX_COVER_BYTES = 1024 * 1024;

/**
 * Step 2 of an upload: the file is in storage. Verify its hash on the server
 * (so nobody can claim someone else's content by hash), store it once per
 * sha256, save the cover, and add it to the user's library.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const parsed = finalizeSchema.safeParse(JSON.parse(String(form?.get("meta") ?? "null")));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const meta = parsed.data;
  if (!meta.uploadKey.startsWith(`incoming/${user.id}/`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const store = storage();
  const bytes = await store.read(meta.uploadKey).catch(() => null);
  if (!bytes) return NextResponse.json({ error: "missing-upload" }, { status: 400 });
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== meta.sha256) {
    await store.remove([meta.uploadKey]);
    return NextResponse.json({ error: "hash-mismatch" }, { status: 400 });
  }

  let content = await db.content.findUnique({ where: { id: sha256 } });
  if (content) {
    await store.remove([meta.uploadKey]); // already stored once
  } else {
    await store.move(meta.uploadKey, keys.content(sha256));
    content = await db.content.create({
      data: {
        id: sha256,
        format: "pdf",
        storageKey: keys.content(sha256),
        byteSize: bytes.byteLength,
        pageCount: meta.pageCount,
        language: meta.language,
        direction: meta.direction,
        textStatus: meta.textStatus,
        toc: meta.toc,
      },
    });
  }

  // Prepare Reading mode's text in the background, so it's ready when they open it.
  if (content.textVersion < TEXT_VERSION) extractLater(content.id);

  const cover = form?.get("cover");
  let coverKey: string | null = null;
  if (cover instanceof Blob && cover.type === "image/jpeg" && cover.size <= MAX_COVER_BYTES) {
    coverKey = keys.cover(sha256);
    if (!(await store.exists(coverKey))) {
      await store.write(coverKey, new Uint8Array(await cover.arrayBuffer()), "image/jpeg");
    }
  } else if (await store.exists(keys.cover(sha256))) {
    coverKey = keys.cover(sha256);
  }

  // Same file uploaded again by the same person → reuse their existing entry.
  const existing = await db.document.findFirst({
    where: { userId: user.id, contentId: sha256 },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ id: existing.id, duplicate: true });

  const doc = await db.document.create({
    data: {
      userId: user.id,
      origin: "upload",
      type: meta.type,
      title: meta.title,
      authors: meta.authors,
      language: meta.language,
      coverKey,
      contentId: content.id,
    },
    select: { id: true },
  });
  return NextResponse.json({ id: doc.id, duplicate: false });
}
