import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx("relative overflow-hidden rounded-xl bg-slate-100", className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx("flex flex-col gap-2.5", className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={clsx("h-3.5", i === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={clsx("rounded-3xl border border-slate-100 bg-white p-5 shadow-soft", className)} aria-hidden>
      <div className="flex items-start gap-4">
        <Skeleton className="size-14 shrink-0 rounded-2xl" />
        <div className="flex-1 space-y-3 pt-1">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3.5 w-4/5" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Para lectores de pantalla: anuncia que hay contenido cargando. */
export function Cargando({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}
