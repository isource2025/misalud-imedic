"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import { motion } from "motion/react";

export function Stepper({ pasos, actual }: { pasos: string[]; actual: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Pasos del registro">
      {pasos.map((p, i) => {
        const hecho = i < actual;
        const activo = i === actual;
        return (
          <li key={p} className="flex flex-1 flex-col gap-2" aria-current={activo ? "step" : undefined}>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-brand-600"
                initial={false}
                animate={{ width: hecho ? "100%" : activo ? "50%" : "0%" }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className={clsx("flex items-center gap-1.5 text-xs font-medium", activo || hecho ? "text-brand-700" : "text-slate-400")}>
              {hecho && <Check className="size-3.5" />}
              {p}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
