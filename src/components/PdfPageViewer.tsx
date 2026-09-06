import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Loader2, FileWarning } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export type PdfFitMode = 'contain' | 'width' | 'cover';

interface PdfPageViewerProps {
  url: string;
  altUrls?: string[];
  page: number;
  onTotalPages?: (total: number) => void;
  onError?: () => void;
  className?: string;
  fitMode?: PdfFitMode;
  zoom?: number;
  panX?: number;
  panY?: number;
}

// Render the page at 2x its base size so zooming/pannig stays crisp without re-rendering.
const BASE_SCALE = 2;

export const PdfPageViewer: React.FC<PdfPageViewerProps> = ({
  url,
  altUrls = [],
  page,
  onTotalPages,
  onError,
  className,
  fitMode = 'contain',
  zoom = 1,
  panX = 0.5,
  panY = 0.5,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const urlKey = `${url}\u0000${altUrls.join('\u0000')}`;

  // Load the PDF document, falling back through candidate URLs if the first fails
  useEffect(() => {
    let cancelled = false;
    const urls = [url, ...altUrls].filter(Boolean);
    let currentTask: PDFDocumentLoadingTask | null = null;

    const attempt = (i: number) => {
      if (cancelled) return;
      if (i >= urls.length) {
        setFailed(true);
        onError?.();
        return;
      }
      setDoc(null);
      setPageSize(null);
      setFailed(false);
      renderTaskRef.current?.cancel();
      const loadingTask = pdfjs.getDocument({ url: urls[i] });
      currentTask = loadingTask;
      loadingTask.promise
        .then((d) => {
          if (cancelled) return;
          setDoc(d);
          onTotalPages?.(d.numPages);
        })
        .catch(() => {
          if (cancelled) return;
          attempt(i + 1);
        });
    };

    attempt(0);

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      currentTask?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  // Render the requested page once at BASE_SCALE (high-res backing store)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    let cancelled = false;

    (async () => {
      const pageNum = Math.min(Math.max(1, page), doc.numPages);
      const pdfPage: PDFPageProxy = await doc.getPage(pageNum);
      if (cancelled) return;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const vp = pdfPage.getViewport({ scale: BASE_SCALE });
      canvas.width = Math.max(1, Math.round(vp.width * dpr));
      canvas.height = Math.max(1, Math.round(vp.height * dpr));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const task = pdfPage.render({ canvasContext: ctx, canvas, viewport: vp });
      renderTaskRef.current = task;
      await task.promise;
      if (!cancelled) {
        // vp is in CSS px at BASE_SCALE; store it for layout math.
        setPageSize({ w: vp.width, h: vp.height });
      }
    })().catch(() => {
      if (cancelled) return;
      setFailed(true);
      onError?.();
    });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, page]);

  // Fit + zoom + pan the rendered canvas into the container using pure CSS transforms.
  const applyLayout = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !pageSize) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;

    const { w, h } = pageSize;
    const fitScale =
      fitMode === 'width'
        ? cw / w
        : fitMode === 'cover'
          ? Math.max(cw / w, ch / h)
          : Math.min(cw / w, ch / h);
    const s = fitScale * zoom;
    const dispW = w * s;
    const dispH = h * s;

    const maxX = Math.max(0, dispW - cw);
    const maxY = Math.max(0, dispH - ch);
    const tx = Math.max(0, (cw - dispW) / 2) - panX * maxX;
    const ty = Math.max(0, (ch - dispH) / 2) - panY * maxY;

    canvas.style.width = `${dispW}px`;
    canvas.style.height = `${dispH}px`;
    canvas.style.transform = `translate(${tx}px, ${ty}px)`;
  }, [pageSize, fitMode, zoom, panX, panY]);

  // Observe container size changes (edit preview and presentation mode share this path)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => applyLayout());
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyLayout]);

  // Re-apply layout whenever the framing config or rendered page changes
  useEffect(() => {
    applyLayout();
  }, [applyLayout]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden ${className || ''}`}
    >
      {!failed && (
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 bg-white rounded-[2px] shadow-lg"
          style={{ willChange: 'transform' }}
        />
      )}

      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-rose-500 text-xs font-bold bg-[var(--bg)] text-center px-4">
          <FileWarning className="w-5 h-5 shrink-0" />
          <span>Não foi possível abrir o PDF aqui. Confirme que o arquivo está compartilhado como &quot;Qualquer pessoa com o link&quot; e tente novamente, ou use o visualizador padrão abaixo.</span>
        </div>
      ) : !pageSize ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-[var(--muted)] text-xs font-bold bg-[var(--bg)]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando página {page}...</span>
        </div>
      ) : null}
    </div>
  );
};
