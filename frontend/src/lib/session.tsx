"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { Cuenta } from "./types";

type Ctx = {
  cuenta: Cuenta | null;
  cargando: boolean;
  setCuenta: (c: Cuenta) => void;
  salir: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children, requiereIdentidad = true }: { children: ReactNode; requiereIdentidad?: boolean }) {
  const router = useRouter();
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    api<{ cuenta: Cuenta }>("/auth/me")
      .then(({ cuenta }) => {
        if (!vivo) return;
        if (requiereIdentidad && !cuenta.identidadVerificada) {
          router.replace("/identidad");
          return;
        }
        setCuenta(cuenta);
        setCargando(false);
      })
      .catch((err) => {
        if (!vivo) return;
        if (err instanceof ApiError && err.status === 401) router.replace("/");
        else setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [router, requiereIdentidad]);

  const salir = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    sessionStorage.removeItem("ms_intro");
    router.replace("/");
  }, [router]);

  return <SessionContext.Provider value={{ cuenta, cargando, setCuenta, salir }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession fuera de SessionProvider");
  return ctx;
}

/** Datos de un registro o login a medio verificar, para retomar el paso del código. */
export type Pendiente = { dni: string; emailEnmascarado?: string; codigoDemo?: string };
export const guardarPendiente = (p: Pendiente) => sessionStorage.setItem("ms_pendiente", JSON.stringify(p));
export const leerPendiente = (): Pendiente | null => {
  try {
    return JSON.parse(sessionStorage.getItem("ms_pendiente") || "null");
  } catch {
    return null;
  }
};
export const borrarPendiente = () => sessionStorage.removeItem("ms_pendiente");
