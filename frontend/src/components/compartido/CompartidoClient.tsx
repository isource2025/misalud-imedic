"use client";

import { Download, Link2, Scan } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Skeleton, Cargando } from "@/components/ui/Skeleton";

type Meta = { tipo: string; meta: string; expiraEn: string; tieneArchivo: boolean };
type PacsContenido = {
  meta: string;
  series: { id: string; number: number; description: string | null; modality: string | null; instanceCount: number | null }[];
  archivos: { id: string; nombre: string }[];
};

export function CompartidoSkeleton() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 py-10">
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
          if (!cancel) setPacs(cb as PacsContenido);
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

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 py-10">
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
                  Disponible hasta{" "}
                  {new Date(meta.expiraEn).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            </div>
          </div>

          {(meta.tipo === "pdf_atencion" || meta.tipo === "adjunto") && (
            <a
              href={`/api/c/${encodeURIComponent(token)}/contenido`}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <Download className="size-4" />
              {meta.tipo === "pdf_atencion" ? "Ver PDF" : "Abrir archivo"}
            </a>
          )}

          {meta.tipo === "pacs_estudio" && pacs && (
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-600">Imágenes DICOM</h2>
              <ul className="mt-3 divide-y divide-slate-50">
                {pacs.archivos.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.nombre}</span>
                    <a
                      href={`/api/c/${encodeURIComponent(token)}/archivo/${encodeURIComponent(a.id)}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-50 px-3 text-sm font-medium text-brand-700 hover:bg-brand-100"
                    >
                      <Download className="size-3.5" /> Descargar
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-center text-xs text-slate-400">Este link es temporal y de solo lectura. Ante dudas, consultá a tu médico.</p>
        </div>
      )}
    </main>
  );
}
