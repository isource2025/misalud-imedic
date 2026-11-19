import { Suspense } from "react";
import { DetalleAtencion, DetalleSkeleton } from "@/components/portal/DetalleAtencion";

export default function Page({ params }: PageProps<"/atenciones/[id]">) {
  return <Suspense fallback={<DetalleSkeleton />}>{params.then(({ id }) => <DetalleAtencion id={id} />)}</Suspense>;
}
