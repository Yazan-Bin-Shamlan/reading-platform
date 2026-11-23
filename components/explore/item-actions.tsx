"use client";

import { BookOpen, ExternalLink, Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { SourceId } from "@/lib/sources/types";

/** Read now / Add to library (fetching the file the first time), or read it on the source's site. */
export function ItemActions({
  source,
  sourceId,
  readable,
  docId: initialDoc,
  sourceUrl,
  signedIn,
}: {
  source: SourceId;
  sourceId: string;
  readable: boolean;
  docId: string | null;
  sourceUrl: string;
  signedIn: boolean;
}) {
  const t = useTranslations("explore");
  const router = useRouter();
  const pathname = usePathname();
  const signIn = () => router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
  const [docId, setDocId] = useState(initialDoc);
  const [busy, setBusy] = useState<"read" | "add" | null>(null);

  const add = async (then: "read" | "add") => {
    if (!signedIn) return signIn();
    setBusy(then);
    try {
      const res = await fetch("/api/explore/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, sourceId }),
      });
      const body = (await res.json().catch(() => ({}))) as { docId?: string; error?: string };
      if (!res.ok || !body.docId) throw new Error(body.error ?? "unavailable");
      setDocId(body.docId);
      if (then === "read") router.push(`/read/${body.docId}`);
      else toast.success(t("added"), { action: { label: t("readNow"), onClick: () => router.push(`/read/${body.docId}`) } });
    } catch (e) {
      const code = e instanceof Error ? e.message : "unavailable";
      toast.error(t(`importErrors.${["too-large", "not-pdf", "no-file", "not-open", "not-found"].includes(code) ? code : "unavailable"}`));
    } finally {
      setBusy(null);
    }
  };

  const external = (
    <Button asChild variant={readable ? "ghost" : "default"} size="lg">
      <a href={sourceUrl} target="_blank" rel="noreferrer">
        <ExternalLink aria-hidden />
        {t(readable ? "viewSource" : "readOnSource", { source: t(`sources.${source}`) })}
      </a>
    </Button>
  );

  if (!readable) return <div className="flex flex-wrap gap-2">{external}</div>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {docId ? (
        <Button asChild size="lg">
          <Link href={`/read/${docId}`}>
            <BookOpen aria-hidden />
            {t("openInLibrary")}
          </Link>
        </Button>
      ) : (
        <>
          <Button size="lg" onClick={() => add("read")} disabled={busy !== null}>
            {busy === "read" ? <Loader2 aria-hidden className="animate-spin" /> : <BookOpen aria-hidden />}
            {busy === "read" ? t("preparing") : t("readNow")}
          </Button>
          <Button size="lg" variant="outline" onClick={() => add("add")} disabled={busy !== null}>
            {busy === "add" ? <Loader2 aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
            {t("addToLibrary")}
          </Button>
        </>
      )}
      {external}
    </div>
  );
}
