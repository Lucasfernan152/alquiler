import { useState } from "react";
import type { FormEvent } from "react";
import type { Contract } from "../types";
import { Button, Field, cx, inputClass, longDate } from "./ui";

const INVOICE_PRESETS = ["Luz", "Gas", "Agua", "Expensas", "ABL", "Internet"];

type Props = {
  /** Contrato vigente: sus valores son el punto de partida del formulario. */
  contract?: Contract;
  requiredTypes: string[];
  busy: boolean;
  onSubmit: (form: FormData) => Promise<void>;
};

function nextIncreaseFromStart(start: string, everyMonths: string) {
  if (!start) return null;
  const months = Number(everyMonths) || 12;
  const date = new Date(`${start}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + months);
  return date;
}

export function ContractForm({ contract, requiredTypes, busy, onSubmit }: Props) {
  const [rentAmount, setRentAmount] = useState(
    contract ? String(contract.rentAmount) : "",
  );
  const [increaseEvery, setIncreaseEvery] = useState(
    String(contract?.increaseEveryMonths ?? 12),
  );
  const [startDate, setStartDate] = useState(contract?.startDate?.slice(0, 10) ?? "");
  const [requiredInvoices, setRequiredInvoices] = useState<string[]>(
    contract ? requiredTypes : ["Luz", "Gas"],
  );
  const [customInvoice, setCustomInvoice] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const previewIncrease = nextIncreaseFromStart(startDate, increaseEvery);

  function toggleRequiredInvoice(type: string) {
    setRequiredInvoices((current) =>
      current.some((t) => t.toLowerCase() === type.toLowerCase())
        ? current.filter((t) => t.toLowerCase() !== type.toLowerCase())
        : [...current, type],
    );
  }

  function addCustomInvoice() {
    const value = customInvoice.trim();
    if (!value) return;
    setRequiredInvoices((current) =>
      current.some((t) => t.toLowerCase() === value.toLowerCase())
        ? current
        : [...current, value],
    );
    setCustomInvoice("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!startDate) return;
    const form = new FormData();
    form.append("rentAmount", rentAmount);
    form.append("increaseEveryMonths", increaseEvery);
    form.append("startDate", startDate);
    form.append("requiredInvoiceTypes", JSON.stringify(requiredInvoices));
    if (previewIncrease) form.append("nextIncreaseDate", previewIncrease.toISOString());
    if (file) form.append("file", file);
    await onSubmit(form);
  }

  const customTypes = requiredInvoices.filter(
    (t) => !INVOICE_PRESETS.some((p) => p.toLowerCase() === t.toLowerCase()),
  );

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field label="Monto del alquiler">
        <input
          className={inputClass}
          type="number"
          step="0.01"
          value={rentAmount}
          onChange={(e) => setRentAmount(e.target.value)}
          placeholder="0"
          required
        />
      </Field>
      <Field label="Fecha de inicio del contrato">
        <input
          className={inputClass}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
      </Field>
      <Field
        label="Aumenta cada (meses)"
        hint={
          previewIncrease
            ? `Próximo aumento: ${longDate(previewIncrease.toISOString())}`
            : "Se calcula desde la fecha de inicio."
        }
      >
        <input
          className={inputClass}
          type="number"
          min={1}
          value={increaseEvery}
          onChange={(e) => setIncreaseEvery(e.target.value)}
          required
        />
      </Field>
      <Field
        label="Facturas que hay que subir cada mes"
        hint="Hasta que estén todas cargadas, no se puede avisar al inquilino."
      >
        <div className="flex flex-wrap gap-2">
          {INVOICE_PRESETS.map((type) => {
            const active = requiredInvoices.some(
              (t) => t.toLowerCase() === type.toLowerCase(),
            );
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleRequiredInvoice(type)}
                className={cx(
                  "rounded-full px-3 py-1.5 text-[13px] font-semibold transition",
                  active
                    ? "bg-brand-600 text-white"
                    : "bg-sand-100 text-ink-700 ring-1 ring-sand-200",
                )}
              >
                {type}
              </button>
            );
          })}
          {customTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleRequiredInvoice(type)}
              className="rounded-full bg-brand-600 px-3 py-1.5 text-[13px] font-semibold text-white"
            >
              {type} ×
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className={inputClass}
            value={customInvoice}
            onChange={(e) => setCustomInvoice(e.target.value)}
            placeholder="Otra (ej. Municipal)"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomInvoice();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            onClick={addCustomInvoice}
          >
            Agregar
          </Button>
        </div>
      </Field>
      <Field
        label="Archivo del contrato"
        hint={
          contract?.fileName ? `Si no subís otro, queda ${contract.fileName}.` : undefined
        }
      >
        <input
          className={inputClass}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      <Button block disabled={busy}>
        {contract ? "Guardar cambios" : "Guardar contrato"}
      </Button>
    </form>
  );
}
