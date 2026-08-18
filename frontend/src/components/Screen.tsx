import type { ReactNode } from "react";
import { useBackClosable } from "../lib/backStack";
import { ChevronLeftIcon } from "./icons";

export function Screen({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useBackClosable(onClose);

  return (
    <div data-screen className="fixed inset-0 z-30 overflow-y-auto bg-sand-100">
      <div className="safe-top sticky top-0 z-10 border-b border-sand-200 bg-sand-100/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-2 pb-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Volver"
            className="flex size-9 items-center justify-center rounded-full text-ink-700 transition active:bg-sand-200"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <h1 className="text-[17px] font-semibold text-ink-900">{title}</h1>
        </div>
      </div>

      <div className="pb-nav mx-auto max-w-3xl space-y-4 px-4 pt-4">{children}</div>
    </div>
  );
}
