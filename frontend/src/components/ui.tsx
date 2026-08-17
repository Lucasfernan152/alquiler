import { useState } from "react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { ChevronRightIcon, EyeIcon, EyeOffIcon } from "./icons";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Spinner({
  className,
  style,
  spinning = true,
}: {
  className?: string;
  style?: CSSProperties;
  /** Apagado mientras el gesto de recarga se arrastra a mano. */
  spinning?: boolean;
}) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      style={style}
      className={cx(
        "inline-block rounded-full border-2 border-sand-300 border-t-brand-600",
        spinning && "animate-spin",
        className ?? "size-5",
      )}
    />
  );
}

/** Espacio en blanco con spinner centrado, para contenido que todavía no llegó. */
export function LoadingBlock({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center justify-center py-14", className)}>
      <Spinner className="size-7" />
    </div>
  );
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cx(
        "overflow-hidden rounded-2xl border border-sand-200/80 bg-white shadow-card",
        padded && "p-4",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card padded={false} className={cx("divide-y divide-sand-200/70", className)}>
      {children}
    </Card>
  );
}

export function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3 px-0.5">
      <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
      {action}
    </div>
  );
}

export function LinkButton({
  children,
  onClick,
  tone = "brand",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "brand" | "muted" | "danger";
}) {
  const styles = {
    brand: "text-brand-600",
    muted: "text-ink-500",
    danger: "text-brand-800",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("text-[13px] font-semibold transition hover:opacity-70", styles)}
    >
      {children}
    </button>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  block?: boolean;
  /** Muestra spinner y bloquea el botón mientras dura la acción. */
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  block,
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const styles = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
    secondary: "border border-sand-300 bg-white text-ink-900 hover:bg-sand-50",
    ghost: "text-ink-700 hover:bg-sand-100",
  }[variant];

  const sizes = {
    sm: "px-3 py-1.5 text-[13px]",
    md: "px-4 py-3 text-sm",
  }[size];

  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-45",
        block && "w-full",
        sizes,
        styles,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <Spinner
          className={cx(
            size === "sm" ? "size-3.5" : "size-4",
            variant === "primary"
              ? "border-white/40 border-t-white"
              : "border-sand-300 border-t-brand-600",
          )}
        />
      )}
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warn";
}) {
  const styles = {
    neutral: "bg-sand-100 text-ink-500",
    brand: "bg-brand-50 text-brand-700",
    success: "bg-sage-50 text-sage-700",
    warn: "bg-amber-50 text-amber-700",
  }[tone];

  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
        styles,
      )}
    >
      {children}
    </span>
  );
}

export function ListRow({
  icon,
  title,
  meta,
  value,
  onClick,
  right,
}: {
  icon?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  right?: ReactNode;
}) {
  const body = (
    <>
      {icon && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-ink-500">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink-900">
          {title}
        </span>
        {meta && <span className="mt-0.5 block truncate text-[13px] text-ink-500">{meta}</span>}
      </span>
      {value && (
        <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink-900">
          {value}
        </span>
      )}
      {right}
      {onClick && <ChevronRightIcon className="size-4 shrink-0 text-ink-400" />}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-sand-50"
      >
        {body}
      </button>
    );
  }

  return <div className="flex items-center gap-3 px-4 py-3.5">{body}</div>;
}

export const inputClass =
  "w-full rounded-xl border border-sand-200 bg-sand-50 px-3.5 py-3 text-[15px] text-ink-900 " +
  "placeholder:text-ink-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100";

export function PasswordInput({
  value,
  onChange,
  placeholder,
  minLength,
  required,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        className={cx(inputClass, "pr-12")}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-400 transition active:text-ink-700"
      >
        {visible ? (
          <EyeOffIcon className="size-[18px]" />
        ) : (
          <EyeIcon className="size-[18px]" />
        )}
      </button>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-700">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-9 text-center">
      {icon && (
        <div className="flex size-11 items-center justify-center rounded-full bg-sand-100 text-ink-400">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-semibold text-ink-900">{title}</p>
      {description && (
        <p className="max-w-[38ch] text-sm leading-relaxed text-ink-500">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
      {children}
    </p>
  );
}

export function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function shortDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

export function monthYear(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-AR", {
    month: "short",
    year: "numeric",
  });
}

export function longDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
