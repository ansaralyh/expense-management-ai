'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import {
  EmptyState,
  ErrorBanner,
  MetricCard,
  PageCard,
  PageHeader,
  PageShell,
  PageSkeleton,
  PrimaryButton,
} from '../../../components/layout/PageLayout';
import { advancedService, ReconcileResult } from '../../../services/advanced.service';
import { ApiError } from '../../../lib/api';

const SAMPLE = `date,description,amount
2026-09-02,Rent,20000
2026-09-05,Utility bill,4500`;

export default function ReconcilePage() {
  const [csv, setCsv] = useState(SAMPLE);
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const match = async () => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      setResult(await advancedService.reconcile(csv));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to match this statement.');
    } finally {
      setLoading(false);
    }
  };

  const importMissing = async () => {
    if (!result?.statementOnly.length) return;
    setError('');
    try {
      const imported = await advancedService.importMissing(
        result.statementOnly.map((row) => ({
          ...row,
          description: row.description.length >= 2 ? row.description : 'Statement line',
        }))
      );
      setMessage(imported.message);
      setResult(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to add those expenses.');
    }
  };

  return (
    <PageShell>
      <PageHeader
        overline="Accounts"
        title="Statement reconciliation"
        description="Match a bank CSV to expenses within 3 days and 1% of the amount. Columns: date, description, amount."
        action={
          <PrimaryButton onClick={() => void match()} loading={loading} loadingLabel="Matching…">
            Match statement
          </PrimaryButton>
        }
      />

      <PageCard title="Bank statement CSV" subtitle="Paste or upload your statement">
        <textarea
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          rows={8}
          className="w-full p-3 rounded-md bg-slate-950 border border-slate-800 text-sm text-slate-100 font-mono"
        />
        <div className="flex flex-wrap gap-3">
          <label className="px-4 py-2 rounded-md border border-slate-700 text-sm text-slate-200 cursor-pointer hover:bg-slate-950 transition-colors">
            Choose CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) setCsv(await file.text());
              }}
            />
          </label>
        </div>
      </PageCard>

      {error ? <ErrorBanner message={error} onRetry={() => void match()} /> : null}
      {message ? (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          {message}
        </div>
      ) : null}

      {loading ? (
        <PageSkeleton rows={3} />
      ) : !result ? (
        <EmptyState
          icon={<Upload className="w-10 h-10" />}
          title="No reconciliation yet"
          description="Paste or upload a CSV statement, then match to compare against your SmartFin expense ledger."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <MetricCard label="Matched" value={String(result.counts.matched)} badge="SYNCED" badgeTone="best" />
            <MetricCard
              label="Statement only"
              value={String(result.counts.statementOnly)}
              badge="MISSING"
              badgeTone={result.counts.statementOnly > 0 ? 'warn' : 'neutral'}
            />
            <MetricCard label="Ledger only" value={String(result.counts.ledgerOnly)} badge="UNMATCHED" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ReconcileList
              title={`Matched (${result.counts.matched})`}
              rows={result.matched.map(
                (row) => `${row.statement.date} · Rs. ${row.statement.amount.toLocaleString()} · ${row.expenseDescription}`
              )}
            />
            <PageCard title={`In the statement only (${result.counts.statementOnly})`}>
              {result.statementOnly.length === 0 ? (
                <p className="text-xs text-slate-500">None</p>
              ) : (
                <div className="space-y-2">
                  {result.statementOnly.map((row) => (
                    <p key={`${row.date}-${row.amount}-${row.description}`} className="text-xs text-slate-400">
                      {row.date} · Rs. {row.amount.toLocaleString()} · {row.description}
                    </p>
                  ))}
                  <button
                    type="button"
                    onClick={() => void importMissing()}
                    className="text-sm text-emerald-400 hover:underline pt-2"
                  >
                    Add these as expenses
                  </button>
                </div>
              )}
            </PageCard>
            <ReconcileList
              title={`In SmartFin only (${result.counts.ledgerOnly})`}
              rows={result.ledgerOnly.map(
                (row) => `${row.date} · Rs. ${row.amount.toLocaleString()} · ${row.description}`
              )}
            />
          </div>
        </>
      )}
    </PageShell>
  );
}

function ReconcileList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <PageCard title={title}>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">None</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
          {rows.map((row) => (
            <p key={row} className="text-xs text-slate-400">
              {row}
            </p>
          ))}
        </div>
      )}
    </PageCard>
  );
}
