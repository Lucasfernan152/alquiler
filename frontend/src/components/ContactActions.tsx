import { ChatIcon, PhoneIcon } from "./icons";
import { hasPhone, telHref, waHref } from "../lib/phone";
import { cx } from "./ui";

type Props = {
  phone?: string | null;
  /** Texto prearmado para WhatsApp. */
  waText?: string;
  className?: string;
};

export function ContactActions({ phone, waText, className }: Props) {
  if (!hasPhone(phone)) {
    return (
      <span className={cx("text-[12px] text-ink-400", className)}>Sin teléfono</span>
    );
  }

  return (
    <div className={cx("flex shrink-0 items-center gap-1.5", className)}>
      <a
        href={telHref(phone!)}
        aria-label="Llamar"
        className="flex size-9 items-center justify-center rounded-full bg-sand-100 text-ink-700 transition active:bg-sand-200"
      >
        <PhoneIcon className="size-[17px]" />
      </a>
      <a
        href={waHref(phone!, waText)}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp"
        className="flex size-9 items-center justify-center rounded-full bg-sage-50 text-sage-700 transition active:bg-sage-100"
      >
        <ChatIcon className="size-[17px]" />
      </a>
    </div>
  );
}
