"use client";

import clsx from "clsx";
import { useRef } from "react";

type Props = { value: string; onChange: (v: string) => void; length?: number; error?: boolean; autoFocus?: boolean };

export function OtpInput({ value, onChange, length = 6, error, autoFocus }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const setAt = (i: number, d: string) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join("").slice(0, length));
  };

  return (
    <div className="flex justify-between gap-2 sm:gap-3" role="group" aria-label="Código de verificación">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          maxLength={1}
          value={d}
          aria-label={`Dígito ${i + 1}`}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (!v) return setAt(i, "");
            if (v.length > 1) {
              onChange((value.slice(0, i) + v).slice(0, length));
              refs.current[Math.min(length - 1, i + v.length)]?.focus();
              return;
            }
            setAt(i, v);
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i]) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft") refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight") refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            const v = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            if (!v) return;
            e.preventDefault();
            onChange(v);
            refs.current[Math.min(length - 1, v.length)]?.focus();
          }}
          className={clsx(
            "h-14 w-full min-w-0 rounded-2xl border bg-white text-center text-2xl font-semibold tabular-nums text-ink outline-none transition-all sm:h-16",
            "focus:border-brand-500 focus:ring-4 focus:ring-brand-100",
            error ? "border-red-300" : d ? "border-brand-300 bg-brand-50/40" : "border-slate-200"
          )}
        />
      ))}
    </div>
  );
}
