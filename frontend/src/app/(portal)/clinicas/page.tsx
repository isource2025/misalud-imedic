"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { Building2, CheckCircle2, Clock3, RefreshCw, SearchX } from "lucide-react";
import { useState } from "react";
import { Cascada, itemCascada } from "@/components/portal/Intro";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton, Cargando } from "@/components/ui/Skeleton";
import { api, mensajeError } from "@/lib/api";
import { fechaLarga } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { BusquedaClinica, ClinicaVinculo } from "@/lib/types";

const ESTADO = {
  vinculada: { label: "Vinculada", tone: "green" as const, Icon: CheckCircle2 },
  pendiente: { label: "En revisión", tone: "amber" as const, Icon: Clock3 },
  sin_registros: { label: "Sin registros", tone: "slate" as const, Icon: SearchX },
};

export default function ClinicasPage() {
  const { data, error, cargando, setData } = useApi<{ clinicas: ClinicaVinculo[] }>("/vinculos");
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<{ tone: "success" | "error" | "offline"; msg: string } | null>(null);

  async function buscar() {
    setBuscando(true);
    setAviso(null);
    try {
      const r = await api<{ resultado: BusquedaClinica[]; clinicas: ClinicaVinculo[] }>("/vinculos/buscar", { method: "POST" });
      setData({ clinicas: r.clinicas });
      const caidas = r.resultado.filter((x) => !x.disponible);
      setAviso(
        caidas.length
          ? { tone: "offline", msg: `${caidas.map((c) => c.nombre).join(", ")} no respondió. Probá de nuevo más tarde.` }
          : { tone: "success", msg: "Listo. Revisamos todas las clínicas habilitadas." }
      );
    } catch (err) {
      setAviso({ tone: "error", msg: mensajeError(err) });
    } finally {
      setBuscando(false);
    }
  }

  return (
    <Cascada className="space-y-6">
      <motion.div variants={itemCascada} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight">Mis clínicas</h1>
          <p className="mt-1 max-w-xl text-slate-500">Las clínicas iMedic habilitadas donde encontramos tu historia clínica con tu DNI.</p>
        </div>
        <Button variant="secondary" onClick={buscar} loading={buscando}>
          {!buscando && <RefreshCw className="size-4" />} Buscar de nuevo
        </Button>
      </motion.div>

      {aviso && <Alert tone={aviso.tone}>{aviso.msg}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <motion.div variants={itemCascada} className="grid gap-4 sm:grid-cols-2">
        {cargando || buscando ? (
          <Cargando>
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
                  <div className="flex items-center gap-4">
                    <Skeleton className="size-12 rounded-2xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-3.5 w-1/3" />
                    </div>
                  </div>
                  <Skeleton className="mt-6 h-3.5 w-3/4" />
                </div>
              ))}
            </div>
          </Cargando>
        ) : (
          data?.clinicas.map((c, i) => {
            const e = ESTADO[c.estado];
            return (
              <motion.article
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.06 } }}
                className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft"
              >
                <div className="flex items-center gap-4">
                  <span className={clsx("inline-flex size-12 items-center justify-center rounded-2xl", c.estado === "vinculada" ? "bg-brand-50 text-brand-600" : "bg-slate-50 text-slate-400")}>
                    <Building2 className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold tracking-tight">{c.nombre}</h2>
                    <Badge tone={e.tone} className="mt-1">
                      <e.Icon className="size-3" /> {e.label}
                    </Badge>
                  </div>
                </div>
                <p className="mt-5 text-sm text-slate-500">
                  {c.estado === "vinculada"
                    ? `${c.fichasConfirmadas === 1 ? "1 ficha" : `${c.fichasConfirmadas} fichas`} con tu DNI${c.verificadoEn ? ` · desde el ${fechaLarga(c.verificadoEn)}` : ""}.`
                    : c.estado === "pendiente"
                      ? "Encontramos una ficha con tu DNI pero faltan datos para confirmar que sos vos. La revisa el equipo de la clínica."
                      : "No encontramos atenciones con tu DNI en esta clínica."}
                </p>
              </motion.article>
            );
          })
        )}
      </motion.div>
    </Cascada>
  );
}
