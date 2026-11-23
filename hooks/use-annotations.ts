"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { compareAnnotations, type Annotation, type HighlightColor } from "@/lib/reader/annotations";

export type NewAnnotation = Omit<Annotation, "id" | "createdAt">;

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
  if (!res.ok) throw new Error(`${init.method} ${url} ${res.status}`);
  return res.json();
}

/** This document's highlights, notes and bookmarks, with optimistic changes. */
export function useAnnotations(docId: string, initial: Annotation[]) {
  const t = useTranslations("notes");
  const qc = useQueryClient();
  const key = ["annotations", docId];
  const set = (fn: (list: Annotation[]) => Annotation[]) =>
    qc.setQueryData<Annotation[]>(key, (list = []) => fn(list).sort(compareAnnotations));

  const { data = initial } = useQuery({
    queryKey: key,
    queryFn: () => call<{ annotations: Annotation[] }>(`/api/documents/${docId}/annotations`, { method: "GET" }).then((r) => r.annotations),
    initialData: initial,
    staleTime: 60_000,
  });

  const failed = () => {
    toast.error(t("saveFailed"));
    void qc.invalidateQueries({ queryKey: key });
  };

  // New annotations show at once under a temporary id; changes made before
  // the server answers wait for the real id.
  const saving = useRef(new Map<string, Promise<string>>());
  const realId = async (id: string) => (id.startsWith("tmp-") ? await saving.current.get(id) : id);
  const resolved = useRef(new Map<string, string>());
  // A menu may still hold the temporary id after the real one arrived.
  const same = (x: Annotation, id: string) => x.id === id || x.id === resolved.current.get(id);

  const create = useMutation({
    mutationFn: (a: { tempId: string; request: Promise<Annotation> }) => a.request,
    onSuccess: (annotation, a) => {
      resolved.current.set(a.tempId, annotation.id);
      set((list) => list.map((x) => (x.id === a.tempId ? annotation : x)));
    },
    onError: failed,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; color?: HighlightColor; note?: string | null }) =>
      call(`/api/annotations/${await realId(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onMutate: ({ id, color, note }) =>
      set((list) =>
        list.map((x) => {
          if (!same(x, id)) return x;
          const next = { ...x, ...(color ? { color } : {}) };
          if (note !== undefined) {
            next.note = note?.trim() || null;
            next.kind = next.note ? "note" : "highlight";
          }
          return next;
        }),
      ),
    onError: failed,
  });

  const remove = useMutation({
    mutationFn: async (a: Annotation) => call(`/api/annotations/${await realId(a.id)}`, { method: "DELETE" }),
    onMutate: (a) => set((list) => list.filter((x) => !same(x, a.id))),
    onError: failed,
  });

  /** Creates it and returns its temporary id (replaced by the real one once saved). */
  const add = (a: NewAnnotation) => {
    const tempId = `tmp-${crypto.randomUUID()}`;
    set((list) => [...list, { ...a, id: tempId, createdAt: new Date().toISOString() }]);
    const request = call<{ annotation: Annotation }>(`/api/documents/${docId}/annotations`, {
      method: "POST",
      body: JSON.stringify(a),
    }).then((r) => r.annotation);
    saving.current.set(tempId, request.then((x) => x.id, () => ""));
    create.mutate({ tempId, request });
    return tempId;
  };

  /** Removes it, with an Undo that puts it back. */
  const removeWithUndo = (a: Annotation, message: string) => {
    remove.mutate(a);
    toast(message, {
      action: {
        label: t("undo"),
        onClick: () => {
          const copy: Partial<Annotation> = { ...a };
          delete copy.id;
          delete copy.createdAt;
          add(copy as NewAnnotation);
        },
      },
    });
  };

  return { annotations: data, add, update: update.mutate, remove: removeWithUndo };
}
