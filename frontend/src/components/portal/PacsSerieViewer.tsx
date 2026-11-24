"use client";

import { Download, Pause, Play, RotateCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { parseDicomFrame, renderDicomFrame, type DicomFrame } from "@/lib/dicomFrame";
import type { PacsArchivo } from "@/lib/types";

const CONCURRENCIA = 3;
const FPS_OPCIONES = [5, 10, 15, 20];
const PRESETS_CT = [
  { id: "blandas", label: "Partes blandas", wc: 40, ww: 400 },
  { id: "pulmon", label: "Pulmón", wc: -600, ww: 1500 },
  { id: "hueso", label: "Hueso", wc: 400, ww: 1800 },
];

function ordenPorNombre(nombre: string) {
  const m = nombre.match(/(\d+)\.dcm$/i);
  return m ? Number(m[1]) : 0;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchConReintento(url: string, signal: AbortSignal, intentos = 4) {
  let espera = 400;
  for (let i = 0; i < intentos; i++) {
    const res = await fetch(url, { credentials: "same-origin", signal, cache: "no-store" });
    if (res.status !== 429 && res.status !== 503) return res;
    if (i === intentos - 1) return res;
    await sleep(espera);
    espera = Math.min(espera * 2, 4000);
  }
  throw new Error("Sin respuesta");
}

type Props = {
  estudioId: string;
  archivos: PacsArchivo[];
  modality: string | null;
  titulo: string;
  /** Prefijo URL del .dcm. Default sesión: `/api/pacs/archivos/`. Público: `/api/c/{token}/archivo/`. */
  archivoBase?: string;
};

export function PacsSerieViewer({ estudioId, archivos, modality, titulo, archivoBase = "/api/pacs/archivos/" }: Props) {
  const urlDe = (id: string) => `${archivoBase}${encodeURIComponent(id)}`;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<(DicomFrame | null)[]>([]);
  const dragRef = useRef<{ x: number; y: number; wc: number; ww: number } | null>(null);

  const [orden, setOrden] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [cargados, setCargados] = useState(0);
  const [fallidos, setFallidos] = useState(0);
  const [errorCarga, setErrorCarga] = useState("");
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(10);
  const [ventana, setVentana] = useState<{ wc: number; ww: number } | null>(null);
  const [exportando, setExportando] = useState(false);

  const total = archivos.length;
  const filesKey = useMemo(() => archivos.map((a) => a.id).join("|"), [archivos]);

  useEffect(() => {
    const controller = new AbortController();
    const lista = archivos;
    const inicial = lista
      .map((f, i) => ({ i, n: ordenPorNombre(f.nombre) }))
      .sort((a, b) => a.n - b.n)
      .map((x) => x.i);

    framesRef.current = lista.map(() => null);
    setOrden(inicial);
    setPos(0);
    setCargados(0);
    setFallidos(0);
    setErrorCarga("");
    setPlaying(false);
    setVentana(null);

    let siguiente = 0;
    let ok = 0;
    let ko = 0;

    const worker = async () => {
      while (!controller.signal.aborted) {
        const j = siguiente++;
        if (j >= inicial.length) return;
        const idx = inicial[j];
        try {
          const res = await fetchConReintento(urlDe(lista[idx].id), controller.signal);
          if (!res.ok) throw new Error(res.status === 429 ? "Demasiados pedidos; reintentá en unos segundos." : `HTTP ${res.status}`);
          const buffer = await res.arrayBuffer();
          const frame = parseDicomFrame(buffer);
          if (controller.signal.aborted) return;
          framesRef.current[idx] = frame;
          ok += 1;
          setCargados(ok);
        } catch (e) {
          if (controller.signal.aborted) return;
          ko += 1;
          setFallidos(ko);
          setErrorCarga(e instanceof Error ? e.message : "Error al cargar una imagen");
        }
      }
    };

    void Promise.all(Array.from({ length: Math.min(CONCURRENCIA, inicial.length || 1) }, worker)).then(() => {
      if (controller.signal.aborted) return;
      const frames = framesRef.current;
      if (!inicial.every((i) => frames[i] == null || frames[i]!.instanceNumber != null)) return;
      setOrden((prev) => [...(prev.length ? prev : inicial)].sort((a, b) => (frames[a]?.instanceNumber ?? 0) - (frames[b]?.instanceNumber ?? 0)));
    });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estudioId, filesKey, archivoBase]);

  const frameActual = orden.length ? framesRef.current[orden[pos]] : null;

  useEffect(() => {
    if (!ventana && frameActual) setVentana({ wc: frameActual.windowCenter, ww: frameActual.windowWidth });
  }, [frameActual, ventana]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frameActual || !ventana) return;
    renderDicomFrame(canvas, frameActual, ventana.wc, ventana.ww);
  }, [frameActual, ventana, cargados, pos, orden]);

  const mover = useCallback(
    (delta: number) => {
      if (!total) return;
      setPos((p) => Math.min(total - 1, Math.max(0, p + delta)));
    },
    [total]
  );

  useEffect(() => {
    if (!playing || !total) return;
    const id = window.setInterval(() => setPos((p) => (p + 1) % total), 1000 / fps);
    return () => window.clearInterval(id);
  }, [playing, fps, total]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setPlaying(false);
      mover(e.deltaY > 0 ? 1 : -1);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [mover]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setPlaying(false);
        mover(1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setPlaying(false);
        mover(-1);
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mover]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ventana) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, wc: ventana.wc, ww: ventana.ww };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const k = Math.max(d.ww / 300, 0.5);
    setVentana({ ww: Math.max(1, d.ww + (e.clientX - d.x) * k), wc: d.wc + (e.clientY - d.y) * k });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  async function descargarVideo() {
    const canvas = canvasRef.current;
    if (!canvas || !orden.length || !ventana) return;
    setExportando(true);
    setPlaying(false);
    setErrorCarga("");
    try {
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";
      if (!mime) throw new Error("Tu navegador no puede exportar video WebM.");

      const stream = canvas.captureStream(0);
      const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      const finished = new Promise<Blob>((resolve, reject) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
        rec.onerror = () => reject(new Error("Falló la grabación del video."));
      });
      rec.start(100);

      const delay = Math.max(40, Math.round(1000 / fps));
      const indices = orden.filter((i) => framesRef.current[i]);
      if (!indices.length) throw new Error("Todavía no hay cortes cargados para armar el video.");
      for (let n = 0; n < indices.length; n++) {
        const frame = framesRef.current[indices[n]]!;
        renderDicomFrame(canvas, frame, ventana.wc, ventana.ww);
        track.requestFrame?.();
        setPos(orden.indexOf(indices[n]));
        await sleep(delay);
      }

      rec.stop();
      stream.getTracks().forEach((t) => t.stop());
      const blob = await finished;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${titulo.replace(/[^\w\-]+/g, "_").slice(0, 60) || "estudio"}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : "No se pudo generar el video.");
    } finally {
      setExportando(false);
    }
  }

  if (!total) {
    return <p className="text-sm text-slate-500">La serie no tiene imágenes.</p>;
  }

  const esCT = (modality || "").toUpperCase() === "CT";
  const progreso = cargados + fallidos;

  return (
    <div className="space-y-3">
      <div
        ref={stageRef}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => frameActual && setVentana({ wc: frameActual.windowCenter, ww: frameActual.windowWidth })}
        className="relative overflow-hidden rounded-2xl bg-slate-950 outline-none ring-1 ring-slate-800"
      >
        <canvas ref={canvasRef} className="mx-auto max-h-[min(70vh,560px)] w-full object-contain" />
        {!frameActual && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            {fallidos === total ? errorCarga || "No se pudieron cargar las imágenes." : "Cargando…"}
          </div>
        )}
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/50 px-2 py-1 text-xs text-white">
          {pos + 1} / {total}
          {frameActual?.sliceLocation != null ? ` · ${frameActual.sliceLocation.toFixed(1)} mm` : ""}
        </div>
        {ventana && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-black/50 px-2 py-1 text-xs text-white">
            C {Math.round(ventana.wc)} · A {Math.round(ventana.ww)}
          </div>
        )}
        {progreso < total && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/50 px-2 py-1 text-xs text-white">
            Descargando {progreso}/{total}
          </div>
        )}
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(total - 1, 0)}
        value={pos}
        onChange={(e) => {
          setPlaying(false);
          setPos(Number(e.target.value));
        }}
        aria-label="Corte de la serie"
        className="w-full accent-brand-600"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          disabled={progreso < Math.min(3, total)}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? "Pausa" : "Reproducir"}
        </button>
        <label className="inline-flex items-center gap-1.5 text-sm text-slate-600">
          Velocidad
          <select value={fps} onChange={(e) => setFps(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
            {FPS_OPCIONES.map((f) => (
              <option key={f} value={f}>
                {f} img/s
              </option>
            ))}
          </select>
        </label>
        {esCT &&
          PRESETS_CT.map((p) => (
            <button key={p.id} type="button" onClick={() => setVentana({ wc: p.wc, ww: p.ww })} className="h-9 rounded-xl bg-slate-50 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
              {p.label}
            </button>
          ))}
        <button
          type="button"
          onClick={() => void descargarVideo()}
          disabled={exportando || cargados < Math.min(total, Math.max(8, Math.ceil(total * 0.35))) || fallidos === total}
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {exportando ? <RotateCw className="size-4 animate-spin" /> : <Download className="size-4" />}
          {exportando ? "Generando video…" : "Descargar video"}
        </button>
      </div>

      <p className="text-xs text-slate-400">Rueda o flechas: cambiar corte · Arrastrar: brillo/contraste · Espacio: reproducir · La descarga es un video WebM de la serie.</p>
      {errorCarga && <Alert tone="error">{errorCarga}</Alert>}
      {fallidos > 0 && fallidos < total && <p className="text-xs text-amber-700">{fallidos} imagen(es) no se pudieron cargar.</p>}
    </div>
  );
}
