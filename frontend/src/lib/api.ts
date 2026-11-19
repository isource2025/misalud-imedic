"use client";

export class ApiError extends Error {
  status: number;
  code: string;
  campos?: Record<string, string>;
  constructor(status: number, code: string, message: string, campos?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.campos = campos;
  }
}

const SAFE = new Set(["GET", "HEAD"]);

function leerCookie(nombre: string) {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${nombre}=`))
    ?.slice(nombre.length + 1);
}

async function csrfToken() {
  const actual = leerCookie("ms_csrf");
  if (actual) return decodeURIComponent(actual);
  const r = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  const body = await r.json();
  return body.csrfToken as string;
}

let refreshing: Promise<boolean> | null = null;

async function refrescar() {
  refreshing ??= (async () => {
    try {
      const r = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-csrf-token": await csrfToken() },
      });
      return r.ok;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

type Opciones = { method?: string; body?: unknown; signal?: AbortSignal; reintento?: boolean };

export async function api<T>(path: string, { method = "GET", body, signal, reintento = true }: Opciones = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (!SAFE.has(method)) headers["x-csrf-token"] = await csrfToken();

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: "no-store",
  });

  if (res.status === 401 && reintento && !path.startsWith("/auth/login") && !path.startsWith("/auth/refresh")) {
    if (await refrescar()) return api<T>(path, { method, body, signal, reintento: false });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error || {};
    throw new ApiError(res.status, e.code || "ERROR", e.message || "No pudimos completar la operación.", e.campos);
  }
  return data as T;
}

export const mensajeError = (err: unknown) =>
  err instanceof ApiError ? err.message : "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.";
