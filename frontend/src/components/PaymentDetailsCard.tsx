import { useState } from "react";
import type { PaymentDetails } from "../types";
import { toast } from "./Toast";
import { Button } from "./ui";

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Copiado");
  } catch {
    toast.error("No se pudo copiar");
  }
}

export function PaymentDetailsCard({
  details,
  compact,
}: {
  details: PaymentDetails | null | undefined;
  compact?: boolean;
}) {
  const hasAny = Boolean(details?.alias || details?.cbu || details?.holder);
  if (!hasAny || !details) {
    return (
      <p className="text-[13px] text-ink-500">
        El dueño todavía no cargó alias ni CBU.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {!compact && (
        <p className="text-[13px] font-medium text-ink-500">Datos para transferir</p>
      )}
      {details.holder && (
        <div>
          <p className="text-[12px] font-medium text-ink-400">Titular</p>
          <p className="text-[15px] text-ink-900">{details.holder}</p>
        </div>
      )}
      {details.alias && (
        <CopyRow label="Alias" value={details.alias} />
      )}
      {details.cbu && <CopyRow label="CBU / CVU" value={details.cbu} />}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-ink-400">{label}</p>
        <p className="truncate text-[15px] font-semibold tabular-nums text-ink-900">
          {value}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          await copyText(value);
          setBusy(false);
        }}
      >
        Copiar
      </Button>
    </div>
  );
}
