"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BadgeCheck, LogOut, Mail, Phone } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Cascada, itemCascada } from "@/components/portal/Intro";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Skeleton, Cargando } from "@/components/ui/Skeleton";
import { api, ApiError, mensajeError } from "@/lib/api";
import { fechaLarga, formatearDni } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Cuenta } from "@/lib/types";

function Fila({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-[15px] font-medium">{children}</span>
    </div>
  );
}

export default function PerfilPage() {
  const router = useRouter();
  const { cuenta, setCuenta, salir } = useSession();
  const [telefono, setTelefono] = useState<string | null>(null);
  const [pw, setPw] = useState({ actual: "", nueva: "" });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string; donde: "tel" | "pw" } | null>(null);
  const [guardando, setGuardando] = useState<"tel" | "pw" | null>(null);

  async function guardarTelefono(e: FormEvent) {
    e.preventDefault();
    setGuardando("tel");
    setMsg(null);
    try {
      const r = await api<{ cuenta: Cuenta }>("/auth/contacto", { method: "PUT", body: { telefono: telefono ?? "" } });
      setCuenta(r.cuenta);
      setTelefono(null);
      setMsg({ tone: "success", text: "Teléfono actualizado.", donde: "tel" });
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof ApiError && err.campos?.telefono ? err.campos.telefono : mensajeError(err), donde: "tel" });
    } finally {
      setGuardando(null);
    }
  }

  async function cambiarPassword(e: FormEvent) {
    e.preventDefault();
    setGuardando("pw");
    setMsg(null);
    try {
      await api("/auth/password", { method: "PUT", body: pw });
      sessionStorage.removeItem("ms_intro");
      router.replace("/");
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof ApiError && err.campos?.nueva ? err.campos.nueva : mensajeError(err), donde: "pw" });
      setGuardando(null);
    }
  }

  return (
    <Cascada className="space-y-6">
      <motion.h1 variants={itemCascada} className="text-[32px] font-semibold tracking-tight">
        Mi perfil
      </motion.h1>

      <motion.section variants={itemCascada} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
        {!cuenta ? (
          <Cargando>
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </Cargando>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <span className="flex size-16 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-700 text-xl font-semibold text-white">
                {cuenta.nombreCompleto
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")}
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{cuenta.nombreCompleto}</h2>
                <Badge tone="green" className="mt-1">
                  <BadgeCheck className="size-3.5" /> Identidad validada · RENAPER
                </Badge>
              </div>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              <Fila label="DNI">{formatearDni(cuenta.dni)}</Fila>
              {cuenta.fechaNacimiento && <Fila label="Fecha de nacimiento">{fechaLarga(cuenta.fechaNacimiento)}</Fila>}
              <Fila label="Email">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-4 text-slate-400" /> {cuenta.email}
                </span>
              </Fila>
              <Fila label="Miembro desde">{fechaLarga(cuenta.creadoEn)}</Fila>
            </div>
          </>
        )}
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.form variants={itemCascada} onSubmit={guardarTelefono} className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Phone className="size-5 text-brand-600" /> Teléfono
          </h2>
          <p className="text-sm text-slate-500">La verificación por SMS o WhatsApp llega en la próxima versión.</p>
          <Field label="Número" type="tel" value={telefono ?? cuenta?.telefono ?? ""} onChange={(e) => setTelefono(e.target.value)} placeholder="+54 9 ..." />
          {msg?.donde === "tel" && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <Button type="submit" variant="secondary" loading={guardando === "tel"} disabled={telefono === null}>
            Guardar teléfono
          </Button>
        </motion.form>

        <motion.form variants={itemCascada} onSubmit={cambiarPassword} className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold tracking-tight">Cambiar contraseña</h2>
          <p className="text-sm text-slate-500">Al cambiarla cerramos todas tus sesiones abiertas.</p>
          <Field label="Contraseña actual" type="password" autoComplete="current-password" value={pw.actual} onChange={(e) => setPw((p) => ({ ...p, actual: e.target.value }))} />
          <Field label="Nueva contraseña" type="password" autoComplete="new-password" value={pw.nueva} onChange={(e) => setPw((p) => ({ ...p, nueva: e.target.value }))} hint="Mínimo 10 caracteres." />
          {msg?.donde === "pw" && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <Button type="submit" loading={guardando === "pw"} disabled={!pw.actual || pw.nueva.length < 10}>
            Cambiar contraseña
          </Button>
        </motion.form>
      </div>

      <motion.div variants={itemCascada}>
        <Button variant="ghost" onClick={salir} className="text-red-600 hover:bg-red-50 hover:text-red-700">
          <LogOut className="size-4" /> Cerrar sesión
        </Button>
      </motion.div>
    </Cascada>
  );
}
