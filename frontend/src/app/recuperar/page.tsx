"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CheckCircle2, KeyRound, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { OtpInput } from "@/components/ui/OtpInput";
import { api, ApiError, mensajeError } from "@/lib/api";

export default function Page() {
  const [paso, setPaso] = useState<"dni" | "codigo" | "listo">("dni");
  const [dni, setDni] = useState("");
  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [codigoDemo, setCodigoDemo] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function pedir(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r = await api<{ codigoDemo?: string }>("/auth/password/olvide", { method: "POST", body: { dni } });
      setCodigoDemo(r.codigoDemo);
      setPaso("codigo");
    } catch (err) {
      setError(err instanceof ApiError && err.campos?.dni ? err.campos.dni : mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  async function restablecer(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api("/auth/password/reset", { method: "POST", body: { dni, codigo, password } });
      setPaso("listo");
    } catch (err) {
      setError(err instanceof ApiError && err.campos ? Object.values(err.campos)[0] : mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthShell>
      <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-ink">
        <ArrowLeft className="size-4" /> Volver
      </Link>
      <AnimatePresence mode="wait">
        {paso === "dni" && (
          <motion.form key="dni" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={pedir} className="space-y-5">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <KeyRound className="size-7" />
            </span>
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight">Restablecer contraseña</h1>
              <p className="mt-1.5 text-slate-500">Ingresá tu DNI y te enviamos un código al email registrado.</p>
            </div>
            <Field label="DNI" inputMode="numeric" value={dni} onChange={(e) => setDni(e.target.value)} placeholder="Sin puntos" />
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={enviando} disabled={!dni}>
              Enviar código
            </Button>
          </motion.form>
        )}
        {paso === "codigo" && (
          <motion.form key="codigo" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={restablecer} className="space-y-5">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight">Ingresá el código</h1>
              <p className="mt-1.5 text-slate-500">Si el DNI tiene una cuenta, te llegó un código de 6 dígitos. Vence en 10 minutos.</p>
            </div>
            {codigoDemo && (
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-4 py-3 text-sm text-brand-800">
                <Sparkles className="size-4 text-brand-500" /> Modo demo: código <b className="font-mono tracking-widest">{codigoDemo}</b>
              </div>
            )}
            <OtpInput value={codigo} onChange={setCodigo} autoFocus />
            <Field label="Nueva contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Mínimo 10 caracteres." autoComplete="new-password" />
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={enviando} disabled={codigo.length !== 6 || password.length < 10}>
              Guardar contraseña
            </Button>
          </motion.form>
        )}
        {paso === "listo" && (
          <motion.div key="listo" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <CheckCircle2 className="mx-auto mb-5 size-16 text-emerald-500" />
            <h1 className="text-[28px] font-semibold tracking-tight">Contraseña actualizada</h1>
            <p className="mt-2 text-slate-500">Cerramos todas tus sesiones por seguridad. Ingresá con tu nueva contraseña.</p>
            <Link href="/" className="mt-8 inline-flex h-13 w-full items-center justify-center rounded-2xl bg-brand-600 font-medium text-white hover:bg-brand-700">
              Ir a ingresar
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
