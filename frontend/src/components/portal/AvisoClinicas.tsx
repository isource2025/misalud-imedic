import { Alert } from "@/components/ui/Alert";
import type { ClinicaRef } from "@/lib/types";

export function AvisoClinicas({ clinicas, onReintentar }: { clinicas: ClinicaRef[]; onReintentar?: () => void }) {
  if (!clinicas.length) return null;
  const nombres = clinicas.map((c) => c.nombre).join(", ");
  return (
    <Alert tone="offline">
      <span>
        <b className="font-semibold">{nombres}</b> {clinicas.length === 1 ? "no está disponible" : "no están disponibles"} ahora. Te mostramos lo que llegó del resto.
      </span>
      {onReintentar && (
        <button onClick={onReintentar} className="ml-2 font-semibold underline underline-offset-2">
          Reintentar
        </button>
      )}
    </Alert>
  );
}
