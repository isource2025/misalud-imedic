"use client";

import clsx from "clsx";
import { ImageIcon, Link2, Scan } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PacsSerieViewer } from "./PacsSerieViewer";
import { Alert } from "@/components/ui/Alert";
import { Skeleton, Cargando } from "@/components/ui/Skeleton";
import { api, mensajeError } from "@/lib/api";
import { fechaCorta } from "@/lib/format";
import type { PacsArchivo, PacsEstudio, PacsResponse, PacsSerie } from "@/lib/types";

type Props = {
  data: PacsResponse | null;
  error: string | null;
  cargando: boolean;
  recargar: () => void;
  clinica: string;
  onCompartir?: (estudio: PacsEstudio) => void;
  /** Si true, omite el título de sección (cuando ya está dentro de Estudios y adjuntos). */
  embebido?: boolean;
};

function seriePrincipal(series: PacsSerie[]) {
  const utiles = series.filter((s) => {
    const d = `${s.description || ""} ${s.modality || ""}`.toUpperCase();
    return !/DOSE|INFORME|SAVED STATE|LOCALIZER|SCOUT/.test(d);
  });
  const pool = utiles.length ? utiles : series;
  return [...pool].sort((a, b) => (b.instanceCount || 0) - (a.instanceCount || 0))[0] || null;
}

export function PacsPanel({ data, error, cargando, recargar, clinica, onCompartir, embebido }: Props) {
  const [abierto, setAbierto] = useState<PacsEstudio | null>(null);

  if (cargando) {
    return (
      <Cargando>
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-3xl" />
          ))}
        </div>
      </Cargando>
    );
  }

  if (error) {
    return (
      <Alert tone={error.includes("disponible") ? "offline" : "error"}>
        {error}{" "}
        <button onClick={recargar} className="ml-1 font-medium underline">
          Reintentar
        </button>
      </Alert>
    );
  }

  if (!data?.publicados) {
    if (embebido) return null;
    return <Alert tone="info">Las imágenes del tomógrafo aún no están publicadas para esta clínica.</Alert>;
  }

  if (!data.disponible) {
    return (
      <Alert tone="offline">
        El servidor de imágenes de {clinica} no responde ahora.{" "}
        <button onClick={recargar} className="font-medium underline">
          Reintentar
        </button>
      </Alert>
    );
  }

  if (!data.estudios.length) {
    if (embebido) return null;
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
        No hay estudios de imágenes asociados a esta atención.
      </div>
    );
  }

  if (abierto) {
    return <EstudioDetalle estudio={abierto} onVolver={() => setAbierto(null)} onCompartir={onCompartir} />;
  }

  return (
    <div className="space-y-3">
      {!embebido ? null : <h3 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-indigo-600">Imágenes PACS</h3>}
      <ul className="space-y-3">
        {data.estudios.map((e) => (
          <li key={e.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-soft sm:p-5">
            <div className="flex items-center gap-4">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Scan className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{e.descripcion}</p>
                <p className="mt-0.5 truncate text-sm text-slate-500">
                  {[e.modalidad, e.fecha ? fechaCorta(e.fecha) : null, e.seriesCount ? `${e.seriesCount} series` : null, e.instanceCount ? `${e.instanceCount} imágenes` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {onCompartir && (
                  <button
                    onClick={() => onCompartir(e)}
                    aria-label={`Compartir ${e.descripcion}`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-50 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    <Link2 className="size-4" />
                  </button>
                )}
                <button
                  onClick={() => setAbierto(e)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-50 px-3 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
                >
                  <ImageIcon className="size-4" /> Ver
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EstudioDetalle({
  estudio,
  onVolver,
  onCompartir,
}: {
  estudio: PacsEstudio;
  onVolver: () => void;
  onCompartir?: (e: PacsEstudio) => void;
}) {
  const [series, setSeries] = useState<PacsSerie[] | null>(null);
  const [archivos, setArchivos] = useState<PacsArchivo[] | null>(null);
  const [serieActiva, setSerieActiva] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    setError(null);
    Promise.all([
      api<{ series: PacsSerie[] }>(`/pacs/estudios/${encodeURIComponent(estudio.id)}/series`),
      api<{ archivos: PacsArchivo[] }>(`/pacs/estudios/${encodeURIComponent(estudio.id)}/archivos`),
    ])
      .then(([s, a]) => {
        if (cancel) return;
        setSeries(s.series);
        setArchivos(a.archivos);
        const principal = seriePrincipal(s.series);
        setSerieActiva(principal?.id || s.series[0]?.id || null);
      })
      .catch((err) => {
        if (!cancel) setError(mensajeError(err));
      })
      .finally(() => {
        if (!cancel) setCargando(false);
      });
    return () => {
      cancel = true;
    };
  }, [estudio.id]);

  const archivosSerie = useMemo(() => {
    if (!archivos || !serieActiva) return [];
    const deSerie = archivos.filter((a) => a.seriesUid === serieActiva);
    return deSerie.length ? deSerie : archivos;
  }, [archivos, serieActiva]);

  const serieMeta = series?.find((s) => s.id === serieActiva) || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onVolver} className="text-sm font-medium text-slate-500 hover:text-ink">
          ← Volver a estudios
        </button>
        {onCompartir && (
          <button
            onClick={() => onCompartir(estudio)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-50 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <Link2 className="size-4" /> Compartir
          </button>
        )}
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
        <h3 className="text-[15px] font-semibold">{estudio.descripcion}</h3>
        <p className="mt-1 text-sm text-slate-500">{[estudio.modalidad, estudio.fecha ? fechaCorta(estudio.fecha) : null].filter(Boolean).join(" · ")}</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {cargando ? (
        <Cargando>
          <Skeleton className="h-64 w-full rounded-3xl" />
        </Cargando>
      ) : (
        <>
          {series && series.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {series.map((s) => (
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
                  {s.instanceCount ? ` · ${s.instanceCount}` : ""}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-soft sm:p-5">
            {archivosSerie.length ? (
              <PacsSerieViewer
                estudioId={estudio.id}
                archivos={archivosSerie}
                modality={serieMeta?.modality || estudio.modalidad}
                titulo={`${estudio.descripcion}-${serieMeta?.description || serieMeta?.number || "serie"}`}
              />
            ) : (
              <p className="text-sm text-slate-500">No hay imágenes para esta serie.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
