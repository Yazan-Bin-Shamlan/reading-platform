import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { MAX_UPLOAD_BYTES } from "@/lib/limits";
import { isLocalMode } from "@/lib/mode";
import { localPath, verify } from "@/lib/storage/local";

// Local mode stand-in for Supabase Storage's signed URLs. Supports Range
// requests so pdf.js can load big PDFs piece by piece, as it will in production.

function params(req: NextRequest, action: "get" | "put") {
  if (!isLocalMode) return null;
  const sp = req.nextUrl.searchParams;
  const key = sp.get("key") ?? "";
  const ok = verify(action, key, Number(sp.get("exp")), sp.get("sig") ?? "");
  return ok ? key : null;
}

export async function GET(req: NextRequest) {
  const key = params(req, "get");
  if (!key) return new NextResponse(null, { status: 403 });

  const path = localPath(key);
  const size = await stat(path).then((s) => s.size, () => -1);
  if (size < 0) return new NextResponse(null, { status: 404 });

  const type = key.endsWith(".jpg") ? "image/jpeg" : "application/pdf";
  const headers = { "content-type": type, "accept-ranges": "bytes", "cache-control": "private, max-age=3600" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");

  const file = await readFile(path);
  if (!range) {
    return new NextResponse(file, { headers: { ...headers, "content-length": String(size) } });
  }
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start > end || start >= size) {
    return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
  }
  return new NextResponse(file.subarray(start, end + 1), {
    status: 206,
    headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
  });
}

export async function PUT(req: NextRequest) {
  const key = params(req, "put");
  if (!key) return new NextResponse(null, { status: 403 });
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength > MAX_UPLOAD_BYTES) return new NextResponse(null, { status: 413 });
  const path = localPath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
  return NextResponse.json({ Key: key });
}
