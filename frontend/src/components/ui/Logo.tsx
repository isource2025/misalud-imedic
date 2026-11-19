import clsx from "clsx";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "relative inline-flex items-center justify-center rounded-[30%] bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,.7)]",
        className ?? "size-9"
      )}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="size-[62%]" fill="none">
        <path d="M13 6h6v7h7v6h-7v7h-6v-7H6v-6h7z" fill="currentColor" opacity=".22" />
        <path d="M4 17h6l2.5-5 4 9 3-6.5 1.5 2.5H28" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="text-[19px] font-semibold tracking-tight text-ink">
          Mi<span className="text-brand-600">Salud</span>
        </span>
      )}
    </span>
  );
}
