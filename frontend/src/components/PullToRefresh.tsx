import { useRef, useState } from "react";
import type { ReactNode, TouchEvent } from "react";
import { Spinner } from "./ui";

/** Cuánto hay que arrastrar para que dispare la recarga. */
const THRESHOLD = 70;
const MAX_PULL = 110;
/** El indicador sigue al dedo a media velocidad, como en apps nativas. */
const RESISTANCE = 0.5;

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  function start(e: TouchEvent<HTMLDivElement>) {
    // Solo desde arriba de todo y fuera de las pantallas superpuestas, que
    // tienen su propio scroll.
    if (refreshing || window.scrollY > 0) {
      startY.current = null;
      return;
    }
    if (e.target instanceof Element && e.target.closest("[data-screen]")) {
      startY.current = null;
      return;
    }
    startY.current = e.touches[0]?.clientY ?? null;
  }

  function move(e: TouchEvent<HTMLDivElement>) {
    if (startY.current === null) return;
    const delta = (e.touches[0]?.clientY ?? 0) - startY.current;
    setPull(delta <= 0 ? 0 : Math.min(delta * RESISTANCE, MAX_PULL));
  }

  async function end() {
    startY.current = null;
    const shouldRefresh = pull >= THRESHOLD;
    setPull(0);
    if (!shouldRefresh) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  const progress = Math.min(pull / THRESHOLD, 1);
  const visible = refreshing || pull > 0;
  // El indicador va flotando sobre el contenido: la cabecera se superpone con
  // margen negativo y taparía cualquier cosa que insertemos en el flujo.
  const offset = refreshing ? 64 : 8 + pull * 0.6;

  return (
    <div onTouchStart={start} onTouchMove={move} onTouchEnd={end} onTouchCancel={end}>
      <div
        aria-hidden={!visible}
        className="safe-top pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
        style={{
          transform: `translateY(${visible ? offset : -16}px)`,
          opacity: visible ? 1 : 0,
          transition: pull === 0 ? "transform 220ms ease-out, opacity 220ms" : undefined,
        }}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-white shadow-float">
          <Spinner
            spinning={refreshing}
            className="size-5"
            style={
              refreshing
                ? undefined
                : { opacity: 0.35 + progress * 0.65, transform: `rotate(${pull * 3}deg)` }
            }
          />
        </span>
      </div>
      {children}
    </div>
  );
}
