import type { PacsArchivo, PacsSerie } from "@/lib/types";

/** ¿Este .dcm pertenece a la serie? Soporta SeriesUID/… y StudyUID/SeriesUID/…. */
export function archivoPerteneceASerie(a: PacsArchivo, serieId: string): boolean {
  const sid = String(serieId || "").trim();
  if (!sid) return false;
  if (a.seriesUid && String(a.seriesUid).trim() === sid) return true;
  const ruta = (a.ruta || a.nombre || "").replace(/\\/g, "/").trim();
  if (!ruta) return false;
  if (ruta === sid || ruta.startsWith(`${sid}/`)) return true;
  if (ruta.includes(`/${sid}/`)) return true;
  return ruta.split("/").filter(Boolean).includes(sid);
}

export function filtrarArchivosDeSerie(archivos: PacsArchivo[], serieId: string | null): PacsArchivo[] {
  if (!serieId) return [];
  return archivos.filter((a) => archivoPerteneceASerie(a, serieId));
}

export function seriePrincipal(series: PacsSerie[], archivos?: PacsArchivo[]) {
  const utiles = series.filter((s) => {
    const d = `${s.description || ""} ${s.modality || ""}`.toUpperCase();
    return !/DOSE|INFORME|SAVED STATE|LOCALIZER|SCOUT/.test(d);
  });
  const pool = utiles.length ? utiles : series;
  const conArchivos = archivos?.length
    ? pool.filter((s) => archivos.some((a) => archivoPerteneceASerie(a, s.id)))
    : pool;
  const candidatos = conArchivos.length ? conArchivos : pool;
  return [...candidatos].sort((a, b) => (b.instanceCount || 0) - (a.instanceCount || 0))[0] || null;
}
