"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { IdentidadStep } from "@/components/auth/IdentidadStep";
import { Skeleton, SkeletonText, Cargando } from "@/components/ui/Skeleton";
import { SessionProvider, useSession } from "@/lib/session";

function Contenido() {
  const router = useRouter();
  const { cuenta, cargando } = useSession();

  useEffect(() => {
    if (cuenta?.identidadVerificada) router.replace("/inicio");
  }, [cuenta, router]);

  if (cargando || !cuenta) {
    return (
      <Cargando>
        <Skeleton className="mx-auto mb-6 size-20 rounded-full" />
        <Skeleton className="mx-auto h-7 w-2/3" />
        <SkeletonText lines={2} className="mt-4" />
        <Skeleton className="mt-8 h-16 w-full rounded-2xl" />
        <Skeleton className="mt-3 h-13 w-full rounded-2xl" />
      </Cargando>
    );
  }
  return <IdentidadStep dni={cuenta.dni} onListo={() => router.push("/inicio")} />;
}

export default function Page() {
  return (
    <SessionProvider requiereIdentidad={false}>
      <AuthShell>
        <Contenido />
      </AuthShell>
    </SessionProvider>
  );
}
