import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center sm:py-24">
      <div className="mb-6 grid size-16 place-items-center rounded-2xl bg-secondary text-brand">
        <Icon className="size-7" strokeWidth={1.6} aria-hidden />
      </div>
      <h2 className="font-serif text-2xl font-semibold tracking-tight text-balance">{title}</h2>
      <p className="mt-3 leading-relaxed text-pretty text-muted-foreground">{body}</p>
      {children && <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
