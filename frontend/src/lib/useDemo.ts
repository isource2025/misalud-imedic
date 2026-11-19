"use client";

import { useEffect, useState } from "react";

/** true si el back corre en MOCK_MODE (para mostrar las credenciales y códigos de demostración). */
export function useDemo() {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((h) => setDemo(Boolean(h?.mock)))
      .catch(() => {});
  }, []);
  return demo;
}
