"use client";

import { useCallback, useEffect, useState } from "react";
import { api, mensajeError } from "./api";

type Resultado<T> = { key: string | null; data: T | null; error: string | null };

/** GET con estado de carga/error. `path` null = no cargar todavía. */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const key = path ? `${path}#${version}` : null;
  const [res, setRes] = useState<Resultado<T>>({ key: null, data: null, error: null });

  useEffect(() => {
    if (!path || !key) return;
    const ctrl = new AbortController();
    api<T>(path, { signal: ctrl.signal })
      .then((data) => setRes({ key, data, error: null }))
      .catch((err) => {
        if (!ctrl.signal.aborted) setRes({ key, data: null, error: mensajeError(err) });
      });
    return () => ctrl.abort();
  }, [path, key]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((data: T) => setRes((r) => ({ ...r, data })), []);
  const cargando = Boolean(key) && res.key !== key;

  return { data: cargando ? null : res.data, error: cargando ? null : res.error, cargando, recargar, setData };
}
