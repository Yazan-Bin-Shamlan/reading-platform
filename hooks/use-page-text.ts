"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Block, MapRun } from "@/lib/text/reflow";

export type PageData = { i: number; text: string; blocks: Block[]; map?: MapRun[] };
type Response = { status: "pending" } | { status: "ready"; pages: PageData[] };

const CHUNK = 20;

async function fetchPages(url: string): Promise<Response> {
  const res = await fetch(url);
  if (res.status === 202) return { status: "pending" };
  if (!res.ok) throw new Error(`pages ${res.status}`);
  return res.json();
}

// While the server is still extracting, ask again shortly.
const pollWhilePending = (q: { state: { data?: Response } }) => (q.state.data?.status === "pending" ? 1500 : false);

/** Reflowed text for pages [from, to], fetched in chunks and kept for the session. */
export function usePageText(docId: string, from: number, to: number, opts: { map?: boolean; enabled?: boolean } = {}) {
  const { map = false, enabled = true } = opts;
  const chunks: number[] = [];
  if (to >= from) for (let c = Math.floor(from / CHUNK); c <= Math.floor(to / CHUNK); c++) chunks.push(c);

  const results = useQueries({
    queries: chunks.map((c) => ({
      queryKey: ["pages", docId, c, map],
      queryFn: () =>
        fetchPages(`/api/documents/${docId}/pages?from=${c * CHUNK}&to=${c * CHUNK + CHUNK - 1}${map ? "&map=1" : ""}`),
      enabled,
      staleTime: Infinity,
      gcTime: 10 * 60_000,
      refetchInterval: pollWhilePending,
    })),
  });

  const pending = results.some((r) => r.data?.status === "pending");
  const failed = results.some((r) => r.isError);
  const key = results.map((r) => r.dataUpdatedAt).join();
  const pages = useMemo(() => {
    const out = new Map<number, PageData>();
    for (const r of results) if (r.data?.status === "ready") for (const p of r.data.pages) out.set(p.i, p);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- results is a new array every render; key tracks its data
  }, [key]);
  return { pages, pending, failed };
}

/** Every page's text, for searching the whole document. */
export function useAllText(docId: string, enabled: boolean) {
  const q = useQuery({
    queryKey: ["pages", docId, "all"],
    queryFn: () => fetchPages(`/api/documents/${docId}/pages?all=1`),
    enabled,
    staleTime: Infinity,
    refetchInterval: pollWhilePending,
  });
  return {
    pages: q.data?.status === "ready" ? (q.data.pages as { i: number; text: string }[]) : null,
    pending: q.data?.status === "pending" || q.isLoading,
  };
}
