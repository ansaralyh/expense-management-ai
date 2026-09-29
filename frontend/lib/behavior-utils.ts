import type { BehaviorResult } from '../services/advanced.service';
import { chartTheme } from './theme';

export function formatBehaviorMonth(monthKey: string) {
  const date = new Date(`${monthKey}-01T00:00:00.000Z`);
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function clusterColor(cluster: number) {
  return chartTheme.palette[cluster % chartTheme.palette.length];
}

export function computeBehaviorScore(result: BehaviorResult) {
  const wantPenalty = result.wantShare * 35;
  const silhouetteBonus = result.silhouette != null ? result.silhouette * 25 : 8;
  const months = result.months;
  let stabilityBonus = 0;
  if (months.length >= 2) {
    const latest = months[months.length - 1];
    const previous = months[months.length - 2];
    if (latest.cluster === previous.cluster) stabilityBonus += 12;
    if (Math.abs(latest.wantShare - previous.wantShare) <= 0.05) stabilityBonus += 8;
  }
  return Math.round(Math.min(100, Math.max(0, 72 - wantPenalty + silhouetteBonus + stabilityBonus)));
}

export function scoreTone(score: number): 'best' | 'neutral' | 'warn' {
  if (score >= 75) return 'best';
  if (score >= 50) return 'neutral';
  return 'warn';
}

export function scoreLabel(score: number) {
  if (score >= 75) return 'Healthy';
  if (score >= 50) return 'Moderate';
  return 'Needs attention';
}

export type MonthShift = {
  month: string;
  label: string;
  shift: string;
  delta: number;
};

export function topShifts(result: BehaviorResult): MonthShift[] {
  const rows: MonthShift[] = [];
  for (let i = 1; i < result.months.length; i += 1) {
    const prev = result.months[i - 1];
    const curr = result.months[i];
    const wantDelta = curr.wantShare - prev.wantShare;
    const totalDelta = prev.total === 0 ? 0 : ((curr.total - prev.total) / prev.total) * 100;

    if (curr.cluster !== prev.cluster) {
      rows.push({
        month: curr.month,
        label: `Cluster ${prev.cluster} → ${curr.cluster}`,
        shift: 'Spending pattern changed',
        delta: totalDelta,
      });
    } else if (Math.abs(wantDelta) >= 0.05) {
      rows.push({
        month: curr.month,
        label: wantDelta > 0 ? 'Want share increased' : 'Want share decreased',
        shift: `${Math.abs(Math.round(wantDelta * 100))}% vs prior month`,
        delta: totalDelta,
      });
    } else if (Math.abs(totalDelta) >= 10) {
      rows.push({
        month: curr.month,
        label: totalDelta > 0 ? 'Spending spike' : 'Spending drop',
        shift: `${Math.abs(Math.round(totalDelta))}% total change`,
        delta: totalDelta,
      });
    }
  }

  return rows.slice(-4).reverse();
}

export function tableRecommendation(
  row: BehaviorResult['months'][number],
  prev: BehaviorResult['months'][number] | null,
  topCategory: string
) {
  if (!prev) return 'Baseline month — establish pattern';
  if (row.cluster !== prev.cluster) return `Review ${topCategory} after cluster shift`;
  if (row.wantShare - prev.wantShare >= 0.08) return 'Trim discretionary categories next month';
  if (row.total > prev.total * 1.15) return 'Check for one-off large expenses';
  if (row.wantShare <= prev.wantShare - 0.05) return 'Positive trend — keep current mix';
  return 'On track — maintain budget discipline';
}
