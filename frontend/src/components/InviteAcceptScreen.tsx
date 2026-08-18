import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "./Toast";
import { Button, Card, ErrorText, Spinner } from "./ui";
import type { InvitePreview } from "../types";

const STORAGE_KEY = "alquiler_pending_invite";

export function readPendingInviteToken(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("invite");
    if (fromUrl) {
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      return fromUrl;
    }
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingInviteToken() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function InviteAcceptScreen({
  token,
  onDone,
  onSelectProperty,
}: {
  token: string;
  onDone: () => void;
  onSelectProperty: (propertyId: string) => void;
}) {
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .invitePreview(token)
      .then((data) => {
        if (active) setPreview(data);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Invitación inválida");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const result = await api.acceptInvite(token);
      clearPendingInviteToken();
      onSelectProperty(result.propertyId);
      toast.success("Te uniste a la unidad");
      onDone();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo aceptar la invitación";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Card>
        <p className="text-[13px] font-medium text-ink-500">Invitación</p>
        {preview ? (
          <>
            <h2 className="mt-1 text-xl font-semibold text-ink-900">
              {preview.property.buildingName} · {preview.property.label}
            </h2>
            <p className="mt-2 text-sm text-ink-500">
              {preview.property.ownerName} te invita a unirte
              {preview.property.address ? ` · ${preview.property.address}` : ""}.
            </p>
            <ErrorText>{error}</ErrorText>
            <div className="mt-5 flex gap-2">
              <Button
                variant="secondary"
                block
                onClick={() => {
                  clearPendingInviteToken();
                  onDone();
                }}
              >
                Ahora no
              </Button>
              <Button block loading={busy} onClick={accept}>
                Unirme
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-1 text-xl font-semibold text-ink-900">
              Invitación no válida
            </h2>
            <ErrorText>{error || "Este link ya no sirve."}</ErrorText>
            <Button
              className="mt-5"
              block
              onClick={() => {
                clearPendingInviteToken();
                onDone();
              }}
            >
              Continuar
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
