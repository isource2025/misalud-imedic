import clsx from "clsx";
import { AlertCircle, CheckCircle2, Info, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

const tones = {
  info: { cls: "bg-brand-50 text-brand-800 ring-brand-100", Icon: Info },
  error: { cls: "bg-red-50 text-red-800 ring-red-100", Icon: AlertCircle },
  success: { cls: "bg-emerald-50 text-emerald-800 ring-emerald-100", Icon: CheckCircle2 },
  offline: { cls: "bg-amber-50 text-amber-900 ring-amber-100", Icon: WifiOff },
};

export function Alert({ tone = "info", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  const { cls, Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={clsx("flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ring-1 ring-inset", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </div>
  );
}
