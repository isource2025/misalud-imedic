import type { Metadata } from "next";
import { RegistroView } from "@/components/auth/RegistroView";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function Page() {
  return <RegistroView />;
}
