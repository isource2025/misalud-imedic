"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Building2, Home, LogOut, Stethoscope, UserRound } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/lib/session";

const NAV = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/atenciones", label: "Atenciones", icon: Stethoscope },
  { href: "/clinicas", label: "Clínicas", icon: Building2 },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

type NavProps = { pathname?: string };
const esActivo = (pathname: string | undefined, href: string) => Boolean(pathname && (pathname === href || pathname.startsWith(`${href}/`)));

function DesktopNav({ pathname }: NavProps) {
  return (
    <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Principal">
      {NAV.map((n) => {
        const activo = esActivo(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={activo ? "page" : undefined}
            className={clsx("relative rounded-xl px-3.5 py-2 text-sm font-medium transition-colors", activo ? "text-brand-700" : "text-slate-500 hover:text-ink")}
          >
            {activo && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-brand-50" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNav({ pathname }: NavProps) {
  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 rounded-3xl border border-slate-100 bg-white/90 p-1.5 shadow-[0_12px_40px_-12px_rgba(15,23,42,.25)] backdrop-blur-xl md:hidden"
      aria-label="Principal"
    >
      {NAV.map((n) => {
        const activo = esActivo(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={activo ? "page" : undefined}
            className={clsx("relative flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-medium", activo ? "text-brand-700" : "text-slate-400")}
          >
            {activo && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-2xl bg-brand-50" />}
            <n.icon className="relative size-5" />
            <span className="relative">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ConRuta({ children }: { children: (pathname: string) => ReactNode }) {
  return <>{children(usePathname())}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { cuenta, salir } = useSession();

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#f5f8ff_0px,#ffffff_420px)]">
      <header className="sticky top-0 z-40 border-b border-slate-100/80 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-5">
          <Link href="/inicio" aria-label="Inicio">
            <Logo />
          </Link>
          <Suspense fallback={<DesktopNav />}>
            <ConRuta>{(p) => <DesktopNav pathname={p} />}</ConRuta>
          </Suspense>
          <div className="ml-auto flex items-center gap-2">
            {cuenta ? (
              <Link
                href="/perfil"
                className="flex size-9 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white"
                aria-label="Mi perfil"
              >
                {iniciales(cuenta.nombreCompleto)}
              </Link>
            ) : (
              <Skeleton className="size-9 rounded-full" />
            )}
            <button
              onClick={salir}
              className="hidden rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink md:inline-flex"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="size-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 pb-28 pt-8 md:pb-16 md:pt-10">{children}</main>

      <Suspense fallback={<MobileNav />}>
        <ConRuta>{(p) => <MobileNav pathname={p} />}</ConRuta>
      </Suspense>
    </div>
  );
}
