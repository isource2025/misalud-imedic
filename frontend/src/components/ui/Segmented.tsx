"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { useId } from "react";

type Opcion<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Opcion<T>[];
  className?: string;
  ariaLabel: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={clsx("inline-flex rounded-2xl bg-slate-100/80 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              "relative flex-1 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
              active ? "text-brand-700" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_3px_rgba(15,23,42,.12)]"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
