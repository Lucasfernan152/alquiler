import { HomeIcon, ReceiptIcon, WrenchIcon } from "./icons";
import { cx } from "./ui";
import type { Tab } from "../types";

type Props = {
  tab: Tab;
  onChange: (tab: Tab) => void;
};

const items: Array<{ id: Tab; label: string; icon: typeof HomeIcon }> = [
  { id: "inicio", label: "Inicio", icon: HomeIcon },
  { id: "facturas", label: "Facturas", icon: ReceiptIcon },
  { id: "reclamos", label: "Reclamos", icon: WrenchIcon },
];

export function BottomNav({ tab, onChange }: Props) {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-sand-200 bg-white/95 pt-1.5 backdrop-blur">
      <div className="mx-auto grid max-w-3xl grid-cols-3">
        {items.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium transition",
                active ? "text-brand-600" : "text-ink-400",
              )}
            >
              <Icon className="size-6" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
