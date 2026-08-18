import { BellIcon, BrandMarkIcon, UserIcon } from "./icons";

type Props = {
  unread: number;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
};

export function AppHeader({ unread, onOpenNotifications, onOpenProfile }: Props) {
  return (
    <header className="safe-top bg-brand-700 pb-14 text-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pb-1">
        <div className="flex items-center gap-2">
          <BrandMarkIcon className="size-[22px]" />
          <p className="text-[17px] font-semibold tracking-[-0.02em]">Rently</p>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Notificaciones"
            className="relative rounded-full p-2 transition active:bg-white/10"
          >
            <BellIcon className="size-[22px]" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber-400 ring-2 ring-brand-700" />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenProfile}
            aria-label="Mi perfil"
            className="rounded-full p-2 transition active:bg-white/10"
          >
            <UserIcon className="size-[22px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
