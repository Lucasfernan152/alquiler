export type MonthlyIndexPoint = {
  year: number;
  month: number;
  /** Variación porcentual de ese mes. */
  pct: number;
};

/** Acumula variaciones mensuales con interés compuesto: Π(1 + m/100) − 1. */
export function accumulateMonthlyPercent(monthlyPcts: number[]): number {
  let factor = 1;
  for (const pct of monthlyPcts) {
    if (!Number.isFinite(pct)) continue;
    factor *= 1 + pct / 100;
  }
  return (factor - 1) * 100;
}
