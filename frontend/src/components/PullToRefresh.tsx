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

  const height = refreshing ? 44 : pull;
  const progress = Math.min(pull / THRESHOLD, 1);

  return (
    <div onTouchStart={start} onTouchMove={move} onTouchEnd={end} onTouchCancel={end}>
      <div
        className="pointer-events-none flex items-end justify-center overflow-hidden"
        style={{
          height,
          transition: pull === 0 ? "height 200ms ease-out" : undefined,
        }}
      >
        <div className="pb-2">
          <Spinner
            spinning={refreshing}
            className="size-6"
            style={
              refreshing
                ? undefined
                : { opacity: progress, transform: `rotate(${pull * 3}deg)` }
            }
          />
        </div>
      </div>
      {children}
    </div>
  );
}
