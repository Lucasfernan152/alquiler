import {
  accumulateMonthlyPercent,
  type MonthlyIndexPoint,
} from "../domain/indices.js";

const IPC_URL = "https://api.argentinadatos.com/v1/finanzas/indices/inflacion";
const CACHE_MS = 6 * 60 * 60 * 1000;

let cachedIpc: { at: number; points: MonthlyIndexPoint[] } | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "rently-alquiler/1.0" },
  });
  if (!res.ok) throw new Error(`Índice no disponible (${res.status})`);
  return (await res.json()) as T;
}

/** Serie mensual de variación IPC (%). Cache en memoria ~6 h. */
export async function getIpcMonthlySeries(): Promise<MonthlyIndexPoint[]> {
  if (cachedIpc && Date.now() - cachedIpc.at < CACHE_MS) {
    return cachedIpc.points;
  }
  const raw = await fetchJson<Array<{ fecha: string; valor: number }>>(IPC_URL);
  const points = raw
    .filter((r) => r?.fecha && Number.isFinite(r.valor))
    .map((r) => {
      const d = new Date(r.fecha);
      return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        pct: r.valor,
      };
    })
    .sort((a, b) => a.year - b.year || a.month - b.month);
  cachedIpc = { at: Date.now(), points };
  return points;
}

function monthsBefore(end: Date, count: number) {
  const out: Array<{ year: number; month: number }> = [];
  let year = end.getUTCFullYear();
  let month = end.getUTCMonth() + 1; // 1-12 del mes del aumento
  for (let i = 0; i < count; i++) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    out.unshift({ year, month });
  }
  return out;
}

export type IndexEstimate = {
  pct: number;
  source: "ipc" | "icl";
  /** true si faltan meses publicados y se proyectaron con el promedio reciente */
  projected: boolean;
  monthsUsed: number;
  monthsExpected: number;
};

/**
 * Estima el % de aumento acumulado según IPC (o ICL≈IPC mientras no haya serie ICL).
 * Ventana: los N meses anteriores a la fecha del próximo aumento.
 */
export async function estimateIndexIncrease(input: {
  method: "ipc" | "icl";
  everyMonths: number;
  nextIncreaseDate: Date;
}): Promise<IndexEstimate | null> {
  const every = Math.max(1, Math.floor(input.everyMonths || 1));
  const series = await getIpcMonthlySeries();
  if (series.length === 0) return null;

  const window = monthsBefore(input.nextIncreaseDate, every);
  const byKey = new Map(series.map((p) => [`${p.year}-${p.month}`, p.pct]));
  const recent = series.slice(-3).map((p) => p.pct);
  const avgRecent =
    recent.length > 0
      ? recent.reduce((a, b) => a + b, 0) / recent.length
      : series[series.length - 1]!.pct;

  const values: number[] = [];
  let projected = false;
  for (const m of window) {
    const found = byKey.get(`${m.year}-${m.month}`);
    if (found != null) {
      values.push(found);
    } else {
      // Mes todavía no publicado: proyectamos con el promedio de los últimos 3.
      values.push(avgRecent);
      projected = true;
    }
  }

  const pct = Math.round(accumulateMonthlyPercent(values) * 100) / 100;
  return {
    pct,
    // ICL oficial no tiene serie abierta confiable: usamos IPC como aproximación.
    source: input.method,
    projected,
    monthsUsed: values.length,
    monthsExpected: every,
  };
}
