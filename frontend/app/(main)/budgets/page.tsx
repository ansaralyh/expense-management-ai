'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Budget, ExpenseCategory } from '../../../types';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { budgetService } from '../../../services/budget.service';
import { summaryService, BudgetVariance } from '../../../services/summary.service';
import { ApiError } from '../../../lib/api';
import { BarChart3 } from 'lucide-react';
import NumericInput from '../../../components/ui/NumericInput';

const CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Transport',
  'Rent',
  'Bills',
  'Education',
  'Healthcare',
  'Shopping',
  'Entertainment',
  'Travel',
  'Utilities',
  'Other',
];

const currentMonth = () => new Date().toISOString().slice(0, 7);

const emptyForm = {
  amount: '',
  month: currentMonth(),
  category: '' as '' | ExpenseCategory,
};

function utilClass(util: number) {
  if (util >= 100) return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
  if (util >= 80) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
}

function barClass(util: number) {
  if (util >= 100) return 'bg-rose-500';
  if (util >= 80) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function utilLabel(util: number) {
  if (util >= 100) return 'Exceeded';
  if (util >= 90) return 'Critical (90%)';
  if (util >= 80) return 'Warning (80%)';
  return 'On track';
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [variance, setVariance] = useState<BudgetVariance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const loadBudgets = async (selectedMonth = month) => {
    setError('');
    setLoading(true);
    try {
      const [budgetRes, summaryRes] = await Promise.all([
        budgetService.list(selectedMonth),
        summaryService.get(6, selectedMonth),
      ]);
      setBudgets(budgetRes.budgets);
      setVariance(summaryRes.budgetVariance || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load budgets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets(month);
  }, [month]);

  const openCreate = () => {
    setEditingId(null);
    setFormData({ ...emptyForm, month });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (item: Budget) => {
    setEditingId(item.id);
    setFormData({
      amount: String(item.amount),
      month: item.month,
      category: item.category || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount) {
      setFormError('Amount is required.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      if (editingId) {
        await budgetService.update(editingId, {
          amount: parseFloat(formData.amount),
          month: formData.month,
          category: formData.category || '',
        });
      } else {
        await budgetService.create({
          amount: parseFloat(formData.amount),
          month: formData.month,
          ...(formData.category ? { category: formData.category } : {}),
        });
      }
      setShowModal(false);
      setEditingId(null);
      await loadBudgets(formData.month);
      setMonth(formData.month);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this budget?')) return;
    try {
      await budgetService.remove(id);
      setBudgets((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete budget.');
    }
  };

  const overall = budgets.find((item) => !item.category);
  const categoryBudgets = budgets.filter((item) => item.category);

  return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900 border border-slate-800">
          <div>
            <p className="typo-overline text-slate-400">Accounts</p>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-100 mt-1">Budgets</h1>
            <p className="text-slate-400 text-xs md:text-sm">
              Set monthly limits. Spent is calculated from your expense entries for that month.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-2.5 rounded-md bg-slate-950 border border-slate-800 text-sm text-slate-100"
            />
            <button
              onClick={openCreate}
              className="px-5 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add budget
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button type="button" onClick={() => loadBudgets()} className="font-medium underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading budgets…</p>
        ) : (
          <>
            {overall ? (
              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-slate-400 font-semibold uppercase">Overall monthly budget</span>
                    <h3 className="text-2xl font-display font-semibold text-slate-100">
                      Rs. {overall.spent.toLocaleString()} / Rs. {overall.amount.toLocaleString()}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${utilClass(overall.utilization)}`}>
                      {overall.utilization}% used
                    </span>
                    <button onClick={() => openEdit(overall)} className="p-1.5 text-slate-500 hover:text-slate-100" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(overall.id)} className="p-1.5 text-slate-500 hover:text-rose-500" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barClass(overall.utilization)}`} style={{ width: `${Math.min(overall.utilization, 100)}%` }} />
                </div>
                <p className="text-xs text-slate-400">
                  Remaining: <strong className="text-slate-100">Rs. {overall.remaining.toLocaleString()}</strong>
                </p>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-400">
                No overall budget for this month. Add one to track total spend against a limit.
              </div>
            )}

            {variance.length > 0 && (
              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-teal-400" /> Budget vs actual variance
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                        <th className="pb-2 pr-4 font-semibold">Category</th>
                        <th className="pb-2 pr-4 font-semibold">Budgeted</th>
                        <th className="pb-2 pr-4 font-semibold">Actual</th>
                        <th className="pb-2 pr-4 font-semibold">Variance</th>
                        <th className="pb-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {variance.map((row) => (
                        <tr key={row.id}>
                          <td className="py-3 pr-4 text-slate-200">{row.category || 'Overall'}</td>
                          <td className="py-3 pr-4 text-slate-300">Rs. {row.budgeted.toLocaleString()}</td>
                          <td className="py-3 pr-4 text-slate-300">Rs. {row.actual.toLocaleString()}</td>
                          <td className={`py-3 pr-4 font-medium ${row.variance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {row.variance > 0 ? '+' : ''}Rs. {row.variance.toLocaleString()} ({row.variancePercent}%)
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                                row.status === 'over'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  : row.status === 'under'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {row.status === 'over' ? 'Over' : row.status === 'under' ? 'Under' : 'On track'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Category limits</h3>
              {categoryBudgets.length === 0 ? (
                <p className="text-sm text-slate-400">No category budgets yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {categoryBudgets.map((item) => (
                    <div key={item.id} className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-slate-100">{item.category}</span>
                        <div className="flex items-center gap-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${utilClass(item.utilization)}`}>
                            {utilLabel(item.utilization)}
                          </span>
                          <button onClick={() => openEdit(item)} className="p-1 text-slate-500 hover:text-slate-100" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-500 hover:text-rose-500" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">
                        Spent: <strong className="text-slate-100">Rs. {item.spent.toLocaleString()}</strong> of Rs.{' '}
                        {item.amount.toLocaleString()}
                      </p>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barClass(item.utilization)}`} style={{ width: `${Math.min(item.utilization, 100)}%` }} />
                      </div>
                      <div className="text-xs text-slate-500 flex justify-between">
                        <span>Remaining: Rs. {item.remaining.toLocaleString()}</span>
                        <span>{item.utilization}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {showModal &&
          createPortal(
            <div className="fixed inset-0 z-[80] bg-slate-950/70 flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lift">
                <h3 className="text-lg font-display font-semibold text-slate-100">
                  {editingId ? 'Edit budget' : 'Add budget'}
                </h3>
                <form onSubmit={handleSave} className="space-y-4 text-sm">
                  {formError && (
                    <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-rose-500">{formError}</div>
                  )}
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Month</label>
                    <input
                      type="month"
                      required
                      value={formData.month}
                      onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as '' | ExpenseCategory })}
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                    >
                      <option value="">Overall (all expenses)</option>
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Limit (Rs.)</label>
                    <NumericInput
                      required
                      value={formData.amount}
                      onValueChange={(amount) => setFormData({ ...formData, amount })}
                      placeholder="75000"
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md border border-slate-800 text-slate-300">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-ink-900 text-white disabled:opacity-60">
                      {saving ? 'Saving…' : editingId ? 'Update budget' : 'Save budget'}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}
      </div>
  );
}
