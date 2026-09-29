'use client';

import { useEffect, useState } from 'react';
import { Anomaly } from '../../../types';
import { AlertTriangle, CheckCircle2, XCircle, Filter, RefreshCw } from 'lucide-react';
import { anomalyService } from '../../../services/anomaly.service';
import { ApiError } from '../../../lib/api';

function severityClass(severity: Anomaly['severity']) {
  if (severity === 'HIGH') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  if (severity === 'MEDIUM') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-slate-800 text-slate-300 border-slate-700';
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const loadAnomalies = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await anomalyService.list();
      setAnomalies(res.anomalies);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load anomalies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnomalies();
  }, []);

  const handleScan = async () => {
    setError('');
    setScanning(true);
    try {
      const res = await anomalyService.scan();
      setAnomalies(res.anomalies);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to scan expenses.');
    } finally {
      setScanning(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'VERIFIED' | 'DISMISSED') => {
    try {
      const res = await anomalyService.updateStatus(id, status);
      setAnomalies((prev) => prev.map((item) => (item.id === id ? res.anomaly : item)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update anomaly.');
    }
  };

  const filtered = filterSeverity === 'ALL' ? anomalies : anomalies.filter((item) => item.severity === filterSeverity);

  return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900 border border-slate-800">
          <div className="space-y-1">
            <p className="typo-overline text-slate-400">Machine learning</p>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-100">Unusual spend</h1>
            <p className="text-slate-400 text-xs md:text-sm">
              Isolation Forest on port 8000 flags expenses that look unusual against your own history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-md border border-slate-800">
              <Filter className="w-4 h-4 text-slate-400 ml-2" />
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as typeof filterSeverity)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none pr-3 py-1"
              >
                <option value="ALL" className="bg-slate-900">
                  All severities
                </option>
                <option value="HIGH" className="bg-slate-900">
                  High
                </option>
                <option value="MEDIUM" className="bg-slate-900">
                  Medium
                </option>
                <option value="LOW" className="bg-slate-900">
                  Low
                </option>
              </select>
            </div>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-5 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning…' : 'Scan expenses'}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button type="button" onClick={loadAnomalies} className="font-medium underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading anomalies…</p>
        ) : filtered.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-400">
            {anomalies.length === 0
              ? 'No anomalies stored yet. Add at least 8 expenses, then scan. The Python service must be running on port 8000.'
              : 'No anomalies match this severity filter.'}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((anom) => (
              <div key={anom.id} className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-md border ${severityClass(anom.severity)}`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-slate-100">{anom.expenseDescription}</h3>
                      <p className="text-xs text-slate-400">
                        {anom.category} · {new Date(anom.detectedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-rose-400">Rs. {anom.amount.toLocaleString()}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${severityClass(anom.severity)}`}>
                      {anom.severity}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-md border border-slate-800">
                  {anom.reason}
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4 text-slate-400">
                    <span>
                      Typical for category: <strong className="text-slate-200">Rs. {anom.normalAverage.toLocaleString()}</strong>
                    </span>
                    <span>
                      Score: <strong className="text-rose-400">{anom.anomalyScore}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {anom.status === 'UNRESOLVED' ? (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(anom.id, 'VERIFIED')}
                          className="px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/30 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark expected
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(anom.id, 'DISMISSED')}
                          className="px-3 py-1.5 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Dismiss
                        </button>
                      </>
                    ) : (
                      <span className="px-3 py-1 rounded-md bg-slate-950 text-emerald-400 border border-emerald-500/30 font-medium">
                        {anom.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  );
}
