import clsx from "clsx";
import Link from "next/link";
import { BedDouble, CalendarClock, ChevronRight, FileText, Paperclip, Stethoscope, Sun } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { diaMes, duracionDias } from "@/lib/format";
import type { Atencion, TipoAtencion } from "@/lib/types";

export const ICONO_TIPO: Record<TipoAtencion, typeof Stethoscope> = {
  ambulatorio: Stethoscope,
  internacion: BedDouble,
  hospital_dia: Sun,
  otro: CalendarClock,
};

export const TONO_TIPO: Record<TipoAtencion, string> = {
  ambulatorio: "bg-brand-50 text-brand-600",
  internacion: "bg-indigo-50 text-indigo-600",
  hospital_dia: "bg-sky-50 text-sky-600",
  otro: "bg-slate-50 text-slate-600",
};

export function AtencionCard({ a, compacta }: { a: Atencion; compacta?: boolean }) {
  const { dia, mes, anio } = diaMes(a.fechaIngreso);
  const Icono = ICONO_TIPO[a.tipo];
  const dias = a.tipo === "internacion" ? duracionDias(a.fechaIngreso, a.fechaEgreso) : null;
  return (
    <Link
      href={`/atenciones/${a.id}`}
      className="group flex items-center gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-soft outline-none transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-100 hover:shadow-lift focus-visible:ring-4 focus-visible:ring-brand-100 sm:p-5"
    >
      <div className="flex w-14 shrink-0 flex-col items-center rounded-2xl bg-slate-50 py-2 text-center ring-1 ring-inset ring-slate-100">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">{mes}</span>
        <span className="text-xl font-semibold leading-tight tabular-nums">{dia}</span>
        <span className="text-[10px] text-slate-400 tabular-nums">{anio}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={clsx("inline-flex size-6 items-center justify-center rounded-lg", TONO_TIPO[a.tipo])}>
            <Icono className="size-3.5" />
          </span>
          <p className="truncate text-[15px] font-semibold">{a.servicio || a.tipoLabel}</p>
        </div>
        <p className="mt-1 truncate text-sm text-slate-500">
          {a.clinica.nombre}
          {a.centro ? ` · ${a.centro}` : ""}
        </p>
        {!compacta && a.diagnostico?.descripcion && <p className="mt-1.5 line-clamp-1 text-sm text-slate-700">{a.diagnostico.descripcion}</p>}
        {!compacta && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Badge tone="slate">
              {a.tipoLabel}
              {dias ? ` · ${dias} ${dias === 1 ? "día" : "días"}` : ""}
            </Badge>
            {a.secciones.epicrisis && (
              <Badge tone="green">
                <FileText className="size-3" /> Epicrisis
              </Badge>
            )}
            {a.secciones.adjuntos > 0 && (
              <Badge tone="blue">
                <Paperclip className="size-3" /> {a.secciones.adjuntos} {a.secciones.adjuntos === 1 ? "adjunto" : "adjuntos"}
              </Badge>
            )}
          </div>
        )}
      </div>
      <ChevronRight className="size-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
    </Link>
  );
}
