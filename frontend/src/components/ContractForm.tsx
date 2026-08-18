import { useState } from "react";
import type { FormEvent } from "react";
import type { Contract } from "../types";
import {
  INCREASE_METHODS,
  type IncreaseMethod,
} from "../lib/contractLabels";
import { parseIncreasePercent } from "../lib/rentIncrease";
import { Button, Field, cx, inputClass, longDate, money } from "./ui";

const INVOICE_PRESETS = ["Luz", "Gas", "Agua", "Expensas", "ABL", "Internet"];

type Props = {
  /** Contrato vigente: sus valores son el punto de partida del formulario. */
  contract?: Contract;
  requiredTypes: string[];
  /** Cómo se reparten las facturas (vive en la propiedad, se edita con el contrato). */
  billSplitMode?: "tenant_pays_all" | "split_by_percentage";
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

function parseIncreaseMethod(value?: string | null): IncreaseMethod {
  if (value === "icl" || value === "fixed" || value === "other" || value === "ipc") {
    return value;
  }
  return "ipc";
}

export function ContractForm({
  contract,
  requiredTypes,
  billSplitMode = "tenant_pays_all",
  busy,
  onSubmit,
}: Props) {
  const [rentAmount, setRentAmount] = useState(
    contract ? String(contract.rentAmount) : "",
  );
  const [increaseEvery, setIncreaseEvery] = useState(
    String(contract?.increaseEveryMonths ?? 12),
  );
  const [increaseMethod, setIncreaseMethod] = useState<IncreaseMethod>(
    parseIncreaseMethod(contract?.increaseMethod),
  );
  const [increaseNote, setIncreaseNote] = useState(contract?.increaseNote ?? "");
  const [fixedPct, setFixedPct] = useState(() => {
    if (contract?.increaseMethod === "fixed") {
      if (contract.estimatedIncreasePct != null) {
        return String(contract.estimatedIncreasePct);
      }
      const fromNote = parseIncreasePercent(contract.increaseNote);
      return fromNote != null ? String(fromNote) : "";
    }
    return "";
  });
  const [startDate, setStartDate] = useState(contract?.startDate?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(contract?.endDate?.slice(0, 10) ?? "");
  const [splitMode, setSplitMode] = useState(billSplitMode);
  const [requiredInvoices, setRequiredInvoices] = useState<string[]>(
    contract ? requiredTypes : ["Luz", "Gas"],
  );
  const [customInvoice, setCustomInvoice] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const previewIncrease = nextIncreaseFromStart(startDate, increaseEvery);
  const pctPreview =
    increaseMethod === "fixed" ? Number(fixedPct) || parseIncreasePercent(increaseNote) : null;
  const rentPreview = Number(rentAmount);
  const estimatedRent =
    pctPreview != null && Number.isFinite(rentPreview) && rentPreview > 0
      ? Math.round(rentPreview * (1 + pctPreview / 100))
      : null;

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
    if (!startDate || !endDate) return;
    const form = new FormData();
    form.append("rentAmount", rentAmount);
    form.append("increaseEveryMonths", increaseEvery);
    form.append("increaseMethod", increaseMethod);
    if (increaseMethod === "fixed") {
      form.append("estimatedIncreasePct", fixedPct.trim());
      form.append("increaseNote", fixedPct.trim() ? `${fixedPct.trim()}%` : "");
    } else if (increaseMethod === "other") {
      form.append("increaseNote", increaseNote.trim());
    } else {
      form.append("increaseNote", "");
    }
    form.append("startDate", startDate);
    form.append("endDate", endDate);
    form.append("requiredInvoiceTypes", JSON.stringify(requiredInvoices));
    form.append("billSplitMode", splitMode);
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
        label="Fecha de fin del contrato"
        hint="Te avisamos 2 meses y 1 mes antes para que puedas renovar o tomar medidas."
      >
        <input
          className={inputClass}
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={(e) => setEndDate(e.target.value)}
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
        label="Cómo se calcula el aumento"
        hint={
          increaseMethod === "ipc"
            ? "El próximo alquiler se estima solo con el IPC oficial (INDEC). Si faltan meses, se proyectan."
            : increaseMethod === "icl"
              ? "Estimamos con la serie de IPC (no hay API pública estable del ICL). Se actualiza sola."
              : increaseMethod === "fixed"
              ? estimatedRent != null
                ? `Alquiler estimado: ${money(estimatedRent)}`
                : "Ingresá el % fijo del contrato."
              : "Describí el método; si incluye un %, lo usamos para estimar."
        }
      >
        <select
          className={inputClass}
          value={increaseMethod}
          onChange={(e) => setIncreaseMethod(e.target.value as IncreaseMethod)}
        >
          {INCREASE_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      {increaseMethod === "fixed" && (
        <Field label="Porcentaje fijo de aumento">
          <input
            className={inputClass}
            type="number"
            min={0}
            step="0.01"
            value={fixedPct}
            onChange={(e) => setFixedPct(e.target.value)}
            placeholder="10"
            required
          />
        </Field>
      )}
      {increaseMethod === "other" && (
        <Field
          label="Detalle del método"
          hint="Describí cómo se actualiza el alquiler."
        >
          <input
            className={inputClass}
            value={increaseNote}
            onChange={(e) => setIncreaseNote(e.target.value)}
            placeholder="Según acuerdo…"
            required
          />
        </Field>
      )}
      <Field
        label="Cómo se pagan las facturas"
        hint="Si se dividen, el porcentaje de cada inquilino se define al asignarlo."
      >
        <select
          className={inputClass}
          value={splitMode}
          onChange={(e) =>
            setSplitMode(
              e.target.value as "tenant_pays_all" | "split_by_percentage",
            )
          }
        >
          <option value="tenant_pays_all">Las paga todas el inquilino</option>
          <option value="split_by_percentage">Se dividen por porcentaje</option>
        </select>
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
      <Button block loading={busy}>
        {contract ? "Guardar cambios" : "Guardar contrato"}
      </Button>
    </form>
  );
}
