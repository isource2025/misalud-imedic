"use client";

import clsx from "clsx";
import { Download, Eye, File, FileImage, FileText, Film, Paperclip, RotateCw, ScanLine } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Skeleton, Cargando } from "@/components/ui/Skeleton";
import { api, ApiError, mensajeError } from "@/lib/api";
import { fechaCorta } from "@/lib/format";
import type { Adjunto, AdjuntosResponse, TipoAdjunto } from "@/lib/types";

const ICONO: Record<TipoAdjunto, typeof File> = {
  pdf: FileText,
  imagen: FileImage,
  dicom: ScanLine,
  video: Film,
  documento: FileText,
  otro: File,
};

const TONO: Record<TipoAdjunto, string> = {
  pdf: "bg-red-50 text-red-600",
  imagen: "bg-emerald-50 text-emerald-600",
  dicom: "bg-indigo-50 text-indigo-600",
  video: "bg-sky-50 text-sky-600",
  documento: "bg-brand-50 text-brand-600",
  otro: "bg-slate-50 text-slate-600",
};

const archivoUrl = (id: string, descargar: boolean) => `/api/adjuntos/${encodeURIComponent(id)}/archivo${descargar ? "?descargar=1" : ""}`;

/** Confirma sesión (refresca si venció), pertenencia y que el túnel de la clínica responda antes de navegar al archivo. */
async function preparar(id: string) {
  const r = await api<{ disponible: boolean }>(`/adjuntos/${encodeURIComponent(id)}/disponible`);
  if (!r.disponible) throw new ApiError(503, "CLINICA_NO_DISPONIBLE", "La clínica no está respondiendo ahora. Probá de nuevo en unos minutos.");
}

function AdjuntoItem({ a }: { a: Adjunto }) {
  const [ocupado, setOcupado] = useState<"ver" | "bajar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const Icono = ICONO[a.tipo];

  async function ver() {
    setError(null);
    setOcupado("ver");
    // La pestaña se abre en el click (si no, el navegador la bloquea) y recién después se carga el archivo.
    const w = window.open("", "_blank");
    if (w) w.opener = null;
    try {
      await preparar(a.id);
      if (w) w.location.href = archivoUrl(a.id, false);
      else window.location.href = archivoUrl(a.id, false);
    } catch (err) {
      w?.close();
      setError(mensajeError(err));
    } finally {
      setOcupado(null);
    }
  }

  async function bajar() {
    setError(null);
    setOcupado("bajar");
    try {
      await preparar(a.id);
      const link = document.createElement("a");
      link.href = archivoUrl(a.id, true);
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTimeout(() => setOcupado(null), 600);
    }
  }

  return (
    <li className="rounded-3xl border border-slate-100 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex items-center gap-4">
        <span className={clsx("inline-flex size-12 shrink-0 items-center justify-center rounded-2xl", TONO[a.tipo])}>
          <Icono className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold" title={a.nombre}>
            {a.nombre}
          </p>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {[a.categoria, a.fecha ? fechaCorta(a.fecha) : null, a.extension?.toUpperCase()].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {a.vistaPrevia && (
            <button
              onClick={ver}
              disabled={ocupado !== null}
              aria-label={`Ver ${a.nombre}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-50 px-3 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
            >
              {ocupado === "ver" ? <RotateCw className="size-4 animate-spin" /> : <Eye className="size-4" />}
              <span className="hidden sm:inline">Ver</span>
            </button>
          )}
          <button
            onClick={bajar}
            disabled={ocupado !== null}
            aria-label={`Descargar ${a.nombre}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 hover:text-ink disabled:opacity-60"
          >
            {ocupado === "bajar" ? <RotateCw className="size-4 animate-spin" /> : <Download className="size-4" />}
            <span className="hidden sm:inline">Descargar</span>
          </button>
        </div>
      </div>
      {error && (
        <Alert tone={/respond|disponible/i.test(error) ? "offline" : "error"} className="mt-3">
          {error}
        </Alert>
      )}
    </li>
  );
}

export function AdjuntosSkeleton() {
  return (
    <Cargando>
      <ul className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
            <Skeleton className="size-12 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3.5 w-1/3" />
            </div>
            <Skeleton className="h-10 w-24 rounded-xl" />
          </li>
        ))}
      </ul>
    </Cargando>
  );
}

export function AdjuntosPanel({
  data,
  error,
  cargando,
  recargar,
  clinica,
}: {
  data: AdjuntosResponse | null;
  error: string | null;
  cargando: boolean;
  recargar: () => void;
  clinica: string;
}) {
  if (cargando) return <AdjuntosSkeleton />;
  if (error) {
    return (
      <Alert tone={error.includes("disponible") ? "offline" : "error"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={recargar} className="inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline">
            <RotateCw className="size-3.5" /> Reintentar
          </button>
        </div>
      </Alert>
    );
  }
  if (!data?.publicados) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
        {clinica} todavía no publica estudios ni adjuntos en MiSalud.
      </div>
    );
  }
  if (!data.adjuntos.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
        <Paperclip className="mx-auto mb-2 size-6 text-slate-300" aria-hidden />
        Esta atención no tiene estudios ni archivos adjuntos.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {data.adjuntos.map((a) => (
          <AdjuntoItem key={a.id} a={a} />
        ))}
      </ul>
      <p className="px-1 text-xs text-slate-400">
        Los archivos se abren desde los servidores de {clinica} cada vez que los pedís; los enlaces no sirven fuera de tu sesión.
      </p>
    </div>
  );
}
