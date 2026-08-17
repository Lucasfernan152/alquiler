import { useEffect, useRef } from "react";

/**
 * Pila de pantallas superpuestas abiertas. El botón atrás de Android cierra la
 * última antes de tocar la navegación por pestañas.
 */
const handlers: Array<() => void> = [];

/** Cierra la pantalla más reciente. Devuelve false si no había ninguna. */
export function closeTopScreen() {
  const close = handlers.pop();
  if (!close) return false;
  close();
  return true;
}

export function useBackClosable(onClose: () => void) {
  // El handler se registra una sola vez para no alterar el orden de la pila
  // cuando la pantalla se re-renderiza con un onClose nuevo.
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    const entry = () => latest.current();
    handlers.push(entry);
    return () => {
      const index = handlers.lastIndexOf(entry);
      if (index >= 0) handlers.splice(index, 1);
    };
  }, []);
}
