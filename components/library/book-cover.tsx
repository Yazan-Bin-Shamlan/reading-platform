import { cn } from "@/lib/utils";

/** Cover image, or a calm typographic stand-in when a PDF has none. */
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
  return (
    <div
      className={cn(
        "relative aspect-[3/4] overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-foreground/5",
        className,
      )}
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
        <img src={coverUrl} alt="" loading="lazy" className="size-full object-cover object-top" />
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
