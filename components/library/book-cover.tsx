"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Cover image, or a calm typographic stand-in when a PDF has none (or its source's image fails). */
export function BookCover({
  title,
  coverUrl,
  className,
  sizes = "small",
}: {
  title: string;
  coverUrl: string | null;
  className?: string;
  sizes?: "small" | "large";
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // An image that failed before hydration never fires onError.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth === 0) setFailed(true);
  }, []);
  return (
    <div
      className={cn(
        "relative aspect-[3/4] overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-foreground/5",
        className,
      )}
    >
      {coverUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
        <img ref={img} src={coverUrl} alt="" loading="lazy" onError={() => setFailed(true)} className="size-full object-cover object-top" />
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
