import { BellIcon } from "../components/icons";
import { Card, CardList, EmptyState, LinkButton, SectionHeading, cx } from "../components/ui";
import { api } from "../lib/api";
import { focusFromNotification } from "../lib/notificationNav";
import type { NavFocus } from "../lib/notificationNav";
import type { Notification } from "../types";

type Props = {
  items: Notification[];
  onChanged: () => void;
  onOpen: (focus: NavFocus) => void;
};

function relative(value: string) {
  const hours = Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000);
  if (hours < 1) return "Recién";
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Ayer" : `Hace ${days} días`;
}

export function NotificationsPage({ items, onChanged, onOpen }: Props) {
  const unread = items.filter((n) => !n.readAt).length;

  async function markRead(id: string) {
    await api.markNotificationRead(id);
    onChanged();
  }

  async function markAll() {
    await api.markAllNotificationsRead();
    onChanged();
  }

  async function openItem(item: Notification) {
    if (!item.readAt) {
      try {
        await markRead(item.id);
      } catch {
        // igual navegamos
      }
    }
    const focus = focusFromNotification(item);
    if (focus) onOpen(focus);
  }

  return (
    <div>
      <SectionHeading
        title={unread > 0 ? `Avisos · ${unread} sin leer` : "Avisos"}
        action={
          unread > 0 ? <LinkButton onClick={markAll}>Marcar leídas</LinkButton> : undefined
        }
      />

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BellIcon className="size-5" />}
            title="No hay avisos"
            description="Acá llegan los avisos de facturas listas, pagos y reclamos."
          />
        </Card>
      ) : (
        <CardList>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void openItem(item)}
              className="flex w-full gap-3 px-4 py-3.5 text-left transition active:bg-sand-50"
            >
              <span
                className={cx(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  item.readAt ? "bg-transparent" : "bg-brand-500",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={cx(
                      "truncate text-[15px] text-ink-900",
                      item.readAt ? "font-medium" : "font-semibold",
                    )}
                  >
                    {item.title}
                  </span>
                  <span className="shrink-0 text-xs text-ink-400">
                    {relative(item.createdAt)}
                  </span>
                </span>
                <span className="mt-0.5 block text-sm leading-relaxed text-ink-500">
                  {item.body}
                </span>
              </span>
            </button>
          ))}
        </CardList>
      )}
    </div>
  );
}
