const parse = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

export const fechaLarga = (iso: string | null | undefined) =>
  iso ? parse(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : "";

export const fechaCorta = (iso: string | null | undefined) =>
  iso ? parse(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }).replace(".", "") : "";

export const diaMes = (iso: string) => {
  const d = parse(iso);
  return {
    dia: d.toLocaleDateString("es-AR", { day: "2-digit" }),
    mes: d.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""),
    anio: d.getFullYear(),
  };
};

export function haceCuanto(iso: string) {
  const dias = Math.round((Date.now() - parse(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.round(dias / 365);
  return `hace ${anios} ${anios === 1 ? "año" : "años"}`;
}

export const duracionDias = (desde: string, hasta: string | null) =>
  hasta ? Math.max(1, Math.round((parse(hasta).getTime() - parse(desde).getTime()) / 86_400_000)) : null;

export const saludo = () => {
  const h = new Date().getHours();
  return h < 12 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
};

export const formatearDni = (dni: string) => dni.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
