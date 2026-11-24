"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Download, FileWarning, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";

type Props = {
  /** URL same-origin del archivo (sin ?dl=1 para vista). */
  src: string;
  titulo: string;
  /** Si true, fuerza re-fetch al montar / al cambiar ticket. */
  ticket?: number;
  onDescargar?: () => void;
  className?: string;
};

type Fase = "idle" | "descargando" | "preparando" | "listo" | "error";

function esPdf(mime: string, nombre: string) {
  return /pdf/i.test(mime) || /\.pdf$/i.test(nombre);
}

function esImagen(mime: string, nombre: string) {
  return /^image\//i.test(mime) || /\.(jpe?g|png|gif|webp|bmp)$/i.test(nombre);
}

function esVideo(mime: string, nombre: string) {
  return /^video\//i.test(mime) || /\.(mp4|webm|ogg|mov)$/i.test(nombre);
}

export function VisorLoader({ mensaje }: { mensaje: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[min(70vh,640px)] flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center"
    >
      <span className="relative inline-flex size-14 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/30" />
        <span className="relative inline-flex size-14 items-center justify-center rounded-full bg-brand-500/20 ring-1 ring-brand-400/40">
          <Loader2 className="size-7 animate-spin text-brand-300" />
        </span>
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{mensaje}</p>
        <p className="mt-1 text-xs text-slate-400">Un momento, estamos abriendo el archivo…</p>
      </div>
      <span className="sr-only">Cargando</span>
    </div>
  );
}

export function ArchivoViewer({ src, titulo, ticket = 0, onDescargar, className }: Props) {
  const [fase, setFase] = useState<Fase>("idle");
  const [error, setError] = useState("");
  const [mime, setMime] = useState("");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  // pdf.js PDFDocumentProxy — tipado laxo para no acoplar a internals del paquete.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pagina, setPagina] = useState(1);
  const [zoom, setZoom] = useState(1.15);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderGen = useRef(0);

  useEffect(() => {
    let cancel = false;
    let objectUrl: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pdf: any = null;

    setFase("descargando");
    setError("");
    setPdfDoc(null);
    setPagina(1);
    setBlobUrl(null);

    (async () => {
      try {
        const res = await fetch(src, { credentials: "same-origin", cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message || `No pudimos abrir el archivo (HTTP ${res.status}).`);
        }
        const contentType = (res.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
        const data = await res.arrayBuffer();
        if (cancel) return;

        setFase("preparando");
        setMime(contentType);
        const blob = new Blob([data], { type: contentType });
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);

        if (esPdf(contentType, titulo)) {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
          if (cancel) {
            await doc.destroy();
            return;
          }
          pdf = doc;
          setPdfDoc(doc);
        }

        if (!cancel) setFase("listo");
      } catch (err) {
        if (!cancel) {
          setError(err instanceof Error ? err.message : "No pudimos abrir el archivo.");
          setFase("error");
        }
      }
    })();

    return () => {
      cancel = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      void pdf?.destroy?.();
    };
  }, [src, titulo, ticket]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    const gen = ++renderGen.current;
    let cancel = false;

    (async () => {
      try {
        const page = await pdfDoc.getPage(pagina);
        if (cancel || gen !== renderGen.current) return;
        const canvas = canvasRef.current!;
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: zoom * dpr });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      } catch {
        /* render abortado al cambiar página/zoom */
      }
    })();

    return () => {
      cancel = true;
    };
  }, [pdfDoc, pagina, zoom]);

  const pdfMode = Boolean(pdfDoc);
  const imageMode = !pdfMode && blobUrl && esImagen(mime, titulo);
  const videoMode = !pdfMode && blobUrl && esVideo(mime, titulo);
  const otroMode = fase === "listo" && !pdfMode && !imageMode && !videoMode;

  return (
    <div className={clsx("overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-soft", className)}>
      {(fase === "descargando" || fase === "preparando") && (
        <VisorLoader mensaje={fase === "descargando" ? "Descargando archivo…" : "Preparando visualizador…"} />
      )}

      {fase === "error" && (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <FileWarning className="size-10 text-amber-400" />
          <Alert tone="error">{error}</Alert>
          {onDescargar && (
            <button
              type="button"
              onClick={onDescargar}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15"
            >
              <Download className="size-4" /> Descargar igual
            </button>
          )}
        </div>
      )}

      {fase === "listo" && (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2.5">
            {pdfMode && (
              <>
                <button
                  type="button"
                  aria-label="Página anterior"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 disabled:opacity-40"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <span className="min-w-20 text-center text-xs font-medium text-slate-300">
                  {pagina} / {pdfDoc?.numPages || 1}
                </span>
                <button
                  type="button"
                  aria-label="Página siguiente"
                  disabled={pagina >= (pdfDoc?.numPages || 1)}
                  onClick={() => setPagina((p) => Math.min(pdfDoc?.numPages || 1, p + 1))}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 disabled:opacity-40"
                >
                  <ChevronRight className="size-5" />
                </button>
                <span className="mx-1 h-5 w-px bg-white/10" />
              </>
            )}
            {(pdfMode || imageMode) && (
              <>
                <button
                  type="button"
                  aria-label="Alejar"
                  onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.15) * 100) / 100))}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10"
                >
                  <ZoomOut className="size-4" />
                </button>
                <span className="min-w-12 text-center text-xs text-slate-400">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  aria-label="Acercar"
                  onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100))}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10"
                >
                  <ZoomIn className="size-4" />
                </button>
              </>
            )}
            <span className="ml-auto truncate px-2 text-xs text-slate-400">{titulo}</span>
            {onDescargar && (
              <button
                type="button"
                onClick={onDescargar}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15"
              >
                <Download className="size-3.5" /> Descargar
              </button>
            )}
          </div>

          <div className="max-h-[min(80vh,920px)] overflow-auto bg-slate-900/80 p-3 sm:p-5">
            {pdfMode && (
              <div className="mx-auto w-fit rounded-lg bg-white shadow-2xl shadow-black/40">
                <canvas ref={canvasRef} className="block max-w-full" />
              </div>
            )}
            {imageMode && blobUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={blobUrl}
                alt={titulo}
                style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
                className="mx-auto max-w-full rounded-lg shadow-2xl shadow-black/40 transition-transform"
              />
            )}
            {videoMode && blobUrl && (
              <video src={blobUrl} controls className="mx-auto max-h-[70vh] w-full max-w-3xl rounded-lg bg-black" />
            )}
            {otroMode && (
              <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center text-slate-300">
                <FileWarning className="size-10 text-slate-500" />
                <p className="text-sm">Este tipo de archivo no se puede previsualizar acá.</p>
                {onDescargar && (
                  <button
                    type="button"
                    onClick={onDescargar}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    <Download className="size-4" /> Descargar archivo
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
