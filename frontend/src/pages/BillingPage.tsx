import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";
import {
  amountDue,
  missingRequiredInvoiceTypes,
  rentOf,
  requiredInvoiceTypes,
  shareOf,
  viewerShare,
} from "../lib/billing";
import { Screen } from "../components/Screen";
import { CheckIcon, ChevronDownIcon, FileIcon, ReceiptIcon } from "../components/icons";
import {
  Badge,
  Button,
  Card,
  CardList,
  EmptyState,
  ErrorText,
  Field,
  ListRow,
  SectionHeading,
  inputClass,
  money,
  shortDate,
} from "../components/ui";
import type { Payment, Property } from "../types";

type Props = {
  property: Property | null;
  reload: () => Promise<void>;
  focusPeriodId?: string | null;
  focusOpenPayment?: boolean;
  onFocusHandled?: () => void;
};

type Sheet = "invoice" | "payment" | null;

function paymentTone(status: Payment["status"]) {
  if (status === "approved") return "success" as const;
  if (status === "rejected") return "neutral" as const;
  return "warn" as const;
}

function paymentLabel(status: Payment["status"]) {
  if (status === "approved") return "Aprobado";
  if (status === "rejected") return "Rechazado";
  return "En revisión";
}

export function BillingPage({
  property,
  reload,
  focusPeriodId,
  focusOpenPayment,
  onFocusHandled,
}: Props) {
  const periods = property?.billingPeriods ?? [];
  const [periodId, setPeriodId] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [invoiceType, setInvoiceType] = useState("Expensas");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const [payAmount, setPayAmount] = useState("");
  const [payFile, setPayFile] = useState<File | null>(null);

  useEffect(() => {
    if (periods.length === 0) {
      setPeriodId("");
      return;
    }
    if (!periods.some((p) => p.id === periodId)) setPeriodId(periods[0]!.id);
  }, [periods, periodId]);

  useEffect(() => {
    if (!focusPeriodId && !focusOpenPayment) return;
    if (!property) return;
    if (focusPeriodId && !periods.some((p) => p.id === focusPeriodId)) {
      // propiedad cargada pero el período no está: igual liberamos el focus
      onFocusHandled?.();
      return;
    }
    if (focusPeriodId) setPeriodId(focusPeriodId);
    if (focusOpenPayment && property.role === "tenant") {
      setSheet("payment");
    }
    onFocusHandled?.();
  }, [focusPeriodId, focusOpenPayment, periods, property, onFocusHandled]);

  if (!property) {
    return (
      <Card>
        <EmptyState title="Sin propiedad seleccionada" />
      </Card>
    );
  }

  const current = property;
  const isOwner = current.role === "owner";
  const period = periods.find((p) => p.id === periodId);
  const invoices = period?.invoices ?? [];
  const payments = period?.payments ?? [];
  const rent = rentOf(current);
  const share = viewerShare(current);
  const due = amountDue(current, period?.id);
  const shareLabel = isOwner ? `${share}% del inquilino` : `tu ${share}%`;
  const invoiceValue = (amount: number) => money(shareOf(amount, share));
  const invoiceMeta = (extra?: string | null) => {
    const label =
      share === 100 ? null : isOwner ? `${share}% inquilino` : `Tu ${share}%`;
    const parts = [label, extra?.trim() || null].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : undefined;
  };
  const required = requiredInvoiceTypes(current);
  const missing = missingRequiredInvoiceTypes(current, period?.id);
  const canNotify =
    isOwner &&
    period?.status === "collecting" &&
    missing.length === 0 &&
    (required.length > 0 || invoices.length > 0);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setBusy(false);
    }
  }

  async function addInvoice(e: FormEvent) {
    e.preventDefault();
    if (!period) return;
    const form = new FormData();
    form.append("type", invoiceType);
    form.append("amount", invoiceAmount);
    if (invoiceFile) form.append("file", invoiceFile);
    await run(async () => {
      await api.addInvoice(period.id, form);
      setInvoiceAmount("");
      setInvoiceFile(null);
      setSheet(null);
    });
  }

  async function submitPayment(e: FormEvent) {
    e.preventDefault();
    if (!period) return;
    const form = new FormData();
    form.append("amount", payAmount || String(due));
    if (payFile) form.append("proof", payFile);
    await run(async () => {
      await api.submitPayment(period.id, form);
      setPayAmount("");
      setPayFile(null);
      setSheet(null);
    });
  }

  const canPay =
    !isOwner &&
    period &&
    (period.status === "ready" || period.status === "settled") &&
    !payments.some((p) => p.status === "pending");

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading
          title="Facturas"
          action={
            periods.length > 1 ? (
              <div className="relative">
                <span className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[13px] font-semibold text-ink-700 ring-1 ring-sand-200">
                  {period?.label ?? "Elegir"}
                  <ChevronDownIcon className="size-4 text-ink-400" />
                </span>
                <select
                  aria-label="Elegir período"
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : undefined
          }
        />

        {!period ? (
          <Card>
            <EmptyState
              icon={<ReceiptIcon className="size-5" />}
              title="Sin períodos todavía"
              description={
                isOwner
                  ? current.contracts?.[0]
                    ? "Los períodos se abren solos cada mes desde el inicio del contrato."
                    : "Cargá el contrato en Más: a partir de su fecha de inicio se abren los períodos solos."
                  : "Todavía no hay un período de facturación para esta propiedad."
              }
            />
          </Card>
        ) : (
          <Card padded={false}>
            <div className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="text-[13px] font-medium text-ink-500">
                  {share === 100 ? period.label : `${period.label} · ${shareLabel}`}
                </p>
                <p className="amount mt-1 text-[28px] leading-none text-ink-900">
                  {money(due)}
                </p>
                {share !== 100 && (
                  <p className="mt-1 text-[13px] text-ink-500">
                    Alquiler {money(rent)} + {shareLabel} de las facturas
                  </p>
                )}
              </div>
              <Badge
                tone={
                  period.status === "collecting"
                    ? "neutral"
                    : period.status === "ready"
                      ? "warn"
                      : "success"
                }
              >
                {period.status === "collecting"
                  ? "En preparación"
                  : period.status === "ready"
                    ? "A pagar"
                    : "Pagado"}
              </Badge>
            </div>

            {(rent > 0 || invoices.length > 0 || required.length > 0) && (
              <div className="divide-y divide-sand-200/70 border-t border-sand-200/70">
                {rent > 0 && (
                  <ListRow title="Alquiler" meta="Según contrato" value={money(rent)} />
                )}
                {required.map((type) => {
                  const uploaded = invoices.find(
                    (i) => i.type.trim().toLowerCase() === type.trim().toLowerCase(),
                  );
                  if (uploaded) {
                    return (
                      <ListRow
                        key={type}
                        title={uploaded.type}
                        meta={invoiceMeta("Del preset · cargada")}
                        value={invoiceValue(uploaded.amount)}
                        right={
                          uploaded.filePath ? (
                            <a
                              href={api.fileUrl(uploaded.filePath)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-ink-400"
                              aria-label={`Ver ${uploaded.type}`}
                            >
                              <FileIcon className="size-[18px]" />
                            </a>
                          ) : (
                            <span className="flex size-7 items-center justify-center rounded-full bg-sage-50 text-sage-600">
                              <CheckIcon className="size-4" />
                            </span>
                          )
                        }
                      />
                    );
                  }
                  return (
                    <ListRow
                      key={type}
                      title={type}
                      meta="Falta cargar"
                      right={<Badge tone="warn">Pendiente</Badge>}
                      onClick={
                        isOwner && period.status === "collecting"
                          ? () => {
                              setInvoiceType(type);
                              setSheet("invoice");
                            }
                          : undefined
                      }
                    />
                  );
                })}
                {invoices
                  .filter(
                    (invoice) =>
                      !required.some(
                        (type) =>
                          type.trim().toLowerCase() === invoice.type.trim().toLowerCase(),
                      ),
                  )
                  .map((invoice) => (
                    <ListRow
                      key={invoice.id}
                      title={invoice.type}
                      meta={invoiceMeta(invoice.notes)}
                      value={invoiceValue(invoice.amount)}
                      right={
                        invoice.filePath ? (
                          <a
                            href={api.fileUrl(invoice.filePath)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-ink-400"
                            aria-label={`Ver ${invoice.type}`}
                          >
                            <FileIcon className="size-[18px]" />
                          </a>
                        ) : undefined
                      }
                    />
                  ))}
              </div>
            )}

            {(isOwner ? period.status === "collecting" : true) && (
              <div className="space-y-2 border-t border-sand-200/70 bg-sand-50/60 p-3">
                {isOwner && missing.length > 0 && (
                  <p className="text-[13px] text-ink-500">
                    Faltan: {missing.join(", ")}. Cargalas para poder avisar.
                  </p>
                )}
                {isOwner && (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      block
                      onClick={() => {
                        if (missing[0]) setInvoiceType(missing[0]);
                        setSheet("invoice");
                      }}
                    >
                      Agregar factura
                    </Button>
                    <Button
                      block
                      disabled={busy || !canNotify}
                      onClick={() => run(() => api.markPeriodReady(period.id))}
                    >
                      Avisar al inquilino
                    </Button>
                  </div>
                )}
                {canPay && (
                  <Button block onClick={() => setSheet("payment")}>
                    Subir comprobante
                  </Button>
                )}
                {!isOwner && !canPay && (
                  <p className="w-full py-1 text-center text-[13px] text-ink-500">
                    {period.status === "collecting"
                      ? required.length > 0
                        ? `El dueño está cargando: ${required.join(", ")}.`
                        : "Te avisamos cuando estén todas las facturas."
                      : "Tu comprobante está esperando la validación del dueño."}
                  </p>
                )}
              </div>
            )}
          </Card>
        )}
      </section>

      <ErrorText>{error}</ErrorText>

      {period && (
        <section>
          <SectionHeading title="Pagos" />
          {payments.length === 0 ? (
            <Card>
              <p className="py-2 text-sm text-ink-500">
                Todavía no hay comprobantes para este período.
              </p>
            </Card>
          ) : (
            <CardList>
              {payments.map((payment) => (
                <div key={payment.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold tabular-nums text-ink-900">
                        {money(payment.amount)}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-ink-500">
                        {payment.tenant?.name ?? "Inquilino"} ·{" "}
                        {shortDate(payment.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={paymentTone(payment.status)}>
                        {paymentLabel(payment.status)}
                      </Badge>
                      {payment.proofPath && (
                        <a
                          href={api.fileUrl(payment.proofPath)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-ink-400"
                          aria-label="Ver comprobante"
                        >
                          <FileIcon className="size-[18px]" />
                        </a>
                      )}
                    </div>
                  </div>

                  {payment.reviewNote && (
                    <p className="mt-2 text-[13px] text-ink-500">{payment.reviewNote}</p>
                  )}

                  {isOwner && payment.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          run(() => api.reviewPayment(payment.id, { status: "approved" }))
                        }
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            api.reviewPayment(payment.id, {
                              status: "rejected",
                              reviewNote: "Revisá el comprobante y volvé a subirlo",
                            }),
                          )
                        }
                      >
                        Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardList>
          )}
        </section>
      )}

      {sheet === "invoice" && period && (
        <Screen title="Agregar factura" onClose={() => setSheet(null)}>
          <Card>
            <form className="space-y-4" onSubmit={addInvoice}>
              <Field label="Tipo">
                {required.length > 0 ? (
                  <select
                    className={inputClass}
                    value={invoiceType}
                    onChange={(e) => setInvoiceType(e.target.value)}
                    required
                  >
                    {missing.length > 0 && (
                      <optgroup label="Faltan del preset">
                        {missing.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Otras del preset">
                      {required
                        .filter((type) => !missing.includes(type))
                        .map((type) => (
                          <option key={type} value={type}>
                            {type} (ya cargada)
                          </option>
                        ))}
                    </optgroup>
                    <option value="Expensas">Otra: Expensas</option>
                    <option value="Otro">Otro</option>
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    value={invoiceType}
                    onChange={(e) => setInvoiceType(e.target.value)}
                    placeholder="Expensas, luz, gas…"
                    required
                  />
                )}
              </Field>
              <Field label="Monto">
                <input
                  className={inputClass}
                  type="number"
                  step="0.01"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  placeholder="0"
                  required
                />
              </Field>
              <Field label="Archivo" hint="PDF o foto de la factura. Es opcional.">
                <input
                  className={inputClass}
                  type="file"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                />
              </Field>
              <Button block disabled={busy}>
                Guardar factura
              </Button>
            </form>
          </Card>
        </Screen>
      )}

      {sheet === "payment" && period && (
        <Screen title="Subir comprobante" onClose={() => setSheet(null)}>
          <Card>
            <p className="text-sm text-ink-500">
              Monto a pagar
              {share !== 100 ? ` (tu ${share}%)` : ""}:{" "}
              <span className="font-semibold text-ink-900">{money(due)}</span>
            </p>
            <form className="mt-4 space-y-4" onSubmit={submitPayment}>
              <Field label="Monto pagado">
                <input
                  className={inputClass}
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={String(due)}
                />
              </Field>
              <Field label="Comprobante" hint="Captura de la transferencia o del pago.">
                <input
                  className={inputClass}
                  type="file"
                  onChange={(e) => setPayFile(e.target.files?.[0] ?? null)}
                />
              </Field>
              <Button block disabled={busy}>
                Enviar al dueño
              </Button>
            </form>
          </Card>
        </Screen>
      )}
    </div>
  );
}
