import { Suspense } from "react";
import { CompartidoClient, CompartidoSkeleton } from "@/components/compartido/CompartidoClient";

export default function Page({ params }: PageProps<"/c/[token]">) {
  return <Suspense fallback={<CompartidoSkeleton />}>{params.then(({ token }) => <CompartidoClient token={token} />)}</Suspense>;
}
