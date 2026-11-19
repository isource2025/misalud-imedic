"use client";

import { motion, useReducedMotion } from "motion/react";
import { Building2, FileHeart, ShieldCheck, Stethoscope } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

const tarjetas = [
  { icon: Stethoscope, titulo: "Clínica médica", sub: "Sanatorio Güemes · Ambulatorio", tono: "bg-brand-50 text-brand-600" },
  { icon: FileHeart, titulo: "Epicrisis disponible", sub: "Sanatorio Sarmiento · Internación", tono: "bg-emerald-50 text-emerald-600" },
  { icon: Building2, titulo: "2 clínicas vinculadas", sub: "Con tu DNI", tono: "bg-sky-50 text-sky-600" },
];

export function AuthShell({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-brand-600 via-brand-700 to-brand-900 p-12 text-white lg:flex lg:flex-col">
        <motion.div
          aria-hidden
          className="absolute -right-32 -top-32 size-[520px] rounded-full bg-brand-400/30 blur-3xl"
          animate={reduce ? undefined : { scale: [1, 1.12, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute -bottom-40 -left-20 size-[460px] rounded-full bg-sky-300/20 blur-3xl"
          animate={reduce ? undefined : { scale: [1.1, 1, 1.1] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative flex items-center gap-2.5">
          <span className="inline-flex size-9 items-center justify-center rounded-[30%] bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <svg viewBox="0 0 32 32" className="size-5" fill="none">
              <path d="M4 17h6l2.5-5 4 9 3-6.5 1.5 2.5H28" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight">MiSalud</span>
        </div>

        <div className="relative mt-auto max-w-md">
          <motion.h2
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-[44px] font-semibold leading-[1.05] tracking-tight"
          >
            Tu historia clínica, en un solo lugar.
          </motion.h2>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-5 text-lg leading-relaxed text-brand-100"
          >
            Consultá tus atenciones, diagnósticos y epicrisis de todas las clínicas iMedic con tu DNI.
          </motion.p>

          <div className="mt-10 space-y-3">
            {tarjetas.map((t, i) => (
              <motion.div
                key={t.titulo}
                initial={reduce ? false : { opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.55, delay: 0.25 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-3.5 rounded-2xl bg-white/95 p-3.5 pr-5 text-ink shadow-[0_20px_40px_-20px_rgba(0,0,0,.45)]"
                style={{ marginLeft: i * 28 }}
              >
                <span className={`inline-flex size-10 items-center justify-center rounded-xl ${t.tono}`}>
                  <t.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{t.titulo}</span>
                  <span className="block text-xs text-slate-500">{t.sub}</span>
                </span>
              </motion.div>
            ))}
          </div>

          <p className="mt-12 flex items-center gap-2 text-sm text-brand-200">
            <ShieldCheck className="size-4" /> Identidad validada con RENAPER · Solo lectura
          </p>
        </div>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10 lg:px-16">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-center text-xs text-slate-400">MiSalud · Portal del paciente de iMedic</p>
      </main>
    </div>
  );
}
