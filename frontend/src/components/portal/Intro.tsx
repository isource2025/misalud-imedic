"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";

const IntroContext = createContext({ listo: true });
export const useIntro = () => useContext(IntroContext);

const DURACION_MS = 1250;

/** Animación de entrada al portal (una vez por sesión del navegador, < 1,5 s, respeta "reducir movimiento"). */
export function IntroProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      const ya = sessionStorage.getItem("ms_intro") === "1";
      if (ya || reduce) return setVisible(false);
      sessionStorage.setItem("ms_intro", "1");
      setVisible(true);
      t = setTimeout(() => setVisible(false), DURACION_MS);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [reduce]);

  return (
    <IntroContext.Provider value={{ listo: visible === false }}>
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            key="intro"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white"
            exit={{ opacity: 0, transition: { duration: 0.35, ease: "easeOut" } }}
            aria-hidden
          >
            {visible && (
              <motion.div className="flex flex-col items-center" exit={{ y: -24, scale: 0.96, transition: { duration: 0.35 } }}>
                <motion.div
                  initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className="relative"
                >
                  <motion.span
                    className="absolute inset-0 rounded-[30%] bg-brand-400"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 2.1, opacity: 0 }}
                    transition={{ duration: 1, delay: 0.25, ease: "easeOut" }}
                  />
                  <LogoMark className="size-20" />
                </motion.div>
                <svg viewBox="0 0 220 40" className="mt-6 h-8 w-56 text-brand-500" fill="none">
                  <motion.path
                    d="M0 22h70l10-14 14 26 12-20 8 8h106"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.15, ease: "easeInOut" }}
                  />
                </svg>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.4 }}
                  className="mt-3 text-2xl font-semibold tracking-tight"
                >
                  Mi<span className="text-brand-600">Salud</span>
                </motion.p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </IntroContext.Provider>
  );
}

const contenedor = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
export const itemCascada = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

/** Contenedor cuyos hijos `motion` con variants={itemCascada} entran en cascada cuando termina la intro. */
export function Cascada({ children, className }: { children: ReactNode; className?: string }) {
  const { listo } = useIntro();
  return (
    <motion.div variants={contenedor} initial="hidden" animate={listo ? "show" : "hidden"} className={className}>
      {children}
    </motion.div>
  );
}
