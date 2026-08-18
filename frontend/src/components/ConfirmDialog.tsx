import { useEffect } from "react";
import type { ReactNode } from "react";
import { Button } from "./ui";

type Props = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  busy,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      data-screen
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 px-4 pb-6 pt-10 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[17px] font-semibold text-ink-900">{title}</p>
        {description && (
          <div className="mt-2 text-[14px] leading-relaxed text-ink-500">
            {description}
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" block onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button block loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
