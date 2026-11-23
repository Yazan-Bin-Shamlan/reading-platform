"use client";

import { FileUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { MAX_UPLOAD_MB } from "@/lib/limits";
import { enqueueFiles } from "@/lib/upload/run";
import { useUploads } from "@/lib/upload/store";
import { SignedInContext } from "./upload-context";
import { UploadPanel } from "./upload-panel";

/**
 * Upload entry points for the whole app: a hidden file input (opened by any
 * Upload button), drag-and-drop anywhere on the page, and the progress panel.
 */
export function UploadProvider({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const t = useTranslations("upload");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const pickerRequest = useUploads((s) => s.pickerRequest);
  const doneCount = useUploads((s) => s.items.filter((i) => i.status === "done").length);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (pickerRequest) input.current?.click();
  }, [pickerRequest]);

  // Show new books in the library as soon as they're added.
  useEffect(() => {
    if (doneCount) router.refresh();
  }, [doneCount, router]);

  useEffect(() => {
    if (!signedIn) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const leave = () => {
      if (--depth <= 0) {
        depth = 0;
        setDragging(false);
      }
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer?.files.length) enqueueFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [signedIn]);

  return (
    <SignedInContext value={signedIn}>
      {children}
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) enqueueFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/80 p-6 backdrop-blur-sm"
          >
            <div className="flex w-full max-w-md flex-col items-center rounded-3xl border-2 border-dashed border-brand/60 bg-card px-8 py-14 text-center shadow-lg">
              <FileUp className="size-10 text-brand" strokeWidth={1.5} aria-hidden />
              <p className="mt-4 font-serif text-xl font-semibold">{t("dropTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("dropBody", { max: MAX_UPLOAD_MB })}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <UploadPanel />
    </SignedInContext>
  );
}
