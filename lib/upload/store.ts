"use client";

import { create } from "zustand";
import type { DocType } from "@/lib/text/analyze";

export type UploadError = "notPdf" | "tooLarge" | "encrypted" | "corrupt" | "network" | "unauthorized" | "generic";

export type UploadItem = {
  id: string;
  file: File;
  status: "reading" | "uploading" | "saving" | "done" | "error";
  progress: number; // 0–1 while uploading
  title: string;
  type?: DocType;
  coverUrl?: string;
  docId?: string;
  duplicate?: boolean;
  textStatus?: "ok" | "scanned" | "garbled";
  error?: UploadError;
};

type UploadState = {
  items: UploadItem[];
  /** Bumped to ask the file picker to open (header button, home CTA). */
  pickerRequest: number;
  openPicker: () => void;
  add: (item: UploadItem) => void;
  update: (id: string, patch: Partial<UploadItem>) => void;
  remove: (id: string) => void;
  clearFinished: () => void;
};

export const useUploads = create<UploadState>((set) => ({
  items: [],
  pickerRequest: 0,
  openPicker: () => set((s) => ({ pickerRequest: s.pickerRequest + 1 })),
  add: (item) => set((s) => ({ items: [...s.items, item] })),
  update: (id, patch) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
  remove: (id) =>
    set((s) => {
      const gone = s.items.find((i) => i.id === id);
      if (gone?.coverUrl) URL.revokeObjectURL(gone.coverUrl);
      return { items: s.items.filter((i) => i.id !== id) };
    }),
  clearFinished: () =>
    set((s) => {
      s.items.filter((i) => i.status === "done").forEach((i) => i.coverUrl && URL.revokeObjectURL(i.coverUrl));
      return { items: s.items.filter((i) => i.status !== "done") };
    }),
}));
