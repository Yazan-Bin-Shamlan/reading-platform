import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { lookupEntity, WikimediaBusyError } from "@/lib/entities/lookup";

const KINDS = ["person", "place", "org", "event"] as const;

/** Encyclopedia facts for a person, place, organisation or event named on a page. */
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const name = q.get("name")?.trim().slice(0, 160);
  const kind = KINDS.find((k) => k === q.get("kind"));
  const lang = q.get("lang") === "ar" ? "ar" : "en";
  if (!name || !kind) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const entity = await lookupEntity(name, kind, lang).catch((e) => {
    if (!(e instanceof WikimediaBusyError)) console.error("Entity lookup failed", e);
    return e instanceof WikimediaBusyError ? ("busy" as const) : undefined;
  });
  if (entity === "busy") return NextResponse.json({ status: "busy" }, { status: 503 });
  if (entity === undefined) return NextResponse.json({ status: "error" }, { status: 502 });
  return NextResponse.json(
    { status: entity ? "found" : "not-found", entity },
    { headers: { "cache-control": "private, max-age=86400" } },
  );
}
