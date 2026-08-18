import { useEffect, useState } from "react";
import { ContactActions } from "../components/ContactActions";
import { PaymentDetailsCard } from "../components/PaymentDetailsCard";
import { QuickActions } from "../components/QuickActions";
import type { QuickAction } from "../components/QuickActions";
import { Screen } from "../components/Screen";
import {
  CardIcon,
  CheckIcon,
  FileIcon,
  PhoneIcon,
  ReceiptIcon,
  UploadIcon,
  UsersIcon,
  WrenchIcon,
} from "../components/icons";
import {
  Badge,
  Button,
  Card,
  CardList,
  EmptyState,
  ListRow,
  LoadingBlock,
  SectionHeading,
  money,
  longDate,
} from "../components/ui";
import { api } from "../lib/api";
import { amountDue, duesByTenant, rentOf, shareParties, splitsByPercentage, viewerShare } from "../lib/billing";
import {
  estimateNextRent,
  resolveNextIncreaseDate,
} from "../lib/rentIncrease";
import type { MonthSummary, Property, Tab } from "../types";

type MoreSheet = "contract" | "tenants";

type Props = {
  property: Property | null;
  loading: boolean;
  onNavigate: (tab: Tab) => void;
  /** Abre Más ya dentro de contrato / inquilinos. */
  onOpenMore: (sheet: MoreSheet) => void;
  onSelectProperty?: (id: string) => void;
};

type Focus = {
  eyebrow: string;
  amount?: number;
  title: string;
  meta?: string;
  badge?: { label: string; tone: "brand" | "warn" | "success" | "neutral" };
  cta?: { label: string; onClick: () => void };
  calm?: boolean;
};

export function HomePage({
  property,
  loading,
  onNavigate,
  onOpenMore,
  onSelectProperty,
}: Props) {
  const [showContacts, setShowContacts] = useState(false);
  const [summary, setSummary] = useState<MonthSummary | null>(null);

  useEffect(() => {
    if (property?.role !== "owner") {
      setSummary(null);
      return;
    }
    let active = true;
    api
      .monthSummary()
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch(() => {
        if (active) setSummary(null);
      });
    return () => {
      active = false;
    };
  }, [property?.role, property?.id]);

  if (loading && !property) {
    return <LoadingBlock />;
  }

  if (!property) {
    return (
      <Card>
        <EmptyState
          icon={<ReceiptIcon className="size-5" />}
          title="Todavía no hay una propiedad"
          description="Si sos dueño, creá tu primer edificio. Si alquilás, pedile al dueño el link de invitación."
          action={
            <Button size="sm" onClick={() => onNavigate("mas")}>
              Crear un edificio
            </Button>
          }
        />
      </Card>
    );
  }

  const isOwner = property.role === "owner";
  const contract = property.contracts?.[0];
  const period = property.billingPeriods?.[0];
  const invoices = period?.invoices ?? [];
  const rent = rentOf(property, period?.id);
  const share = viewerShare(property);
  const due = amountDue(property, period?.id);
  const parties = shareParties(property);
  const splitting = splitsByPercentage(property);
  const tenantDues = duesByTenant(property, period?.id);
  const contacts = property.emergencyContacts ?? [];
  const tenants = property.tenancies ?? [];
  const owner = property.building?.owner;
  const openClaims = (property.claims ?? []).filter(
    (c) => c.status === "open" || c.status === "in_progress",
  );
  const pendingPayment = (period?.payments ?? []).find((p) => p.status === "pending");
  const goBilling = () => onNavigate("facturas");
  const hasContract = Boolean(contract);
  const nextIncrease = contract ? resolveNextIncreaseDate(contract) : null;
  const increasePct = contract?.estimatedIncreasePct ?? null;
  const estimatedRent =
    contract?.estimatedRent ?? (contract ? estimateNextRent(contract) : null);

  const focusAmount =
    isOwner && splitting && parties.length > 1
      ? tenantDues.reduce((sum, t) => sum + t.due, 0)
      : due;

  function buildFocus(): Focus {
    if (isOwner && contract?.increaseDue && estimatedRent != null) {
      return {
        eyebrow: "Aumento",
        amount: estimatedRent,
        title: "Llegó la fecha de aumento",
        meta: `Hoy el alquiler es ${money(contract.rentAmount)}${
          increasePct != null ? ` · estimado +${increasePct}%` : ""
        }. Aplicarlo avisa al inquilino.`,
        badge: { label: "Pendiente", tone: "warn" },
        cta: { label: "Aplicar aumento", onClick: () => onOpenMore("contract") },
      };
    }

    if (!period) {
      return {
        eyebrow: "Este mes",
        title: isOwner ? "Sin período abierto" : "Sin facturas todavía",
        meta: isOwner
          ? hasContract
            ? "Los períodos se abren solos cada mes."
            : "Cargá el contrato para que arranquen los períodos mensuales."
          : "Cuando el dueño termine de cargarlas, te avisamos.",
        calm: true,
        cta: isOwner
          ? {
              label: hasContract ? "Ver facturas" : "Cargar contrato",
              onClick: () =>
                hasContract ? onNavigate("facturas") : onOpenMore("contract"),
            }
          : undefined,
      };
    }

    const breakdown =
      rent > 0
        ? `Alquiler ${money(rent)} + ${invoices.length} factura${invoices.length === 1 ? "" : "s"}`
        : `${invoices.length} factura${invoices.length === 1 ? "" : "s"}`;
    const shareLabel =
      isOwner && parties.length === 1
        ? `${share}% de ${parties[0]!.name}`
        : isOwner
          ? `${share}% del inquilino`
          : `tu ${share}%`;
    const detail =
      !splitting || parties.length === 0
        ? breakdown
        : parties.length === 1 || !isOwner
          ? `Alquiler ${money(rent)} + ${shareLabel} de las facturas`
          : tenantDues
              .map((t) => `${t.name} ${money(t.due)}`)
              .join(" · ");

    if (period.status === "collecting") {
      return {
        eyebrow: period.label,
        amount: focusAmount,
        title: isOwner ? "Cargando facturas" : "El dueño está cargando las facturas",
        meta: detail,
        badge: { label: "En preparación", tone: "neutral" },
        cta: isOwner ? { label: "Agregar factura", onClick: goBilling } : undefined,
      };
    }

    if (period.status === "settled") {
      return {
        eyebrow: period.label,
        title: "Estás al día",
        meta: isOwner ? "El pago de este mes fue aprobado." : "No tenés pagos pendientes.",
        badge: { label: "Pagado", tone: "success" },
        calm: true,
      };
    }

    if (isOwner) {
      return {
        eyebrow: period.label,
        amount: focusAmount,
        title: pendingPayment ? "Hay un comprobante para revisar" : "Esperando el pago",
        meta: pendingPayment
          ? `${pendingPayment.tenant?.name ?? "El inquilino"} subió ${money(pendingPayment.amount)}`
          : detail,
        badge: pendingPayment
          ? { label: "Revisar", tone: "warn" }
          : { label: "Enviado", tone: "brand" },
        cta: { label: pendingPayment ? "Revisar comprobante" : "Ver facturas", onClick: goBilling },
      };
    }

    if (pendingPayment) {
      return {
        eyebrow: period.label,
        amount: due,
        title: "Comprobante en revisión",
        meta: "El dueño lo tiene que validar.",
        badge: { label: "En revisión", tone: "warn" },
        calm: true,
      };
    }

    return {
      eyebrow: period.label,
      amount: due,
      title: "Total a pagar",
      meta: `${detail} · listo el ${longDate(period.readyAt)}`,
      badge: { label: "A pagar", tone: "warn" },
      cta: { label: "Subir comprobante", onClick: goBilling },
    };
  }

  const focus = buildFocus();

  const actions: QuickAction[] = isOwner
    ? [
        {
          id: "invoice",
          label: "Facturas",
          icon: <UploadIcon className="size-[22px]" />,
          onClick: goBilling,
        },
        {
          id: "payments",
          label: "Pagos",
          icon: <CardIcon className="size-[22px]" />,
          onClick: goBilling,
        },
        {
          id: "claims",
          label: "Reclamos",
          icon: <WrenchIcon className="size-[22px]" />,
          onClick: () => onNavigate("reclamos"),
        },
        {
          id: "tenants",
          label: "Inquilinos",
          icon: <UsersIcon className="size-[22px]" />,
          onClick: () => onOpenMore("tenants"),
        },
      ]
    : [
        {
          id: "pay",
          label: "Pagar",
          icon: <CardIcon className="size-[22px]" />,
          onClick: goBilling,
        },
        {
          id: "claim",
          label: "Reclamo",
          icon: <WrenchIcon className="size-[22px]" />,
          onClick: () => onNavigate("reclamos"),
        },
        {
          id: "contract",
          label: "Contrato",
          icon: <FileIcon className="size-[22px]" />,
          onClick: () => onOpenMore("contract"),
        },
        {
          id: "help",
          label: "Emergencias",
          icon: <PhoneIcon className="size-[22px]" />,
          onClick: () => setShowContacts(true),
        },
      ];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-ink-500">{focus.eyebrow}</p>
          {focus.badge && <Badge tone={focus.badge.tone}>{focus.badge.label}</Badge>}
        </div>

        {focus.amount !== undefined && !focus.calm ? (
          <>
            <p className="amount mt-2 text-[34px] leading-none text-ink-900">
              {money(focus.amount)}
            </p>
            <p className="mt-2 text-[15px] font-medium text-ink-900">{focus.title}</p>
          </>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            {focus.calm && period?.status === "settled" && (
              <span className="flex size-6 items-center justify-center rounded-full bg-sage-50 text-sage-600">
                <CheckIcon className="size-4" />
              </span>
            )}
            <p className="text-[19px] font-semibold tracking-[-0.02em] text-ink-900">
              {focus.title}
            </p>
          </div>
        )}

        {focus.meta && <p className="mt-1 text-sm text-ink-500">{focus.meta}</p>}

        {focus.cta && (
          <Button block className="mt-4" onClick={focus.cta.onClick}>
            {focus.cta.label}
          </Button>
        )}
      </Card>

      {isOwner && summary && (
        <section>
          <SectionHeading title={`Este mes · ${summary.label}`} />
          <Card>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[12px] font-medium text-ink-400">A cobrar</p>
                <p className="amount mt-1 text-[22px] text-ink-900">
                  {money(summary.toCollect)}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-medium text-ink-400">Cobrado</p>
                <p className="amount mt-1 text-[22px] text-ink-900">
                  {money(summary.collected)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {summary.pendingReviewCount > 0 && (
                <Badge tone="warn">
                  {summary.pendingReviewCount} por revisar ·{" "}
                  {money(summary.pendingReviewAmount)}
                </Badge>
              )}
              {summary.overdueCount > 0 && (
                <Badge tone="warn">{summary.overdueCount} atrasadas</Badge>
              )}
              {summary.pendingReviewCount === 0 && summary.overdueCount === 0 && (
                <Badge tone="success">Al día</Badge>
              )}
            </div>
            {summary.units.some((u) => u.overdue || u.pending > 0) && (
              <div className="mt-3 divide-y divide-sand-200/70 rounded-xl bg-sand-50">
                {summary.units
                  .filter((u) => u.overdue || u.pending > 0)
                  .slice(0, 4)
                  .map((u) => (
                    <button
                      key={u.propertyId}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
                      onClick={() => {
                        onSelectProperty?.(u.propertyId);
                        onNavigate("facturas");
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-ink-900">
                          {u.buildingName} · {u.label}
                        </span>
                        <span className="text-[12px] text-ink-500">
                          {u.overdue
                            ? "Sin pago"
                            : `Pendiente ${money(u.pending)}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink-700">
                        {money(u.due)}
                      </span>
                    </button>
                  ))}
              </div>
            )}
            <Button
              className="mt-3"
              variant="secondary"
              block
              size="sm"
              onClick={goBilling}
            >
              Ir a facturas
            </Button>
          </Card>
        </section>
      )}

      <section>
        <SectionHeading title="Accesos rápidos" />
        <QuickActions actions={actions} />
      </section>

      <section>
        <SectionHeading title="Tu propiedad" />
        <CardList>
          <ListRow
            icon={<FileIcon className="size-[18px]" />}
            title="Contrato"
            meta={
              contract
                ? nextIncrease
                  ? estimatedRent != null
                    ? `Próximo aumento ${longDate(nextIncrease.toISOString())} · ~${money(estimatedRent)}`
                    : `Próximo aumento ${longDate(nextIncrease.toISOString())}`
                  : `Aumenta cada ${contract.increaseEveryMonths} meses`
                : "Todavía sin cargar"
            }
            value={contract ? money(contract.rentAmount) : undefined}
            onClick={() => onOpenMore("contract")}
          />
          {!isOwner && contract && estimatedRent != null && nextIncrease && (
            <ListRow
              icon={<ReceiptIcon className="size-[18px]" />}
              title="Próximo alquiler estimado"
              meta={`${longDate(nextIncrease.toISOString())}${
                increasePct != null ? ` · +${increasePct}%` : ""
              }`}
              value={money(estimatedRent)}
              onClick={() => onOpenMore("contract")}
            />
          )}
          {isOwner ? (
            <ListRow
              icon={<UsersIcon className="size-[18px]" />}
              title="Inquilinos"
              meta={
                tenants.length > 0
                  ? tenants.map((t) => t.tenant?.name).filter(Boolean).join(", ")
                  : "Sin asignar"
              }
              onClick={() => onOpenMore("tenants")}
            />
          ) : (
            <>
              {owner && (
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-ink-500">
                    <UsersIcon className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink-900">
                      {owner.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-ink-500">
                      {owner.phone || "Dueño · sin teléfono cargado"}
                    </span>
                  </span>
                  <ContactActions
                    phone={owner.phone}
                    waText={`Hola ${owner.name}, te escribo por la unidad ${property.label}.`}
                  />
                </div>
              )}
              {property.paymentDetails &&
                (property.paymentDetails.alias ||
                  property.paymentDetails.cbu ||
                  property.paymentDetails.holder) && (
                  <div className="border-t border-sand-200/70 px-4 py-3.5">
                    <PaymentDetailsCard details={property.paymentDetails} />
                  </div>
                )}
              <ListRow
                icon={<ReceiptIcon className="size-[18px]" />}
                title="Facturas del mes"
                meta={
                  period
                    ? share === 100
                      ? period.label
                      : `${period.label} · tu ${share}%`
                    : "Sin período abierto"
                }
                value={period ? money(due) : undefined}
                onClick={goBilling}
              />
            </>
          )}
          <ListRow
            icon={<WrenchIcon className="size-[18px]" />}
            title="Reclamos abiertos"
            meta={
              openClaims.length > 0
                ? openClaims[0]!.title
                : "No hay nada pendiente"
            }
            right={
              openClaims.length > 0 ? (
                <Badge tone="warn">{openClaims.length}</Badge>
              ) : undefined
            }
            onClick={() => onNavigate("reclamos")}
          />
          {!isOwner && (
            <ListRow
              icon={<PhoneIcon className="size-[18px]" />}
              title="Contactos de emergencia"
              meta={
                contacts.length > 0
                  ? contacts.map((c) => c.category).join(" · ")
                  : "Sin contactos cargados"
              }
              onClick={() => setShowContacts(true)}
            />
          )}
        </CardList>
      </section>

      {showContacts && (
        <Screen title="Contactos de emergencia" onClose={() => setShowContacts(false)}>
          {contacts.length === 0 ? (
            <Card>
              <EmptyState
                icon={<PhoneIcon className="size-5" />}
                title="Sin contactos"
                description={
                  isOwner
                    ? "Cargá los teléfonos de electricista, plomero o gasista desde Más."
                    : "El dueño todavía no cargó teléfonos para emergencias."
                }
              />
            </Card>
          ) : (
            <CardList>
              {contacts.map((contact) => (
                <ListRow
                  key={contact.id}
                  icon={<PhoneIcon className="size-[18px]" />}
                  title={contact.category}
                  meta={`${contact.name} · ${contact.phone}`}
                  right={
                    <a
                      href={`tel:${contact.phone}`}
                      className="rounded-lg bg-sage-50 px-3 py-1.5 text-[13px] font-semibold text-sage-700"
                    >
                      Llamar
                    </a>
                  }
                />
              ))}
            </CardList>
          )}
        </Screen>
      )}
    </div>
  );
}
