'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppLayout from '../../components/layout/AppLayout';
import { advancedService, ForecastLabResult } from '../../services/advanced.service';
import { ApiError } from '../../lib/api';
import { normalizeForecastLabResult } from '../../lib/forecast-fallback';
import { BrainCircuit, ChevronRight, RefreshCw, TrendingUp } from 'lucide-react';

export default function ForecastLabPage() {
  const [result, setResult] = useState<ForecastLabResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setError('');
    setLoading(true);
    try {
      const raw = await advancedService.forecast();
      setResult(normalizeForecastLabResult(raw));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to run the interval forecast.');
    } finally {
      setLoading(false);
    }
  };

  const max = Math.max(1, ...(result?.bands.map((band) => band.p90) || [1]));

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="typo-overline text-slate-400">Machine learning</p>
            <h1 className="text-2xl font-display font-semibold text-slate-100">Forecast lab</h1>
            <p className="text-sm text-slate-400 mt-1">
              Six-month spending ranges from a linear trend and bootstrap simulation. Requires 4+ months of expenses and
              the Python ML service on port 8000.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="px-5 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Running…' : 'Run forecast'}
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</div>
        )}

        {!result && !loading && (
          <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-400 space-y-3">
            <BrainCircuit className="w-8 h-8 text-slate-500" />
            <p className="text-slate-100 font-medium">No interval forecast yet</p>
            <p>
              This complements <strong className="text-emerald-400">Predictions</strong> (next-month ML models). Forecast
              lab shows a <strong className="text-slate-200">range</strong> of likely spend over the next six months.
            </p>
            <Link href="/predictions" className="inline-flex items-center gap-1 text-emerald-400 hover:underline text-sm">
              Open expense predictions <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {result && (
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-5">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              {result.model} · {result.monthsUsed} months of history · R² {result.r2} · {result.draws} simulations
            </div>
            <div className="space-y-4">
              {result.bands.map((band) => (
                <div key={band.month}>
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span className="font-medium text-slate-300">{band.month}</span>
                    <span>
                      Rs. {band.p10.toLocaleString()} – {band.p90.toLocaleString()} (median Rs. {band.p50.toLocaleString()})
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-800 relative overflow-hidden">
                    <div
                      className="absolute h-full bg-emerald-500/35"
                      style={{
                        left: `${(band.p10 / max) * 100}%`,
                        width: `${Math.max(2, ((band.p90 - band.p10) / max) * 100)}%`,
                      }}
                    />
                    <div className="absolute h-full w-1 bg-emerald-300" style={{ left: `${(band.p50 / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Bar = 10th–90th percentile range. Mark = median expected spend. Use Predictions for category-level next-month
              forecasts.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
