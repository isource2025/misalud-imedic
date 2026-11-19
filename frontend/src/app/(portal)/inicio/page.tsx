"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Building2, CalendarDays, FileText, ShieldCheck, Stethoscope } from "lucide-react";
import { AtencionCard } from "@/components/portal/AtencionCard";
import { AvisoClinicas } from "@/components/portal/AvisoClinicas";
import { Cascada, itemCascada } from "@/components/portal/Intro";
import { Alert } from "@/components/ui/Alert";
import { Skeleton, SkeletonCard, Cargando } from "@/components/ui/Skeleton";
import { fechaLarga, haceCuanto, saludo } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { useSession } from "@/lib/session";
import type { AtencionesResponse, ClinicaVinculo } from "@/lib/types";

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Stethoscope; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
      <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="size-5" />
      </span>
      <p className="mt-4 text-[13px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
      <Skeleton className="size-10 rounded-2xl" />
      <Skeleton className="mt-4 h-3 w-1/2" />
      <Skeleton className="mt-2 h-6 w-1/3" />
    </div>
  );
}

export default function InicioPage() {
  const { cuenta } = useSession();
  const at = useApi<AtencionesResponse>("/atenciones");
  const vin = useApi<{ clinicas: ClinicaVinculo[] }>("/vinculos");

  const atenciones = at.data?.atenciones ?? [];
  const ultima = atenciones[0];
  const vinculadas = vin.data?.clinicas.filter((c) => c.estado === "vinculada") ?? [];
  const conEpicrisis = atenciones.filter((a) => a.secciones.epicrisis).length;

  return (
    <Cascada className="space-y-8">
      <motion.section variants={itemCascada}>
        {cuenta ? (
          <>
            <p className="text-sm font-medium text-brand-600">{saludo()}</p>
            <h1 className="mt-1 text-[34px] font-semibold leading-tight tracking-tight sm:text-[40px]">Hola, {cuenta.nombre}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-slate-500">
              <ShieldCheck className="size-4 text-emerald-500" /> Identidad validada con RENAPER
            </p>
          </>
        ) : (
          <Cargando>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-10 w-64" />
            <Skeleton className="mt-3 h-4 w-56" />
          </Cargando>
        )}
      </motion.section>

      {at.data && (
        <motion.div variants={itemCascada}>
          <AvisoClinicas clinicas={at.data.clinicasNoDisponibles} onReintentar={at.recargar} />
        </motion.div>
      )}

      <motion.section variants={itemCascada} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {at.cargando || vin.cargando ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <Stat icon={Stethoscope} label="Atenciones" value={atenciones.length} sub="En todas tus clínicas" />
            <Stat icon={Building2} label="Clínicas vinculadas" value={vinculadas.length} sub={vinculadas.map((c) => c.nombre).join(" · ")} />
            <Stat icon={FileText} label="Epicrisis" value={conEpicrisis} sub="Disponibles para leer" />
            <Stat icon={CalendarDays} label="Última atención" value={ultima ? haceCuanto(ultima.fechaIngreso) : "—"} sub={ultima ? fechaLarga(ultima.fechaIngreso) : undefined} />
          </>
        )}
      </motion.section>

      <motion.section variants={itemCascada}>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Últimas atenciones</h2>
          <Link href="/atenciones" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
            Ver todas <ArrowRight className="size-4" />
          </Link>
        </div>
        {at.error && <Alert tone="error">{at.error}</Alert>}
        {at.cargando ? (
          <Cargando>
            <div className="grid gap-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </Cargando>
        ) : atenciones.length ? (
          <div className="grid gap-3">
            {atenciones.slice(0, 3).map((a) => (
              <AtencionCard key={a.id} a={a} />
            ))}
          </div>
        ) : (
          !at.error && (
            <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
              Todavía no encontramos atenciones con tu DNI.{" "}
              <Link href="/clinicas" className="font-semibold text-brand-600">
                Buscar de nuevo
              </Link>
            </div>
          )
        )}
      </motion.section>

      <motion.section variants={itemCascada}>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Tus clínicas</h2>
        <div className="flex flex-wrap gap-2.5">
          {vin.cargando
            ? [0, 1].map((i) => <Skeleton key={i} className="h-12 w-40 rounded-2xl" />)
            : vin.data?.clinicas.map((c) => (
                <Link
                  key={c.id}
                  href="/clinicas"
                  className="inline-flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm font-medium shadow-soft transition hover:border-brand-100"
                >
                  <span className={`size-2 rounded-full ${c.estado === "vinculada" ? "bg-emerald-500" : c.estado === "pendiente" ? "bg-amber-400" : "bg-slate-300"}`} />
                  {c.nombre}
                </Link>
              ))}
        </div>
      </motion.section>
    </Cascada>
  );
}
