import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckIcon, CloseIcon } from "./icons";
import { cx } from "./ui";

export type ToastTone = "success" | "error";

type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Fallback imperativo para helpers fuera de React (p. ej. run). */
let imperativeApi: ToastApi | null = null;

export const toast: ToastApi = {
  success(message) {
    imperativeApi?.success(message);
  },
  error(message) {
    imperativeApi?.error(message);
  },
};

export function useToast() {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const text = message.trim();
      if (!text) return;
      const id = idRef.current++;
      setItems((prev) => [...prev.slice(-2), { id, tone, message: text }]);
      const ms = tone === "error" ? 4500 : 2800;
      window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
    }),
    [push],
  );

  useEffect(() => {
    imperativeApi = api;
    return () => {
      if (imperativeApi === api) imperativeApi = null;
    };
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const success = item.tone === "success";
  return (
    <div
      role={success ? "status" : "alert"}
      className={cx(
        "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl px-3.5 py-3 shadow-float",
        "animate-[toast-in_220ms_ease-out]",
        success
          ? "bg-ink-900 text-white"
          : "bg-brand-800 text-white",
      )}
    >
      <span
        className={cx(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
          success ? "bg-sage-500/90" : "bg-white/15",
        )}
      >
        {success ? (
          <CheckIcon className="size-3 text-white" />
        ) : (
          <CloseIcon className="size-3 text-white" />
        )}
      </span>
      <p className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug">
        {item.message}
      </p>
      <button
        type="button"
        className="mt-0.5 shrink-0 rounded-md p-0.5 text-white/70 transition hover:text-white"
        aria-label="Cerrar"
        onClick={() => onDismiss(item.id)}
      >
        <CloseIcon className="size-3.5" />
      </button>
    </div>
  );
}
