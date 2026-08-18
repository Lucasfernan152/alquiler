export type IncreaseMethod = "ipc" | "icl" | "fixed" | "other";

export const INCREASE_METHODS: { value: IncreaseMethod; label: string }[] = [
  { value: "ipc", label: "IPC" },
  { value: "icl", label: "ICL / Casa Propia" },
  { value: "fixed", label: "Porcentaje fijo" },
  { value: "other", label: "Otro método" },
];

export function increaseMethodLabel(method?: string | null) {
  return (
    INCREASE_METHODS.find((m) => m.value === method)?.label ??
    (method?.trim() || "Sin definir")
  );
}
