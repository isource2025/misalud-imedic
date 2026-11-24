"use client";

import clsx from "clsx";
import { Download, Link2, Scan } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PacsSerieViewer } from "@/components/portal/PacsSerieViewer";
import { Alert } from "@/components/ui/Alert";
import { Skeleton, Cargando } from "@/components/ui/Skeleton";
import { filtrarArchivosDeSerie, seriePrincipal } from "@/lib/pacsSeries";
import type { PacsArchivo, PacsSerie } from "@/lib/types";

type Meta = { tipo: string; meta: string; expiraEn: string; tieneArchivo: boolean };
type PacsContenido = {
  meta: string;
  series: PacsSerie[];
  archivos: PacsArchivo[];
};

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
          const c = await fetch(`/api/c/${encodeURIComponent(token)}/contenido`, { credentials: "same-origin", cache: "no-store" });
          const cb = await c.json().catch(() => ({}));
          if (!c.ok) throw new Error(cb?.error?.message || "No pudimos cargar el estudio.");
          if (cancel) return;
          const data = cb as PacsContenido;
          setPacs(data);
          const principal = seriePrincipal(data.series || [], data.archivos || []);
          setSerieActiva(principal?.id || data.series?.[0]?.id || null);
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
  }, [token]);

  const archivosSerie = useMemo(
    () => filtrarArchivosDeSerie(pacs?.archivos || [], serieActiva),
    [pacs, serieActiva]
  );

  const serieMeta = pacs?.series?.find((s) => s.id === serieActiva) || null;
  const archivosVisor = pacs?.series?.length ? archivosSerie : pacs?.archivos || [];

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
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Scan className="size-6" />
              </span>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">{meta.meta}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Disponible hasta {new Date(meta.expiraEn).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            </div>
          </div>

          {(meta.tipo === "pdf_atencion" || meta.tipo === "adjunto") && (
            <a
              href={`/api/c/${encodeURIComponent(token)}/contenido`}
              download={meta.tipo === "pdf_atencion" ? "historia.pdf" : undefined}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <Download className="size-4" />
              {meta.tipo === "pdf_atencion" ? "Descargar PDF" : "Descargar archivo"}
            </a>
          )}

          {meta.tipo === "pacs_estudio" && pacs && (
            <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-soft sm:p-5">
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
