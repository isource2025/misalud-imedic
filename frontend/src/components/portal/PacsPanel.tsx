"use client";

import clsx from "clsx";
import { Download, ImageIcon, Link2, RotateCw, Scan } from "lucide-react";
import { useEffect, useState } from "react";
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
};

export function PacsPanel({ data, error, cargando, recargar, clinica, onCompartir }: Props) {
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
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [bajando, setBajando] = useState<string | null>(null);

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

  async function bajar(a: PacsArchivo) {
    setBajando(a.id);
    setError(null);
    try {
      await api<{ disponible: boolean }>(`/pacs/estudios/${encodeURIComponent(estudio.id)}/disponible`);
      const link = document.createElement("a");
      link.href = `/api/pacs/archivos/${encodeURIComponent(a.id)}`;
      link.download = a.nombre;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTimeout(() => setBajando(null), 500);
    }
  }

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
        <p className="mt-1 text-sm text-slate-500">
          {[estudio.modalidad, estudio.fecha ? fechaCorta(estudio.fecha) : null].filter(Boolean).join(" · ")}
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {cargando ? (
        <Cargando>
          <Skeleton className="h-24 w-full rounded-3xl" />
        </Cargando>
      ) : (
        <>
          {series && series.length > 0 && (
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-600">Series</h4>
              <ul className="mt-3 space-y-2">
                {series.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700">
                      {s.number}. {s.description || s.modality || "Serie"}
                    </span>
                    <span className="text-slate-400">{s.instanceCount ? `${s.instanceCount} img.` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-600">Imágenes DICOM</h4>
            {!archivos?.length ? (
              <p className="mt-3 text-sm text-slate-500">No se listaron archivos para este estudio.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-50">
                {archivos.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{a.nombre}</span>
                    <button
                      onClick={() => bajar(a)}
                      disabled={bajando === a.id}
                      className={clsx(
                        "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition",
                        "bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-60"
                      )}
                    >
                      {bajando === a.id ? <RotateCw className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                      Descargar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
