"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Building2, RefreshCw, Stethoscope } from "lucide-react";
import { useState } from "react";
import { AvisoClinicas } from "@/components/portal/AvisoClinicas";
import { Cascada, itemCascada } from "@/components/portal/Intro";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Skeleton, Cargando } from "@/components/ui/Skeleton";
import { api, mensajeError } from "@/lib/api";
import { cantidadAtenciones, clinicasConAtenciones, SIN_ATENCIONES } from "@/lib/clinicas";
import { fechaLarga, haceCuanto } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { AtencionesResponse } from "@/lib/types";

export default function ClinicasPage() {
  const { data, error, cargando, recargar } = useApi<AtencionesResponse>("/atenciones");
  const [actualizando, setActualizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const clinicas = clinicasConAtenciones(data?.atenciones ?? []);

  async function actualizar() {
    setActualizando(true);
    setAviso(null);
    try {
      await api("/vinculos/buscar", { method: "POST" });
      recargar();
    } catch (err) {
      setAviso(mensajeError(err));
    } finally {
      setActualizando(false);
    }
  }

  return (
    <Cascada className="space-y-6">
      <motion.div variants={itemCascada} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight">Mis clínicas</h1>
          <p className="mt-1 max-w-xl text-slate-500">Las clínicas iMedic donde te atendiste.</p>
        </div>
        <Button variant="secondary" onClick={actualizar} loading={actualizando}>
          {!actualizando && <RefreshCw className="size-4" />} Actualizar
        </Button>
      </motion.div>

      {aviso && <Alert tone="error">{aviso}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {data && <AvisoClinicas clinicas={data.clinicasNoDisponibles} onReintentar={recargar} />}

      <motion.div variants={itemCascada}>
        {cargando || actualizando ? (
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
        ) : clinicas.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {clinicas.map((c, i) => (
              <motion.article
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.06 } }}
                className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft"
              >
                <div className="flex items-center gap-4">
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <Building2 className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold tracking-tight">{c.nombre}</h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                      <Stethoscope className="size-3.5" /> {cantidadAtenciones(c.cantidad)}
                    </p>
                  </div>
                </div>
                <p className="mt-5 text-sm text-slate-500">
                  Última atención: <b className="font-semibold text-ink">{fechaLarga(c.ultima)}</b> ({haceCuanto(c.ultima)})
                </p>
              </motion.article>
            ))}
          </div>
        ) : (
          !error && (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-200 p-12 text-center">
              <Building2 className="size-10 text-slate-300" />
              <p className="mt-3 font-medium">{SIN_ATENCIONES}</p>
              <p className="mt-1 text-sm text-slate-500">Cuando te atiendas en una clínica iMedic, la vas a ver acá.</p>
              <Link href="/inicio" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                Volver al inicio <ArrowRight className="size-4" />
              </Link>
            </div>
          )
        )}
      </motion.div>
    </Cascada>
  );
}
