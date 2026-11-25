"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Cover image, or a calm typographic stand-in when a PDF has none. When the
 * source's image fails to load, the backup (an Open Library cover) is tried next.
 */
export function BookCover({
  title,
  coverUrl,
  backupUrl,
  className,
  sizes = "small",
}: {
  title: string;
  coverUrl: string | null;
  /** From backupCoverUrl (lib/sources/covers.ts). */
  backupUrl?: string | null;
  className?: string;
  sizes?: "small" | "large";
}) {
  const urls = [coverUrl, backupUrl && (sizes === "large" ? `${backupUrl}&size=L` : backupUrl)].filter((u): u is string => Boolean(u));
  const [tried, setTried] = useState(0);
  const src = urls[tried];
  const img = useRef<HTMLImageElement>(null);
  // An image that failed before hydration never fires onError.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth === 0) setTried(1);
  }, []);
  return (
    <div
      className={cn(
        "relative aspect-[3/4] overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-foreground/5",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL or a source's own image
        <img
          key={src}
          ref={img}
          src={src}
          alt=""
          loading="lazy"
          onError={() => setTried((n) => n + 1)}
          className="size-full object-cover object-top"
        />
      ) : (
        <div className="flex size-full items-end bg-gradient-to-br from-secondary to-accent p-3">
          <p
            dir="auto"
            className={cn(
              "line-clamp-4 font-serif leading-snug font-semibold text-foreground/80",
              sizes === "large" ? "text-lg" : "text-sm",
            )}
          >
            {title}
          </p>
        </div>
      )}
    </div>
  );
}
