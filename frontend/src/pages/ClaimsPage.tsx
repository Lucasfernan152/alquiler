import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";
import { Screen } from "../components/Screen";
import { PhoneIcon, WrenchIcon } from "../components/icons";
import {
  Badge,
  Button,
  Card,
  CardList,
  EmptyState,
  ErrorText,
  Field,
  LinkButton,
  ListRow,
  SectionHeading,
  inputClass,
  longDate,
} from "../components/ui";
import type { Claim, Property } from "../types";

type Props = {
  property: Property | null;
  reload: () => Promise<void>;
  focusClaimId?: string | null;
  onFocusHandled?: () => void;
};

function claimTone(status: Claim["status"]) {
  if (status === "resolved" || status === "closed") return "success" as const;
  if (status === "in_progress") return "warn" as const;
  return "brand" as const;
}

function claimLabel(status: Claim["status"]) {
  return {
    open: "Abierto",
    in_progress: "En curso",
    resolved: "Resuelto",
    closed: "Cerrado",
  }[status];
}

export function ClaimsPage({
  property,
  reload,
  focusClaimId,
  onFocusHandled,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!focusClaimId) return;
    if (!property) return;
    if ((property.claims ?? []).some((c) => c.id === focusClaimId)) {
      setOpenId(focusClaimId);
    }
    onFocusHandled?.();
  }, [focusClaimId, property, onFocusHandled]);

  if (!property) {
    return (
      <Card>
        <EmptyState title="Sin propiedad seleccionada" />
      </Card>
    );
  }

  const current = property;
  const isOwner = current.role === "owner";
  const claims = current.claims ?? [];
  const contacts = current.emergencyContacts ?? [];
  const selected = claims.find((c) => c.id === openId) ?? null;

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

  async function createClaim(e: FormEvent) {
    e.preventDefault();
    const form = new FormData();
    form.append("propertyId", current.id);
    form.append("title", title);
    form.append("description", description);
    if (photo) form.append("photo", photo);
    await run(async () => {
      await api.createClaim(form);
      setTitle("");
      setDescription("");
      setPhoto(null);
      setShowForm(false);
    });
  }

  async function answer(claim: Claim, status: "in_progress" | "resolved") {
    await run(async () => {
      await api.updateClaim(claim.id, {
        status,
        response:
          response ||
          (status === "in_progress"
            ? "Voy a mandar a alguien a revisarlo."
            : "Quedó resuelto."),
        assignedTo: status === "in_progress" ? "Técnico asignado" : undefined,
      });
      setResponse("");
      setOpenId(null);
    });
  }

  async function tenantResolve(claim: Claim) {
    await run(async () => {
      await api.updateClaim(claim.id, {
        status: "resolved",
        response: response.trim() || undefined,
      });
      setResponse("");
      setOpenId(null);
    });
  }

  async function tenantReopen(claim: Claim) {
    await run(async () => {
      await api.updateClaim(claim.id, {
        status: "open",
        response: response.trim() || undefined,
      });
      setResponse("");
      setOpenId(null);
    });
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading
          title="Reclamos"
          action={
            !isOwner ? (
              <LinkButton onClick={() => setShowForm(true)}>Nuevo reclamo</LinkButton>
            ) : undefined
          }
        />

        {claims.length === 0 ? (
          <Card>
            <EmptyState
              icon={<WrenchIcon className="size-5" />}
              title="Sin reclamos"
              description={
                isOwner
                  ? "Cuando el inquilino reporte algo roto, lo vas a ver acá."
                  : "Si se rompe algo en la casa, reportalo y el dueño lo recibe al instante."
              }
              action={
                !isOwner ? (
                  <Button size="sm" onClick={() => setShowForm(true)}>
                    Reportar un problema
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <CardList>
            {claims.map((claim) => (
              <ListRow
                key={claim.id}
                title={claim.title}
                meta={`${claim.author?.name ? `${claim.author.name} · ` : ""}${longDate(claim.createdAt)}`}
                right={<Badge tone={claimTone(claim.status)}>{claimLabel(claim.status)}</Badge>}
                onClick={() => setOpenId(claim.id)}
              />
            ))}
          </CardList>
        )}
      </section>

      <ErrorText>{error}</ErrorText>

      {contacts.length > 0 && !isOwner && (
        <section>
          <SectionHeading title="Antes de reclamar, podés llamar" />
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
        </section>
      )}

      {showForm && (
        <Screen title="Nuevo reclamo" onClose={() => setShowForm(false)}>
          <Card>
            <form className="space-y-4" onSubmit={createClaim}>
              <Field label="¿Qué se rompió?">
                <input
                  className={inputClass}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="El termotanque no calienta"
                  required
                />
              </Field>
              <Field label="Detalle" hint="Contá desde cuándo pasa y qué probaste.">
                <textarea
                  className={`${inputClass} min-h-28`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </Field>
              <Field label="Foto (opcional)">
                <input
                  className={inputClass}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
              </Field>
              <Button block loading={busy}>
                Enviar reclamo
              </Button>
            </form>
          </Card>
        </Screen>
      )}

      {selected && (
        <Screen title="Reclamo" onClose={() => setOpenId(null)}>
          <Card>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[19px] text-ink-900">{selected.title}</h2>
              <Badge tone={claimTone(selected.status)}>{claimLabel(selected.status)}</Badge>
            </div>
            <p className="mt-1 text-[13px] text-ink-400">
              {selected.author?.name ? `${selected.author.name} · ` : ""}
              {longDate(selected.createdAt)}
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-700">
              {selected.description}
            </p>
            {selected.photoPath && (
              <a
                href={api.fileUrl(selected.photoPath)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-[13px] font-semibold text-brand-600"
              >
                Ver foto adjunta
              </a>
            )}
          </Card>

          {selected.response && (
            <Card className="border-sage-100 bg-sage-50">
              <p className="text-[13px] font-semibold text-sage-700">
                Respuesta del dueño
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-sage-700">
                {selected.response}
              </p>
              {selected.assignedTo && (
                <p className="mt-2 text-[13px] text-sage-600">
                  Asignado a: {selected.assignedTo}
                </p>
              )}
            </Card>
          )}

          {isOwner && selected.status !== "resolved" && selected.status !== "closed" && (
            <Card>
              <Field label="Tu respuesta">
                <textarea
                  className={`${inputClass} min-h-24`}
                  placeholder="Mando al plomero el martes a la mañana."
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                />
              </Field>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="secondary"
                  block
                  loading={busy}
                  onClick={() => answer(selected, "in_progress")}
                >
                  Envío un técnico
                </Button>
                <Button block loading={busy} onClick={() => answer(selected, "resolved")}>
                  Marcar resuelto
                </Button>
              </div>
            </Card>
          )}

          {!isOwner && selected.status !== "resolved" && selected.status !== "closed" && (
            <Card>
              <Field
                label="¿Se solucionó?"
                hint="Si mandaron a alguien y no sirvió, reabrilo con un mensaje."
              >
                <textarea
                  className={`${inputClass} min-h-24`}
                  placeholder="Opcional: contá cómo quedó o qué sigue fallando."
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                />
              </Field>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="secondary"
                  block
                  loading={busy}
                  onClick={() => tenantReopen(selected)}
                >
                  No se solucionó
                </Button>
                <Button block loading={busy} onClick={() => tenantResolve(selected)}>
                  Quedó resuelto
                </Button>
              </div>
            </Card>
          )}

          {!isOwner && selected.status === "resolved" && (
            <Card>
              <p className="text-sm text-ink-500">
                Marcaste este reclamo como resuelto. Si vuelve a fallar, podés reabrirlo.
              </p>
              <div className="mt-3">
                <Field label="¿Qué pasó?">
                  <textarea
                    className={`${inputClass} min-h-24`}
                    placeholder="Volvió a romperse / el arreglo no alcanzó…"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                  />
                </Field>
              </div>
              <Button
                className="mt-3"
                variant="secondary"
                block
                loading={busy}
                onClick={() => tenantReopen(selected)}
              >
                Reabrir reclamo
              </Button>
            </Card>
          )}
        </Screen>
      )}
    </div>
  );
}
