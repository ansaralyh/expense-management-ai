import { ForecastBand, ForecastLabResult } from '../services/advanced.service';

function weightedRecentAverage(totals: number[]) {
  if (totals.length === 0) return 0;
  const recent = totals.slice(-3);
  const weights = [0.5, 0.3, 0.2].slice(-recent.length);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  return recent.reduce((sum, value, index) => sum + value * weights[index], 0) / weightSum;
}

function spendFloor(history: { total: number }[]) {
  if (history.length === 0) return 1;
  const totals = history.map((row) => row.total);
  const avg = totals.reduce((sum, value) => sum + value, 0) / totals.length;
  const wma = weightedRecentAverage(totals);
  const last = totals[totals.length - 1] || 0;
  return Math.max(avg * 0.4, wma * 0.35, last * 0.25, 1);
}

function bandNeedsFallback(band: ForecastBand) {
  return band.p50 <= 0 || band.p10 <= 0 || band.p90 <= 0;
}

function fallbackBand(band: ForecastBand, index: number, floor: number, wma: number): ForecastBand {
  const anchor = Math.max(floor, wma * 0.98 ** index);
  return {
    month: band.month,
    p10: band.p10 > 0 ? band.p10 : Math.round(anchor * 0.85),
    p50: band.p50 > 0 ? band.p50 : Math.round(anchor),
    p90: band.p90 > 0 ? band.p90 : Math.round(anchor * 1.15),
  };
}

/**
 * Ensures all six forecast months have non-zero bands when the ML service returns zeros
 * (e.g. negative trend clamped to 0 before the Python fix is deployed).
 */
export function normalizeForecastLabResult(result: ForecastLabResult): ForecastLabResult {
  const history = result.history || [];
  const floor = spendFloor(history);
  const wma = weightedRecentAverage(history.map((row) => row.total));

  const bands = (result.bands || []).map((band, index) =>
    bandNeedsFallback(band) ? fallbackBand(band, index, floor, wma) : band
  );

  // Preserve six-month horizon even if the API returns fewer rows.
  while (bands.length < 6 && history.length > 0) {
    const lastMonth = bands[bands.length - 1]?.month || history[history.length - 1].month;
    const [year, month] = lastMonth.split('-').map(Number);
    const nextIndex = year * 12 + (month - 1) + 1;
    const nextMonth = `${Math.floor(nextIndex / 12)}-${String((nextIndex % 12) + 1).padStart(2, '0')}`;
    bands.push(fallbackBand({ month: nextMonth, p10: 0, p50: 0, p90: 0 }, bands.length, floor, wma));
  }

  return { ...result, bands: bands.slice(0, 6) };
}
