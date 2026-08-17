import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Botón atrás de Android. `onBack` devuelve true si consumió el gesto; si
 * devuelve false ya no queda a dónde volver y la app pasa a segundo plano en
 * vez de cerrarse, que es lo que espera cualquiera en Android.
 */
export function useHardwareBack(onBack: () => boolean) {
  const latest = useRef(onBack);
  latest.current = onBack;

  useEffect(() => {
    // Solo Android tiene botón atrás; en iOS el evento nunca llega.
    if (Capacitor.getPlatform() !== "android") return;

    const listener = App.addListener("backButton", () => {
      if (latest.current()) return;
      void App.minimizeApp();
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);
}
