"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: [keys: string[], action: string][] = [
  [["←", "→"], "turnPage"],
  [["Space"], "scrollDown"],
  [["/"], "search"],
  [["a"], "assist"],
  [["m"], "mode"],
  [["f"], "focus"],
  [["t"], "theme"],
  [["c"], "contents"],
  [["n"], "notes"],
  [["b"], "bookmark"],
  [["+", "−"], "size"],
  [["Esc"], "close"],
  [["?"], "help"],
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("shortcuts");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
          {SHORTCUTS.map(([keys, action]) => (
            <div key={action} className="contents">
              <dt className="flex gap-1" dir="ltr">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="min-w-7 rounded-md border border-b-2 bg-muted px-1.5 py-0.5 text-center font-mono text-xs"
                  >
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="text-muted-foreground">{t(action)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
