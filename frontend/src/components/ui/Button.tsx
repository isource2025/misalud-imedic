"use client";

import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "relative inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-all duration-200 outline-none select-none",
        "focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-not-allowed active:scale-[.98]",
        size === "lg" ? "h-13 px-6 text-[15px]" : "h-11 px-4 text-sm",
        variant === "primary" &&
          "bg-brand-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,.9)] hover:bg-brand-700 disabled:bg-brand-300 disabled:shadow-none",
        variant === "secondary" && "bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-60",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100 hover:text-ink disabled:opacity-50",
        className
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
