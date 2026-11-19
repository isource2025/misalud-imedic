"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { SearchX, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { AtencionCard } from "@/components/portal/AtencionCard";
import { AvisoClinicas } from "@/components/portal/AvisoClinicas";
import { Cascada, itemCascada } from "@/components/portal/Intro";
import { Alert } from "@/components/ui/Alert";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton, SkeletonCard, Cargando } from "@/components/ui/Skeleton";
import { useApi } from "@/lib/useApi";
import type { AtencionesResponse, TipoAtencion } from "@/lib/types";

type FiltroTipo = "todos" | Exclude<TipoAtencion, "otro">;

export default function AtencionesPage() {
  const [clinica, setClinica] = useState<number | null>(null);
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (clinica) p.set("clinica", String(clinica));
    if (tipo !== "todos") p.set("tipo", tipo);
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    const s = p.toString();
    return `/atenciones${s ? `?${s}` : ""}`;
  }, [clinica, tipo, desde, hasta]);

  const { data, error, cargando, recargar } = useApi<AtencionesResponse>(query);
  const todas = useApi<AtencionesResponse>("/atenciones");
  const clinicas = todas.data?.clinicas ?? [];

  const porAnio = useMemo(() => {
    const grupos = new Map<number, AtencionesResponse["atenciones"]>();
    for (const a of data?.atenciones ?? []) {
      const y = Number(a.fechaIngreso.slice(0, 4));
      if (!grupos.has(y)) grupos.set(y, []);
      grupos.get(y)!.push(a);
    }
    return [...grupos.entries()];
  }, [data]);

  const hayFiltros = clinica || tipo !== "todos" || desde || hasta;

  return (
    <Cascada className="space-y-6">
      <motion.div variants={itemCascada}>
        <h1 className="text-[32px] font-semibold tracking-tight">Mis atenciones</h1>
        <p className="mt-1 text-slate-500">Todas tus consultas, internaciones y estudios, de todas las clínicas.</p>
      </motion.div>

      <motion.div variants={itemCascada} className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <SlidersHorizontal className="size-4" /> Filtros
          {hayFiltros && (
            <button
              onClick={() => {
                setClinica(null);
                setTipo("todos");
                setDesde("");
                setHasta("");
              }}
              className="ml-auto text-xs font-semibold text-brand-600"
            >
              Limpiar
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Clínica">
          {todas.cargando ? (
            <>
              <Skeleton className="h-9 w-20 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </>
          ) : (
            [{ id: null as number | null, nombre: "Todas" }, ...clinicas].map((c) => (
              <button
                key={c.id ?? "todas"}
                onClick={() => setClinica(c.id)}
                aria-pressed={clinica === c.id}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  clinica === c.id ? "bg-brand-600 text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,.9)]" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                )}
              >
                {c.nombre}
              </button>
            ))
          )}
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="overflow-x-auto">
            <Segmented
              ariaLabel="Tipo de atención"
              value={tipo}
              onChange={setTipo}
              options={[
                { value: "todos", label: "Todas" },
                { value: "ambulatorio", label: "Ambulatorio" },
                { value: "internacion", label: "Internación" },
                { value: "hospital_dia", label: "Hospital de día" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <label className="sr-only" htmlFor="desde">Desde</label>
            <input id="desde" type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-600 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
            <span className="text-slate-300">—</span>
            <label className="sr-only" htmlFor="hasta">Hasta</label>
            <input id="hasta" type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-600 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
          </div>
        </div>
      </motion.div>

      {data && <AvisoClinicas clinicas={data.clinicasNoDisponibles} onReintentar={recargar} />}
      {error && <Alert tone="error">{error}</Alert>}

      <motion.div variants={itemCascada}>
        {cargando ? (
          <Cargando>
            <Skeleton className="mb-4 h-5 w-16" />
            <div className="grid gap-3">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </Cargando>
        ) : porAnio.length ? (
          <div className="space-y-8">
            {porAnio.map(([anio, items]) => (
              <section key={anio} className="relative">
                <h2 className="sticky top-16 z-10 -mx-1 mb-3 inline-flex rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-slate-500 backdrop-blur">
                  {anio} · {items.length} {items.length === 1 ? "atención" : "atenciones"}
                </h2>
                <div className="relative grid gap-3 border-l-2 border-dashed border-brand-100 pl-4 sm:pl-6">
                  <AnimatePresence initial={false}>
                    {items.map((a, i) => (
                      <motion.div
                        key={a.id}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 6) * 0.04 } }}
                        className="relative"
                      >
                        <span className="absolute -left-[23px] top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-white bg-brand-500 shadow sm:-left-[31px]" />
                        <AtencionCard a={a} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            ))}
          </div>
        ) : (
          !error && (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-200 p-12 text-center">
              <SearchX className="size-10 text-slate-300" />
              <p className="mt-3 font-medium">No hay atenciones {hayFiltros ? "con esos filtros" : "todavía"}</p>
              <p className="mt-1 text-sm text-slate-500">{hayFiltros ? "Probá cambiando o limpiando los filtros." : todas.data?.clinicas.length
                  ? `Tu ficha está vinculada en ${todas.data.clinicas.map((c) => c.nombre).join(" y ")}, pero todavía no tiene atenciones registradas.`
                  : "Cuando te atiendas en una clínica iMedic, aparecerá acá."}</p>
            </div>
          )
        )}
      </motion.div>
    </Cascada>
  );
}
