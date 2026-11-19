"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, MailCheck, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import clsx from "clsx";
import { AuthShell } from "./AuthShell";
import { Stepper } from "./Stepper";
import { IdentidadStep } from "./IdentidadStep";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { OtpInput } from "@/components/ui/OtpInput";
import { Segmented } from "@/components/ui/Segmented";
import { api, ApiError, mensajeError } from "@/lib/api";
import { borrarPendiente, guardarPendiente, leerPendiente } from "@/lib/session";

const PASOS = ["Tus datos", "Email", "Identidad"];

function fuerza(pw: string) {
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.2 } },
};

export function RegistroView() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [form, setForm] = useState({ dni: "", sexo: "F" as "F" | "M" | "X", nombreCompleto: "", email: "", telefono: "", password: "" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [codigoDemo, setCodigoDemo] = useState<string | undefined>();
  const [emailMostrado, setEmailMostrado] = useState("");
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const p = leerPendiente();
      if (!p) return;
      setForm((f) => ({ ...f, dni: p.dni }));
      setEmailMostrado(p.emailEnmascarado || "");
      setCodigoDemo(p.codigoDemo);
      setPaso(1);
      setEspera(60);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function enviarDatos(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setErrores({});
    setEnviando(true);
    try {
      const r = await api<{ codigoDemo?: string }>("/auth/registro", { method: "POST", body: form });
      guardarPendiente({ dni: form.dni, emailEnmascarado: form.email, codigoDemo: r.codigoDemo });
      setCodigoDemo(r.codigoDemo);
      setEmailMostrado(form.email);
      setEspera(60);
      setPaso(1);
    } catch (err) {
      if (err instanceof ApiError && err.campos) setErrores(err.campos);
      else setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  async function verificarCodigo(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api("/auth/email/verificar", { method: "POST", body: { dni: form.dni, codigo } });
      borrarPendiente();
      setPaso(2);
    } catch (err) {
      setError(mensajeError(err));
      setCodigo("");
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    setError(null);
    try {
      const r = await api<{ codigoDemo?: string }>("/auth/email/enviar-codigo", { method: "POST", body: { dni: form.dni } });
      setCodigoDemo(r.codigoDemo);
      setEspera(60);
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  const f = fuerza(form.password);

  return (
    <AuthShell>
      <div className="mb-8">
        {paso < 2 && (
          <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-ink">
            <ArrowLeft className="size-4" /> Volver
          </Link>
        )}
        <Stepper pasos={PASOS} actual={paso} />
      </div>

      <AnimatePresence mode="wait">
        {paso === 0 && (
          <motion.form key="datos" {...slide} onSubmit={enviarDatos} className="space-y-4" noValidate>
            <div className="mb-6">
              <h1 className="text-[28px] font-semibold tracking-tight">Creá tu cuenta</h1>
              <p className="mt-1.5 text-slate-500">Usá los datos tal como figuran en tu DNI.</p>
            </div>
            <Field label="DNI" inputMode="numeric" placeholder="Sin puntos" value={form.dni} onChange={set("dni")} error={errores.dni} autoComplete="username" />
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-slate-600">Sexo (como figura en el DNI)</span>
              <Segmented
                ariaLabel="Sexo"
                value={form.sexo}
                onChange={(v) => setForm((x) => ({ ...x, sexo: v }))}
                options={[
                  { value: "F", label: "Femenino" },
                  { value: "M", label: "Masculino" },
                  { value: "X", label: "X" },
                ]}
                className="w-full"
              />
            </div>
            <Field label="Nombre y apellido" value={form.nombreCompleto} onChange={set("nombreCompleto")} error={errores.nombreCompleto} autoComplete="name" />
            <Field label="Email" type="email" value={form.email} onChange={set("email")} error={errores.email} autoComplete="email" />
            <Field label="Teléfono (opcional)" type="tel" value={form.telefono} onChange={set("telefono")} error={errores.telefono} autoComplete="tel" />
            <div>
              <Field
                label="Contraseña"
                type="password"
                value={form.password}
                onChange={set("password")}
                error={errores.password}
                autoComplete="new-password"
                hint="Mínimo 10 caracteres."
              />
              {form.password && (
                <div className="mt-2 flex gap-1.5" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={clsx(
                        "h-1 flex-1 rounded-full transition-colors",
                        i < f ? (f <= 1 ? "bg-amber-400" : f === 2 ? "bg-brand-400" : "bg-emerald-500") : "bg-slate-100"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={enviando}>
              Continuar
            </Button>
            <p className="pt-2 text-center text-sm text-slate-500">
              ¿Ya tenés cuenta?{" "}
              <Link href="/" className="font-semibold text-brand-600">
                Ingresá
              </Link>
            </p>
          </motion.form>
        )}

        {paso === 1 && (
          <motion.form key="codigo" {...slide} onSubmit={verificarCodigo} className="space-y-6">
            <div>
              <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <MailCheck className="size-7" />
              </span>
              <h1 className="text-[28px] font-semibold tracking-tight">Revisá tu email</h1>
              <p className="mt-1.5 text-slate-500">
                Te enviamos un código de 6 dígitos{emailMostrado ? <> a <b className="font-semibold text-ink">{emailMostrado}</b></> : null}. Vence en 10
                minutos.
              </p>
            </div>
            {codigoDemo && (
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-4 py-3 text-sm text-brand-800">
                <Sparkles className="size-4 text-brand-500" /> Modo demo: tu código es <b className="font-mono tracking-widest">{codigoDemo}</b>
              </div>
            )}
            <OtpInput value={codigo} onChange={setCodigo} error={Boolean(error)} autoFocus />
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={enviando} disabled={codigo.length !== 6}>
              Verificar email
            </Button>
            <p className="text-center text-sm text-slate-500">
              ¿No te llegó?{" "}
              {espera > 0 ? (
                <span className="tabular-nums">Podés pedir otro en {espera} s</span>
              ) : (
                <button type="button" onClick={reenviar} className="font-semibold text-brand-600">
                  Reenviar código
                </button>
              )}
            </p>
          </motion.form>
        )}

        {paso === 2 && (
          <motion.div key="identidad" {...slide}>
            <IdentidadStep dni={form.dni} onListo={() => router.push("/inicio")} />
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
