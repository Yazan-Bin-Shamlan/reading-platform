"use client";

import { AlertCircle, CheckCircle2, FileText, Loader2, RotateCcw, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { patchDocument, TypeSelect } from "@/components/library/type-select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { MAX_UPLOAD_MB } from "@/lib/limits";
import { enqueueFiles } from "@/lib/upload/run";
import { useUploads, type UploadItem } from "@/lib/upload/store";

export function UploadPanel() {
  const t = useTranslations("upload");
  const items = useUploads((s) => s.items);
  const clearFinished = useUploads((s) => s.clearFinished);
  const active = items.filter((i) => i.status !== "done" && i.status !== "error").length;
  const added = items.filter((i) => i.status === "done").length;

  return (
    <AnimatePresence>
      {items.length > 0 && (
        <motion.section
          aria-live="polite"
          aria-label={active ? t("panelTitle", { count: active }) : t("panelDone", { count: added })}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm overflow-hidden rounded-2xl border bg-popover shadow-xl md:inset-x-auto md:end-6 md:bottom-6 md:w-96"
        >
          <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <p className="text-sm font-medium">
              {active ? t("panelTitle", { count: active }) : t("panelDone", { count: added })}
            </p>
            {!active && (
              <Button variant="ghost" size="icon-sm" aria-label={t("close")} onClick={clearFinished}>
                <X aria-hidden />
              </Button>
            )}
          </header>
          <ul className="max-h-80 divide-y overflow-y-auto">
            {items.map((item) => (
              <UploadRow key={item.id} item={item} />
            ))}
          </ul>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function UploadRow({ item }: { item: UploadItem }) {
  const t = useTranslations("upload");
  const { update, remove } = useUploads.getState();
  const percent = Math.round(item.progress * 100);

  const status = {
    reading: t("reading"),
    uploading: t("uploading", { percent }),
    saving: t("saving"),
    done: item.duplicate ? t("duplicate") : t("done"),
    error: item.error ? t(`errors.${item.error}`, { max: MAX_UPLOAD_MB }) : "",
  }[item.status];

  return (
    <li className="flex gap-3 px-4 py-3">
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL
          <img src={item.coverUrl} alt="" className="size-full object-cover object-top" />
        ) : (
          <FileText className="m-auto mt-4 size-5 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          <bdi>{item.title}</bdi>
        </p>
        <p
          className={`mt-0.5 flex items-center gap-1.5 text-xs ${item.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {item.status === "done" && <CheckCircle2 className="size-3.5 text-brand" aria-hidden />}
          {item.status === "error" && <AlertCircle className="size-3.5" aria-hidden />}
          {(item.status === "reading" || item.status === "saving") && (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          )}
          {status}
        </p>
        {item.status === "uploading" && <Progress value={percent} className="mt-2 h-1" />}
        {item.status === "done" && item.textStatus && item.textStatus !== "ok" && (
          <p className="mt-1 text-xs leading-snug text-muted-foreground">{t("scannedNote")}</p>
        )}
        {item.status === "done" && item.docId && (
          <div className="mt-2 flex items-center gap-2">
            <Button size="xs" asChild>
              <Link href={`/read/${item.docId}`}>{t("readNow")}</Link>
            </Button>
            {item.type && !item.duplicate && (
              <TypeSelect
                value={item.type}
                onChange={(type) => {
                  update(item.id, { type });
                  patchDocument(item.docId!, { type }).catch(() => toast.error(t("errors.generic")));
                }}
              />
            )}
          </div>
        )}
        {item.status === "error" && (
          <div className="mt-2 flex gap-2">
            {item.error !== "notPdf" && item.error !== "tooLarge" && item.error !== "encrypted" && (
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  remove(item.id);
                  enqueueFiles([item.file]);
                }}
              >
                <RotateCcw aria-hidden />
                {t("retry")}
              </Button>
            )}
            <Button size="xs" variant="ghost" onClick={() => remove(item.id)}>
              {t("dismiss")}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
