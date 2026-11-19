"use client";

import { Phone } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { api, ApiError, mensajeError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { ERROR_TELEFONO, telefonoArValido } from "@/lib/telefono";
import type { Cuenta } from "@/lib/types";

/** Las cuentas creadas antes de que el teléfono fuera obligatorio lo cargan acá antes de seguir. */
export function TelefonoRequerido({ children }: { children: ReactNode }) {
  const { cuenta, setCuenta } = useSession();
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (!cuenta || cuenta.telefono) return <>{children}</>;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!telefonoArValido(telefono)) return setError(telefono.trim() ? ERROR_TELEFONO : "Ingresá tu teléfono");
    setError(null);
    setGuardando(true);
    try {
      const r = await api<{ cuenta: Cuenta }>("/auth/contacto", { method: "PUT", body: { telefono } });
      setCuenta(r.cuenta);
    } catch (err) {
      setError(err instanceof ApiError && err.campos?.telefono ? err.campos.telefono : mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="mx-auto max-w-md space-y-5 rounded-3xl border border-slate-100 bg-white p-8 shadow-soft">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Phone className="size-7" />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cargá tu teléfono</h1>
        <p className="mt-1.5 text-slate-500">Lo necesitamos para poder contactarte por tus atenciones. Es un único paso.</p>
      </div>
      <Field label="Teléfono" type="tel" inputMode="tel" placeholder="Ej.: 379 4123456" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" autoFocus />
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={guardando}>
        Guardar y continuar
      </Button>
    </form>
  );
}
