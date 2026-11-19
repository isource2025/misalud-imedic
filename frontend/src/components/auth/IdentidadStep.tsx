"use client";

import { AnimatePresence, motion } from "motion/react";
import { Building2, Camera, CheckCircle2, CircleDashed, Fingerprint, ShieldCheck, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Skeleton, Cargando } from "@/components/ui/Skeleton";
import { api, mensajeError } from "@/lib/api";
import { formatearDni } from "@/lib/format";
import type { BusquedaClinica, Cuenta } from "@/lib/types";

const MENSAJES = ["Consultando RENAPER…", "Comparando tus datos…", "Buscando tus atenciones en las clínicas…"];

export function IdentidadStep({ dni, onListo }: { dni: string; onListo: () => void }) {
  const [estado, setEstado] = useState<"inicio" | "verificando" | "listo">("inicio");
  const [error, setError] = useState<string | null>(null);
  const [clinicas, setClinicas] = useState<BusquedaClinica[]>([]);
  const [msg, setMsg] = useState(0);

  useEffect(() => {
    if (estado !== "verificando") return;
    const t = setInterval(() => setMsg((m) => Math.min(m + 1, MENSAJES.length - 1)), 900);
    return () => clearInterval(t);
  }, [estado]);

  async function verificar() {
    setError(null);
    setMsg(0);
    setEstado("verificando");
    try {
      const r = await api<{ cuenta: Cuenta; clinicas: BusquedaClinica[] }>("/auth/identidad/verificar", {
        method: "POST",
        body: { metodo: "renaper_dni" },
      });
      setClinicas(r.clinicas);
      setEstado("listo");
    } catch (err) {
      setError(mensajeError(err));
      setEstado("inicio");
    }
  }

  const vinculadas = clinicas.filter((c) => (c.confirmado ?? 0) > 0);

  return (
    <AnimatePresence mode="wait">
      {estado !== "listo" ? (
        <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          <div className="relative mx-auto mb-6 flex size-20 items-center justify-center">
            {estado === "verificando" && (
              <motion.span
                className="absolute inset-0 rounded-full bg-brand-100"
                animate={{ scale: [1, 1.35, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
            )}
            <span className="relative flex size-20 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Fingerprint className="size-9" />
            </span>
          </div>
          <h1 className="text-center text-[28px] font-semibold tracking-tight">Validá tu identidad</h1>
          <p className="mt-2 text-center text-slate-500">
            Consultamos RENAPER con tu DNI <b className="font-semibold text-ink">{formatearDni(dni)}</b> para confirmar que sos vos antes de mostrarte
            información clínica.
          </p>

          {estado === "verificando" ? (
            <Cargando>
              <div className="mt-8 space-y-3">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={msg}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="text-center text-sm font-medium text-brand-700"
                  >
                    {MENSAJES[msg]}
                  </motion.p>
                </AnimatePresence>
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4">
                    <Skeleton className="size-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </Cargando>
          ) : (
            <div className="mt-8 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border-2 border-brand-500 bg-brand-50/40 p-4">
                <ShieldCheck className="size-5 text-brand-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">RENAPER con número de DNI</p>
                  <p className="text-xs text-slate-500">Validamos nombre y sexo contra el registro nacional.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 opacity-60" aria-disabled>
                <Camera className="size-5 text-slate-400" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Foto del DNI</p>
                  <p className="text-xs text-slate-500">Próximamente</p>
                </div>
              </div>
              {error && <Alert tone="error">{error}</Alert>}
              <Button size="lg" className="mt-2 w-full" onClick={verificar}>
                Validar con RENAPER
              </Button>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div key="ok" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
          >
            <CheckCircle2 className="size-10" />
          </motion.div>
          <h1 className="text-center text-[28px] font-semibold tracking-tight">¡Listo, sos vos!</h1>
          <p className="mt-2 text-center text-slate-500">
            {vinculadas.length
              ? `Encontramos tu ficha de paciente en ${vinculadas.length} ${vinculadas.length === 1 ? "clínica" : "clínicas"}.`
              : "Validamos tu identidad. Todavía no encontramos fichas con tu DNI en las clínicas del portal."}
          </p>
          <ul className="mt-8 space-y-2.5">
            {clinicas.map((c, i) => (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.1 }}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-soft"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Building2 className="size-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{c.nombre}</span>
                  <span className="block text-xs text-slate-500">
                    {!c.disponible
                      ? "No disponible ahora; reintentamos más tarde"
                      : c.confirmado
                        ? "Historia clínica vinculada"
                        : c.pendiente
                          ? "Vínculo en revisión"
                          : "Sin registros con tu DNI"}
                  </span>
                </span>
                {!c.disponible ? (
                  <WifiOff className="size-5 text-amber-500" />
                ) : c.confirmado ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : (
                  <CircleDashed className="size-5 text-slate-300" />
                )}
              </motion.li>
            ))}
          </ul>
          <Button size="lg" className="mt-8 w-full" onClick={onListo}>
            Ir a mi portal
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
