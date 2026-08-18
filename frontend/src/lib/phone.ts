/** Solo dígitos, para tel: y WhatsApp. */
export function phoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function hasPhone(phone: string | null | undefined) {
  return phoneDigits(phone ?? "").length >= 8;
}

export function telHref(phone: string) {
  return `tel:${phoneDigits(phone)}`;
}

/**
 * Link de WhatsApp. Si el número parece local (10 dígitos), antepone 54
 * (Argentina). Mejor si el usuario carga el número con código de país.
 */
export function waHref(phone: string, text?: string) {
  let digits = phoneDigits(phone);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `54${digits}`;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${q}`;
}
