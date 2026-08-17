import { BuildingIcon, ChevronDownIcon } from "./icons";
import type { PropertyOption } from "../types";

type Props = {
  options: PropertyOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function groupByBuilding(options: PropertyOption[]) {
  const groups = new Map<string, PropertyOption[]>();
  for (const option of options) {
    const units = groups.get(option.buildingName) ?? [];
    units.push(option);
    groups.set(option.buildingName, units);
  }
  return [...groups.entries()];
}

export function PropertySwitcher({ options, selectedId, onSelect }: Props) {
  const selected = options.find((o) => o.id === selectedId) ?? options[0];
  const disabled = options.length <= 1;

  if (!selected) return null;

  return (
    <div className="relative rounded-2xl border border-sand-200/80 bg-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <BuildingIcon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink-900">
            {selected.buildingName} · {selected.label}
          </p>
          <p className="truncate text-[13px] text-ink-500">
            {selected.role === "owner" ? "Sos el dueño" : "Alquilás acá"} ·{" "}
            {selected.address}
          </p>
        </div>
        {!disabled && <ChevronDownIcon className="size-[18px] text-ink-400" />}
      </div>

      {!disabled && (
        <select
          aria-label="Elegir propiedad"
          value={selected.id}
          onChange={(e) => onSelect(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        >
          {groupByBuilding(options).map(([buildingName, units]) => (
            <optgroup key={buildingName} label={buildingName}>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
    </div>
  );
}
