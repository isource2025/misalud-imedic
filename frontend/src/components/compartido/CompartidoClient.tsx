"use client";

import clsx from "clsx";
import { Download, Eye, FileText, Link2, Paperclip, Scan } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PacsSerieViewer } from "@/components/portal/PacsSerieViewer";
import { Alert } from "@/components/ui/Alert";
import { Skeleton, Cargando } from "@/components/ui/Skeleton";
import { filtrarArchivosDeSerie, seriePrincipal } from "@/lib/pacsSeries";
import type { PacsArchivo, PacsSerie } from "@/lib/types";

type Meta = {
  tipo: string;
  tipoLabel?: string;
  meta: string;
  expiraEn: string;
  tieneArchivo: boolean;
};
type PacsContenido = {
  meta: string;
  series: PacsSerie[];
  archivos: PacsArchivo[];
};

function tipoLabelDe(tipo: string, fallback?: string) {
  if (fallback) return fallback;
  if (tipo === "pdf_atencion") return "Historia clínica (PDF)";
  if (tipo === "pacs_estudio") return "Estudio de imágenes";
  if (tipo === "adjunto") return "Adjunto";
  return "Recurso compartido";
}

function IconoTipo({ tipo }: { tipo: string }) {
  if (tipo === "pacs_estudio") return <Scan className="size-6" />;
  if (tipo === "adjunto") return <Paperclip className="size-6" />;
  return <FileText className="size-6" />;
}

function esImagenNombre(nombre: string) {
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(nombre);
}

export function CompartidoSkeleton() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10">
      <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
        <Link2 className="size-4" /> MiSalud · recurso compartido
      </p>
      <Cargando>
        <Skeleton className="mt-8 h-32 w-full rounded-3xl" />
      </Cargando>
    </main>
  );
}

export function CompartidoClient({ token }: { token: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [pacs, setPacs] = useState<PacsContenido | null>(null);
  const [serieActiva, setSerieActiva] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [viendo, setViendo] = useState(false);

  const contenidoUrl = `/api/c/${encodeURIComponent(token)}/contenido`;
  const descargarUrl = `${contenidoUrl}?dl=1`;

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(`/api/c/${encodeURIComponent(token)}`, { credentials: "same-origin", cache: "no-store" });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error?.message || "Este link no es válido o expiró.");
        if (cancel) return;
        setMeta(body as Meta);
        if (body.tipo === "pacs_estudio") {
          const c = await fetch(contenidoUrl, { credentials: "same-origin", cache: "no-store" });
          const cb = await c.json().catch(() => ({}));
          if (!c.ok) throw new Error(cb?.error?.message || "No pudimos cargar el estudio.");
          if (cancel) return;
          const data = cb as PacsContenido;
          setPacs(data);
          const principal = seriePrincipal(data.series || [], data.archivos || []);
          setSerieActiva(principal?.id || data.series?.[0]?.id || null);
          setViendo(true);
        } else if (body.tipo === "pdf_atencion" || body.tipo === "adjunto") {
          // PDF / adjunto: mostrar vista al abrir el link.
          setViendo(true);
        }
      } catch (err) {
        if (!cancel) setError(err instanceof Error ? err.message : "No pudimos abrir el link.");
      } finally {
        if (!cancel) setCargando(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [token, contenidoUrl]);

  const archivosSerie = useMemo(
    () => filtrarArchivosDeSerie(pacs?.archivos || [], serieActiva),
    [pacs, serieActiva]
  );

  const serieMeta = pacs?.series?.find((s) => s.id === serieActiva) || null;
  const archivosVisor = pacs?.series?.length ? archivosSerie : pacs?.archivos || [];
  const tipoLabel = meta ? tipoLabelDe(meta.tipo, meta.tipoLabel) : "";
  const adjuntoEsImagen = meta?.tipo === "adjunto" && esImagenNombre(meta.meta);

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-5 py-10">
      <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
        <Link2 className="size-4" /> MiSalud · recurso compartido
      </p>

      {cargando && (
        <Cargando>
          <Skeleton className="mt-8 h-32 w-full rounded-3xl" />
        </Cargando>
      )}

      {error && (
        <div className="mt-8">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {meta && !error && (
        <div className="mt-8 space-y-5">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
            <div className="flex items-start gap-4">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IconoTipo tipo={meta.tipo} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{tipoLabel}</p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight">{meta.meta}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Disponible hasta {new Date(meta.expiraEn).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            </div>

            {(meta.tipo === "pdf_atencion" || meta.tipo === "adjunto") && (
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setViendo(true)}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 sm:flex-none"
                >
                  <Eye className="size-4" />
                  Ver
                </button>
                <a
                  href={descargarUrl}
                  download={meta.tipo === "pdf_atencion" ? "historia.pdf" : undefined}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 sm:flex-none"
                >
                  <Download className="size-4" />
                  Descargar
                </a>
              </div>
            )}
          </div>

          {(meta.tipo === "pdf_atencion" || meta.tipo === "adjunto") && viendo && (
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-soft">
              {meta.tipo === "adjunto" && adjuntoEsImagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={contenidoUrl} alt={meta.meta} className="mx-auto max-h-[80vh] w-full object-contain" />
              ) : (
                <iframe
                  title={`Vista de ${meta.meta}`}
                  src={contenidoUrl}
                  className="h-[min(80vh,900px)] w-full border-0 bg-slate-50"
                />
              )}
            </div>
          )}

          {meta.tipo === "pacs_estudio" && pacs && (
            <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-soft sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-50 px-3 text-xs font-semibold text-brand-700">
                  <Eye className="size-3.5" /> Ver estudio
                </span>
              </div>
              {pacs.series?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pacs.series.map((s) => {
                    const n = filtrarArchivosDeSerie(pacs.archivos || [], s.id).length;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSerieActiva(s.id)}
                        className={clsx(
                          "rounded-xl px-3 py-1.5 text-xs font-medium transition",
                          serieActiva === s.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {s.number}. {s.description || s.modality || "Serie"}
                        {s.instanceCount ? ` · ${s.instanceCount}` : n ? ` · ${n}` : ""}
                      </button>
                    );
                  })}
                </div>
              )}

              {archivosVisor.length ? (
                <PacsSerieViewer
                  estudioId="compartido"
                  archivos={archivosVisor}
                  modality={serieMeta?.modality || null}
                  titulo={meta.meta}
                  archivoBase={`/api/c/${encodeURIComponent(token)}/archivo/`}
                />
              ) : (
                <p className="text-sm text-slate-500">
                  {pacs.archivos?.length
                    ? "No hay imágenes asociadas a esta serie en disco. Probá otra serie."
                    : "No hay imágenes para este estudio."}
                </p>
              )}
            </div>
          )}

          <p className="text-center text-xs text-slate-400">Este link es temporal y de solo lectura. Ante dudas, consultá a tu médico.</p>
        </div>
      )}
    </main>
  );
}
