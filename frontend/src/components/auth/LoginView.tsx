"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { IdCard, Lock, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AuthShell } from "./AuthShell";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { api, ApiError, mensajeError } from "@/lib/api";
import { guardarPendiente } from "@/lib/session";
import { useDemo } from "@/lib/useDemo";
import type { Cuenta } from "@/lib/types";

type LoginResp = { cuenta?: Cuenta; requiereVerificacionEmail?: boolean; emailEnmascarado?: string; codigoDemo?: string };

export function LoginView() {
  const router = useRouter();
  const demo = useDemo();
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r = await api<LoginResp>("/auth/login", { method: "POST", body: { dni, password } });
      if (r.requiereVerificacionEmail) {
        guardarPendiente({ dni, emailEnmascarado: r.emailEnmascarado, codigoDemo: r.codigoDemo });
        router.push("/registro");
        return;
      }
      sessionStorage.removeItem("ms_intro");
      router.push(r.cuenta?.identidadVerificada ? "/inicio" : "/identidad");
    } catch (err) {
      setError(err instanceof ApiError && err.code === "VALIDACION" ? Object.values(err.campos || {})[0] || err.message : mensajeError(err));
      setEnviando(false);
    }
  }

  return (
    <AuthShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight">Hola de nuevo</h1>
        <p className="mt-2 text-slate-500">Ingresá con tu DNI para ver tu información de salud.</p>

        {demo && (
          <button
            type="button"
            onClick={() => {
              setDni("30123456");
              setPassword("MiSalud2026!");
            }}
            className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-4 py-3 text-left text-sm text-brand-800 transition hover:bg-brand-50"
          >
            <Sparkles className="size-4 shrink-0 text-brand-500" />
            <span>
              <b className="font-semibold">Modo demo.</b> DNI 30123456 · contraseña MiSalud2026! <span className="text-brand-500">(tocá para completar)</span>
            </span>
          </button>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          <Field
            label="DNI"
            inputMode="numeric"
            autoComplete="username"
            placeholder="Sin puntos"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/[^\d.]/g, ""))}
            icon={<IdCard className="size-[18px]" />}
            required
          />
          <Field
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="size-[18px]" />}
            required
          />
          <div className="flex justify-end">
            <Link href="/recuperar" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" size="lg" className="w-full" loading={enviando} disabled={!dni || !password}>
            Ingresar
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          ¿Primera vez en MiSalud?{" "}
          <Link href="/registro" className="font-semibold text-brand-600 hover:text-brand-700">
            Creá tu cuenta
          </Link>
        </p>
      </motion.div>
    </AuthShell>
  );
}
