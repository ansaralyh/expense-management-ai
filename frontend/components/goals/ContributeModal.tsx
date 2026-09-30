'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ContributionSource, SavingsGoal } from '../../types';
import { goalService } from '../../services/goal.service';
import { ApiError } from '../../lib/api';
import NumericInput from '../ui/NumericInput';

const SOURCES: { value: ContributionSource; label: string }[] = [
  { value: 'SALARY', label: 'Monthly Salary / Income' },
  { value: 'SAVINGS', label: 'Existing Savings Account' },
];

function todayLocal() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

type ContributeModalProps = {
  goal: SavingsGoal;
  onClose: () => void;
  onSaved: (goal: SavingsGoal) => void;
};

export default function ContributeModal({ goal, onClose, onSaved }: ContributeModalProps) {
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<ContributionSource>('SALARY');
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than 0.');
      return;
    }
    if (!date) {
      setError('Date of contribution is required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const result = await goalService.contribute(goal.id, {
        amount: value,
        source,
        date,
        notes: notes.trim(),
      });
      onSaved(result.goal);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to record this contribution.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-slate-950/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lift">
        <div>
          <h3 className="text-lg font-display font-semibold text-slate-100">Contribute to {goal.name}</h3>
          <p className="text-xs text-slate-400 mt-1">
            Remaining Rs. {goal.remaining.toLocaleString()} of Rs. {goal.targetAmount.toLocaleString()}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {error && (
            <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-rose-500">{error}</div>
          )}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">Amount to deposit (Rs.)</label>
            <NumericInput
              required
              value={amount}
              onValueChange={setAmount}
              placeholder="10000"
              className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">Payment source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as ContributionSource)}
              className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
            >
              {SOURCES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">Date of contribution</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">Notes / description</label>
            <textarea
              value={notes}
              maxLength={240}
              rows={3}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-slate-800 text-slate-300">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-ink-900 text-white disabled:opacity-60">
              {saving ? 'Saving…' : 'Record contribution'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
