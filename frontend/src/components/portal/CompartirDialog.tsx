"use client";

import { Check, Copy, Link2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { api, mensajeError } from "@/lib/api";

type Props = {
  idAtencion: string;
  alcance: "pacs_estudio" | "adjunto" | "pdf_atencion";
  recursoId?: string;
  titulo: string;
  onCerrar: () => void;
};

export function CompartirDialog({ idAtencion, alcance, recursoId, titulo, onCerrar }: Props) {
  const [horas, setHoras] = useState(48);
  const [url, setUrl] = useState<string | null>(null);
  const [expiraEn, setExpiraEn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  async function crear() {
    setOcupado(true);
    setError(null);
    try {
      const r = await api<{ url: string; expiraEn: string }>(`/atenciones/${encodeURIComponent(idAtencion)}/compartir`, {
        method: "POST",
        body: { alcance, recursoId, horas },
      });
      setUrl(r.url);
      setExpiraEn(r.expiraEn);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No pudimos copiar el link. Seleccionalo manualmente.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-modal aria-labelledby="compartir-titulo">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-lift sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="compartir-titulo" className="flex items-center gap-2 text-[15px] font-semibold">
              <Link2 className="size-4 text-brand-600" /> Compartir con link temporal
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Vas a compartir: <span className="font-semibold text-ink">{titulo}</span>
            </p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <X className="size-5" />
          </button>
        </div>

        {!url ? (
          <div className="mt-5 space-y-4">
            <label className="block text-sm">
              <span className="font-medium text-slate-600">Válido por</span>
              <select
                value={horas}
                onChange={(e) => setHoras(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value={24}>24 horas</option>
                <option value={48}>48 horas</option>
                <option value={72}>3 días</option>
                <option value={168}>7 días</option>
              </select>
            </label>
            <p className="text-xs text-slate-400">Cualquiera con el link podrá ver este recurso hasta que expire. No incluye el resto de tu historia.</p>
            {error && <Alert tone="error">{error}</Alert>}
            <button
              onClick={crear}
              disabled={ocupado}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {ocupado ? "Generando…" : "Crear link"}
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <Alert tone="success">Link listo. Copialo y envialo a quien quieras.</Alert>
            <div className="flex gap-2">
              <input readOnly value={url} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
              <button
                onClick={copiar}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-50 px-3 text-sm font-medium text-brand-700 hover:bg-brand-100"
              >
                {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
            {expiraEn && (
              <p className="text-xs text-slate-400">
                Expira el{" "}
                {new Date(expiraEn).toLocaleString("es-AR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
            {error && <Alert tone="error">{error}</Alert>}
          </div>
        )}
      </div>
    </div>
  );
}
