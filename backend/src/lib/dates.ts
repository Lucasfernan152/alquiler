/**
 * Fechas de calendario (inicio/fin/aumento) se guardan al mediodía UTC: así el
 * día no se corre al mostrarlas en zonas horarias negativas como Argentina.
 */
export function calendarDate(value: string | Date): Date | null {
  const date = typeof value === "string" ? parseLoose(value) : new Date(value);
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12),
  );
}

function parseLoose(value: string) {
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dayOnly) {
    return new Date(
      Date.UTC(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3]), 12),
    );
  }
  return new Date(value);
}
