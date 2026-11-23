import type { ReactNode } from "react";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}
