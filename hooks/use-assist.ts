"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Term } from "@/lib/ai/schemas";

export type AssistStatus = "ok" | "paused" | "limit" | "off" | "unavailable" | "no-text" | "preparing";

type Response = {
  status: AssistStatus;
  provider?: string;
  until?: string;
  pages?: { i: number; terms: Term[] }[];
  pending?: number[];
  failed?: number[];
};

const CHUNK = 4;
const MAX_POLLS = 40;

async function fetchAssist(docId: string, from: number): Promise<Response & { polls: number }> {
  const res = await fetch(`/api/documents/${docId}/assist?from=${from}&to=${from + CHUNK - 1}`);
  if (!res.ok) throw new Error(`assist ${res.status}`);
  return { ...(await res.json()), polls: 0 };
}

/**
 * Smart Assist marks for the current page and the few after it. The server
 * analyses missing pages in the background; we poll until they're in.
 */
export function useAssist(docId: string, page: number, enabled: boolean) {
  const first = Math.floor(page / CHUNK) * CHUNK;
  const results = useQueries({
    queries: [first, first + CHUNK].map((from) => ({
      queryKey: ["assist", docId, from],
      queryFn: () => fetchAssist(docId, from),
      enabled,
      staleTime: Infinity,
      gcTime: 30 * 60_000,
      // Keep asking while pages are being analysed (or text is being prepared), up to a limit.
      refetchInterval: (q: { state: { data?: Response; dataUpdateCount: number } }) => {
        const d = q.state.data;
        const waiting = d && (d.status === "preparing" || (d.status === "ok" && (d.pending?.length ?? 0) > 0));
        return waiting && q.state.dataUpdateCount < MAX_POLLS ? 2000 : false;
      },
    })),
  });

  const key = results.map((r) => r.dataUpdatedAt).join();
  return useMemo(() => {
    const pages = new Map<number, Term[]>();
    let status: AssistStatus = "ok";
    let provider: string | undefined;
    let until: string | undefined;
    let analyzing = false;
    for (const r of results) {
      const d = r.data;
      if (!d) continue;
      for (const p of d.pages ?? []) pages.set(p.i, p.terms);
      if (d.status !== "ok") status = d.status;
      provider ??= d.provider;
      until ??= d.until;
      if (d.pending?.includes(page) || (d.pending?.length && d.status === "ok")) analyzing = true;
    }
    return { pages, status, provider, until, analyzing };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- results is a new array every render; key tracks its data
  }, [key, page]);
}
