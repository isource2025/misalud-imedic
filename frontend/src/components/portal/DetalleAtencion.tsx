"use client";

import clsx from "clsx";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Building2, CalendarDays, ClipboardList, FileText, Paperclip, Stethoscope, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AdjuntosPanel } from "./AdjuntosPanel";
import { ICONO_TIPO, TONO_TIPO } from "./AtencionCard";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Skeleton, SkeletonText, Cargando } from "@/components/ui/Skeleton";
import { duracionDias, fechaLarga } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { AdjuntosResponse, AtencionDetalle, Diagnostico } from "@/lib/types";

type Tab = "resumen" | "hc" | "diagnostico" | "epicrisis" | "adjuntos";

export function DetalleSkeleton() {
  return (
    <Cargando>
      <Skeleton className="h-5 w-40" />
      <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
        <div className="flex gap-4">
          <Skeleton className="size-14 rounded-2xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="mt-6 h-11 w-full rounded-2xl sm:w-[420px]" />
      <div className="mt-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
        <SkeletonText lines={5} />
      </div>
    </Cargando>
  );
}

function Dato({ icon: Icon, label, children }: { icon: typeof CalendarDays; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 truncate text-[15px] font-medium">{children || "—"}</p>
    </div>
  );
}

function Bloque({ titulo, children, meta }: { titulo: string; children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft sm:p-7">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-brand-600">{titulo}</h3>
        {meta && <span className="text-xs text-slate-400">{meta}</span>}
      </div>
      <div className="whitespace-pre-line text-[15px] leading-7 text-slate-700">{children}</div>
    </div>
  );
}

function DiagnosticoCard({ titulo, d }: { titulo: string; d: Diagnostico }) {
  return (
    <div className="flex items-start gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-soft sm:p-6">
      <span className="rounded-xl bg-brand-50 px-2.5 py-1.5 font-mono text-sm font-semibold text-brand-700">{d.codigo || "s/c"}</span>
      <div>
        <p className="text-xs font-medium text-slate-400">{titulo}</p>
        <p className="mt-0.5 text-[15px] font-medium">{d.descripcion || "Sin descripción"}</p>
      </div>
    </div>
  );
}

const Vacio = ({ children }: { children: ReactNode }) => (
  <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">{children}</div>
);

export function DetalleAtencion({ id }: { id: string }) {
  const { data: a, error, cargando } = useApi<AtencionDetalle>(`/atenciones/${encodeURIComponent(id)}`);
  const adj = useApi<AdjuntosResponse>(a ? `/atenciones/${encodeURIComponent(id)}/adjuntos` : null);
  const [tab, setTab] = useState<Tab>("resumen");
  const tablist = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tablist.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [tab]);

  if (cargando) return <DetalleSkeleton />;
  if (error || !a) {
    return (
      <div className="space-y-6">
        <Link href="/atenciones" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-ink">
          <ArrowLeft className="size-4" /> Mis atenciones
        </Link>
        <Alert tone={error?.includes("disponible") ? "offline" : "error"}>{error || "Atención no encontrada"}</Alert>
      </div>
    );
  }

  const Icono = ICONO_TIPO[a.tipo];
  const dias = duracionDias(a.fechaIngreso, a.fechaEgreso);
  const hc = a.hcIngreso[0];
  const tabs: { id: Tab; label: string; disabled?: boolean; count?: number }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "hc", label: "Historia de ingreso", disabled: !a.hcIngreso.length },
    { id: "diagnostico", label: "Diagnóstico", disabled: !a.diagnostico && !a.diagnosticoEgreso },
    { id: "epicrisis", label: "Epicrisis", disabled: !a.epicrisis.length },
    { id: "adjuntos", label: "Estudios y adjuntos", count: adj.data?.adjuntos.length },
  ];
  const cantAdjuntos = adj.data?.adjuntos.length ?? 0;

  return (
    <div className="space-y-6">
      <Link href="/atenciones" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-ink">
        <ArrowLeft className="size-4" /> Mis atenciones
      </Link>

      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-soft sm:p-7"
      >
        <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full bg-brand-50 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <span className={clsx("inline-flex size-14 shrink-0 items-center justify-center rounded-2xl", TONO_TIPO[a.tipo])}>
            <Icono className="size-7" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="blue">{a.tipoLabel}</Badge>
              {a.secciones.epicrisis && (
                <Badge tone="green">
                  <FileText className="size-3" /> Epicrisis
                </Badge>
              )}
            </div>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">{a.servicio || a.tipoLabel}</h1>
            <p className="mt-1 text-slate-500">{fechaLarga(a.fechaIngreso)}</p>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-slate-100 pt-5 sm:grid-cols-3">
          <Dato icon={Building2} label="Clínica">{a.clinica.nombre}</Dato>
          <Dato icon={CalendarDays} label={a.fechaEgreso ? "Ingreso / egreso" : "Fecha"}>
            {a.fechaEgreso ? `${a.fechaIngreso.slice(8, 10)}/${a.fechaIngreso.slice(5, 7)} – ${a.fechaEgreso.slice(8, 10)}/${a.fechaEgreso.slice(5, 7)}${dias ? ` (${dias} d)` : ""}` : `${a.fechaIngreso.slice(8, 10)}/${a.fechaIngreso.slice(5, 7)}/${a.fechaIngreso.slice(0, 4)}${a.horaIngreso ? ` · ${a.horaIngreso}` : ""}`}
          </Dato>
          <Dato icon={UserRound} label="Profesional">{a.profesional}</Dato>
        </div>
      </motion.header>

      <div className="-mx-5 overflow-x-auto px-5">
        <div ref={tablist} role="tablist" aria-label="Secciones" className="inline-flex min-w-full gap-1 rounded-2xl bg-slate-100/80 p-1 sm:min-w-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              disabled={t.disabled}
              onClick={() => setTab(t.id)}
              className={clsx(
                "relative flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:text-slate-300",
                tab === t.id ? "text-brand-700" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {tab === t.id && <motion.span layoutId="detalle-tab" className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_3px_rgba(15,23,42,.12)]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className="relative">
                {t.label}
                {t.count ? <span className="ml-1.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 tabular-nums">{t.count}</span> : null}
              </span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} className="space-y-4">
          {tab === "resumen" && (
            <>
              {a.diagnostico && <DiagnosticoCard titulo="Diagnóstico de ingreso" d={a.diagnostico} />}
              {hc?.motivoConsulta && (
                <Bloque titulo="Motivo de consulta" meta={hc.profesional || undefined}>
                  {hc.motivoConsulta}
                </Bloque>
              )}
              {a.epicrisis[0]?.texto && (
                <button onClick={() => setTab("epicrisis")} className="flex w-full items-center gap-4 rounded-3xl bg-linear-to-br from-brand-600 to-brand-700 p-5 text-left text-white shadow-lift transition hover:brightness-110 sm:p-6">
                  <FileText className="size-8 shrink-0 opacity-90" />
                  <span>
                    <span className="block font-semibold">Epicrisis disponible</span>
                    <span className="block text-sm text-brand-100">El resumen de tu internación y las indicaciones al alta.</span>
                  </span>
                </button>
              )}
              {cantAdjuntos > 0 && (
                <button onClick={() => setTab("adjuntos")} className="flex w-full items-center gap-4 rounded-3xl border border-brand-100 bg-brand-50/60 p-5 text-left transition hover:bg-brand-50 sm:p-6">
                  <Paperclip className="size-7 shrink-0 text-brand-600" />
                  <span>
                    <span className="block font-semibold text-ink">
                      {cantAdjuntos} {cantAdjuntos === 1 ? "estudio o archivo adjunto" : "estudios o archivos adjuntos"}
                    </span>
                    <span className="block text-sm text-slate-500">Informes, imágenes y documentos de esta atención. Podés verlos o descargarlos.</span>
                  </span>
                </button>
              )}
              {!a.diagnostico && !hc && !a.epicrisis.length && !cantAdjuntos && <Vacio>Esta atención todavía no tiene información clínica publicada.</Vacio>}
            </>
          )}

          {tab === "hc" &&
            a.hcIngreso.map((h, i) => (
              <div key={i} className="space-y-4">
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <ClipboardList className="size-4" /> {fechaLarga(h.fecha)}
                  {h.hora ? ` · ${h.hora}` : ""} {h.profesional ? `· ${h.profesional}` : ""} {h.sector ? `· ${h.sector}` : ""}
                </p>
                {h.motivoConsulta && <Bloque titulo="Motivo de consulta">{h.motivoConsulta}</Bloque>}
                {h.enfermedadActual && <Bloque titulo="Enfermedad actual">{h.enfermedadActual}</Bloque>}
                {h.textos?.map((t) => (
                  <Bloque key={t.titulo} titulo={t.titulo}>
                    {t.texto}
                  </Bloque>
                ))}
                {h.secciones?.map((s) => (
                  <Bloque key={s.titulo} titulo={s.titulo}>
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      {s.campos.map((c, j) => (
                        <div key={j} className="flex flex-wrap gap-x-2 border-b border-slate-50 pb-1.5">
                          <dt className="text-sm font-medium text-slate-500">{c.campo}:</dt>
                          <dd className="whitespace-pre-line text-[15px] text-slate-800">{c.valor}</dd>
                        </div>
                      ))}
                    </dl>
                  </Bloque>
                ))}
                {!h.motivoConsulta && !h.enfermedadActual && !h.textos?.length && !h.secciones?.length && (
                  <Vacio>Esta historia de ingreso no tiene datos cargados.</Vacio>
                )}
              </div>
            ))}

          {tab === "diagnostico" && (
            <>
              {a.diagnostico && <DiagnosticoCard titulo="Diagnóstico de ingreso" d={a.diagnostico} />}
              {a.diagnosticoEgreso && <DiagnosticoCard titulo="Diagnóstico de egreso" d={a.diagnosticoEgreso} />}
              <p className="px-1 text-xs text-slate-400">Códigos según la Clasificación Internacional de Enfermedades (CIE-10).</p>
            </>
          )}

          {tab === "epicrisis" &&
            a.epicrisis.map((e, i) => (
              <div key={i} className="space-y-4">
                <Bloque titulo="Epicrisis" meta={`${fechaLarga(e.fecha)}${e.profesional ? ` · ${e.profesional}` : ""}`}>
                  {e.texto}
                </Bloque>
                {e.diagnostico && <DiagnosticoCard titulo="Diagnóstico al alta" d={e.diagnostico} />}
              </div>
            ))}
          {tab === "adjuntos" && <AdjuntosPanel {...adj} clinica={a.clinica.nombre} />}
        </motion.div>
      </AnimatePresence>

      <p className="flex items-center gap-2 px-1 text-xs text-slate-400">
        <Stethoscope className="size-3.5" /> Información de solo lectura publicada por {a.clinica.nombre}. Ante dudas, consultá a tu médico.
      </p>
    </div>
  );
}
