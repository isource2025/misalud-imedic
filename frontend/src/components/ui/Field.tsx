"use client";

import clsx from "clsx";
import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  icon?: ReactNode;
};

export function Field({ label, error, hint, icon, className, type, ...rest }: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-slate-600">
        {label}
      </label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
        <input
          id={id}
          type={isPassword && visible ? "text" : type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
          {...rest}
          className={clsx(
            "h-12 w-full rounded-2xl border bg-white px-4 text-[15px] text-ink placeholder:text-slate-400 transition-all outline-none",
            "focus:border-brand-500 focus:ring-4 focus:ring-brand-100",
            icon && "pl-11",
            isPassword && "pr-12",
            error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200 hover:border-slate-300"
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-err`} className="text-[13px] text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="text-[13px] text-slate-500">{hint}</p>
      )}
    </div>
  );
}
