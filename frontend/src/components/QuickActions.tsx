import type { ReactNode } from "react";

export type QuickAction = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={action.onClick}
          className="flex flex-col items-center gap-2 rounded-2xl py-1 transition active:scale-95"
        >
          <span className="flex size-[52px] items-center justify-center rounded-full bg-white text-brand-600 shadow-card ring-1 ring-sand-200/80">
            {action.icon}
          </span>
          <span className="w-full truncate text-center text-[11px] font-medium text-ink-700">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
}
