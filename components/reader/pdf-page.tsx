"use client";

import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist/types/src/display/api";
import type { TextLayer } from "pdfjs-dist";
import { Loader2 } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { loadPdfjs } from "@/lib/pdf/pdfjs";

// Mobile browsers refuse very large canvases; stay under ~16M pixels.
const MAX_CANVAS_PIXELS = 16_000_000;

type Props = {
  pdf: PDFDocumentProxy;
  index: number;
  /** CSS pixels per PDF point. */
  scale: number;
  top: number;
  width: number;
  height: number;
  label: string;
  onSize: (index: number, width: number, height: number) => void;
};

/** One page: a canvas for the picture and pdf.js's invisible text layer on top for selection. */
export const PdfPage = memo(function PdfPage({ pdf, index, scale, top, width, height, label, onSize }: Props) {
  const canvasHost = useRef<HTMLDivElement>(null);
  const textHost = useRef<HTMLDivElement>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let textLayer: TextLayer | null = null;

    (async () => {
      const page = pageRef.current ?? (await pdf.getPage(index + 1));
      if (cancelled) return;
      pageRef.current = page;
      const natural = page.getViewport({ scale: 1 });
      onSize(index, natural.width, natural.height);

      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
      const maxScale = Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height));
      const outputScale = Math.min(dpr, maxScale);

      // Render off-screen, then swap in, so zooming never flashes a blank page.
      const canvas = document.createElement("canvas");
      canvas.className = "pdf-canvas absolute inset-0 size-full";
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      renderTask = page.render({
        canvas,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      });
      try {
        await renderTask.promise;
      } catch {
        return; // cancelled
      }
      if (cancelled || !canvasHost.current) return;
      canvasHost.current.replaceChildren(canvas);
      setReady(true);

      const host = textHost.current;
      if (!host) return;
      const { TextLayer } = await loadPdfjs();
      if (cancelled) return;
      host.replaceChildren();
      textLayer = new TextLayer({
        textContentSource: page.streamTextContent({ includeMarkedContent: true, disableNormalization: true }),
        container: host,
        viewport,
      });
      await textLayer.render().catch(() => {});
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, index, scale, onSize]);

  // Free the page's memory when it scrolls far away and unmounts.
  useEffect(() => () => void pageRef.current?.cleanup(), []);

  return (
    <div
      role="group"
      aria-label={label}
      data-page={index}
      className="pdf-page absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-sm shadow-[0_1px_3px_rgb(0_0_0/0.08),0_8px_24px_-12px_rgb(0_0_0/0.18)]"
      style={{ top, width, height }}
    >
      <div ref={canvasHost} className="absolute inset-0" />
      {!ready && (
        <Loader2 aria-hidden className="absolute top-1/2 left-1/2 size-5 -translate-1/2 animate-spin text-black/20" />
      )}
      <div
        ref={textHost}
        className="textLayer"
        style={
          {
            "--total-scale-factor": scale,
            "--scale-round-x": "1px",
            "--scale-round-y": "1px",
          } as React.CSSProperties
        }
      />
    </div>
  );
});
