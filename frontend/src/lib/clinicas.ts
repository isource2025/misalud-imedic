import type { Atencion } from "./types";

export type ClinicaConAtenciones = { id: number; nombre: string; cantidad: number; ultima: string };

/** Clínicas donde el paciente se atendió, de la más reciente a la más antigua. */
export function clinicasConAtenciones(atenciones: Atencion[]): ClinicaConAtenciones[] {
  const porClinica = new Map<number, ClinicaConAtenciones>();
  for (const a of atenciones) {
    const c = porClinica.get(a.clinica.id);
    if (!c) porClinica.set(a.clinica.id, { id: a.clinica.id, nombre: a.clinica.nombre, cantidad: 1, ultima: a.fechaIngreso });
    else {
      c.cantidad += 1;
      if (a.fechaIngreso > c.ultima) c.ultima = a.fechaIngreso;
    }
  }
  return [...porClinica.values()].sort((a, b) => b.ultima.localeCompare(a.ultima));
}

export const cantidadAtenciones = (n: number) => (n === 1 ? "1 atención" : `${n} atenciones`);

export const SIN_ATENCIONES = "Todavía no tenés atenciones registradas en clínicas iMedic.";
