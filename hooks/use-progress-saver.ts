"use client";

import { useEffect, useRef } from "react";

type Position = { pageIndex: number; offset: number; percent: number };

/**
 * Saves the reading position shortly after it stops changing, and once more
 * when the tab is hidden or closed (sendBeacon survives page unload).
 */
export function useProgressSaver(docId: string, position: Position | null, delay = 1500) {
  const url = `/api/documents/${docId}/progress`;
  const latest = useRef<Position | null>(null);
  const saved = useRef<string>("");

  useEffect(() => {
    if (!position) return;
    latest.current = position;
    const timer = setTimeout(() => {
      const body = JSON.stringify(position);
      if (body === saved.current) return;
      saved.current = body;
      fetch(url, { method: "PUT", body, keepalive: true }).catch(() => {
        saved.current = ""; // retry on the next change
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [url, position, delay]);

  useEffect(() => {
    const flush = () => {
      if (!latest.current) return;
      const body = JSON.stringify(latest.current);
      if (body === saved.current) return;
      saved.current = body;
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    };
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [url]);
}
