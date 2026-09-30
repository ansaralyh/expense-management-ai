'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Income, IncomeType } from '../../../types';
import { Wallet, Plus, Search, Filter, Trash2, Pencil, Repeat } from 'lucide-react';
import { incomeService } from '../../../services/income.service';
import { ApiError } from '../../../lib/api';
import { notifyLedgerChanged } from '../../../lib/ledger-events';
import NumericInput from '../../../components/ui/NumericInput';

const emptyForm = {
  amount: '',
  source: '',
  date: new Date().toLocaleDateString('en-CA'),
  incomeType: 'Salary' as IncomeType,
  description: '',
  recurring: false,
};

export default function IncomePage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const loadIncomes = async (filters?: { search?: string; incomeType?: string }) => {
    setError('');
    setLoading(true);
    try {
      const res = await incomeService.list({
        search: filters?.search || undefined,
        incomeType: (filters?.incomeType as IncomeType | 'ALL') || 'ALL',
      });
      setIncomes(res.incomes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load income entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadIncomes({ search, incomeType: selectedType });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, selectedType]);

  const openCreate = () => {
    setEditingId(null);
    setFormData({ ...emptyForm, date: new Date().toLocaleDateString('en-CA') });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (item: Income) => {
    setEditingId(item.id);
    setFormData({
      amount: String(item.amount),
      source: item.source,
      date: item.date,
      incomeType: item.incomeType,
      description: item.description || '',
      recurring: item.recurring,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.source.trim()) {
      setFormError('Source and amount are required.');
      return;
    }
    setFormError('');
    setSaving(true);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(formData.date)
      ? formData.date
      : new Date().toLocaleDateString('en-CA');
    const payload = {
      amount: parseFloat(formData.amount),
      source: formData.source.trim(),
      date,
      incomeType: formData.incomeType,
      description: formData.description.trim() || undefined,
      recurring: formData.recurring,
    };
    try {
      if (editingId) {
        const res = await incomeService.update(editingId, payload);
        setIncomes((prev) => prev.map((item) => (item.id === editingId ? res.income : item)));
      } else {
        const res = await incomeService.create(payload);
        setIncomes((prev) => [res.income, ...prev]);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData(emptyForm);
      notifyLedgerChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save income entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this income entry?')) return;
    try {
      await incomeService.remove(id);
      setIncomes((prev) => prev.filter((item) => item.id !== id));
      notifyLedgerChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete income entry.');
    }
  };

  const total = incomes.reduce((acc, curr) => acc + curr.amount, 0);

  return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900 border border-slate-800">
          <div>
            <p className="typo-overline text-slate-400">Accounts</p>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-100 mt-1">Income</h1>
            <p className="text-slate-400 text-xs md:text-sm">
              Record salary, freelance, and other earnings. These entries are saved to your account.
            </p>
          </div>

          <button
            onClick={openCreate}
            className="px-5 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add income
          </button>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadIncomes({ search, incomeType: selectedType })}
              className="shrink-0 font-medium text-rose-500 underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search source or description"
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-md text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-ink-400"
            />
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-slate-950 text-sm text-slate-100 border border-slate-800 rounded-md px-3 py-2 focus:outline-none"
              >
                <option value="ALL">All types</option>
                <option value="Salary">Salary</option>
                <option value="Freelance">Freelance</option>
                <option value="Business">Business</option>
                <option value="Investment">Investment</option>
                <option value="Gift">Gift</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="text-sm text-slate-400">
              Total: <strong className="text-slate-100">Rs. {total.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto">
          {loading ? (
            <p className="text-sm text-slate-400">Loading income…</p>
          ) : incomes.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Wallet className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-100">No income entries yet</p>
              <p className="text-sm text-slate-400">Add your first salary or other earning to start the ledger.</p>
            </div>
          ) : incomes.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-100">No matching entries</p>
              <p className="text-sm text-slate-400">Try a different search or income type.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="pb-3">Source</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Recurring</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {incomes.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5">
                      <p className="font-medium text-slate-100">{item.source}</p>
                      {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                    </td>
                    <td className="py-3.5">
                      <span className="px-2.5 py-1 rounded-full bg-slate-950 text-emerald-500 border border-emerald-500/20 text-xs font-medium">
                        {item.incomeType}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-400">{item.date}</td>
                    <td className="py-3.5">
                      {item.recurring ? (
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
                          <Repeat className="w-3 h-3" /> Yes
                        </span>
                      ) : (
                        <span className="text-slate-500">One-time</span>
                      )}
                    </td>
                    <td className="py-3.5 text-right font-semibold text-slate-100">
                      Rs. {item.amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-slate-500 hover:text-slate-100 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showModal &&
          createPortal(
            <div className="fixed inset-0 z-[80] bg-slate-950/70 flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lift">
                <h3 className="text-lg font-display font-semibold text-slate-100">
                  {editingId ? 'Edit income' : 'Add income'}
                </h3>
                <form onSubmit={handleSave} className="space-y-4 text-sm">
                  {formError && (
                    <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-rose-500">
                      {formError}
                    </div>
                  )}
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Source</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      placeholder="e.g. Software salary"
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-ink-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Amount (Rs.)</label>
                      <NumericInput
                        required
                        value={formData.amount}
                        onValueChange={(amount) => setFormData({ ...formData, amount })}
                        placeholder="85000"
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-ink-400"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Type</label>
                      <select
                        value={formData.incomeType}
                        onChange={(e) => setFormData({ ...formData, incomeType: e.target.value as IncomeType })}
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none"
                      >
                        <option value="Salary">Salary</option>
                        <option value="Freelance">Freelance</option>
                        <option value="Business">Business</option>
                        <option value="Investment">Investment</option>
                        <option value="Gift">Gift</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Date</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-ink-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Description</label>
                    <input
                      type="text"
                      maxLength={240}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional notes"
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="recurring"
                      checked={formData.recurring}
                      onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                      className="rounded border-slate-800"
                    />
                    <label htmlFor="recurring" className="text-slate-300">
                      Recurring monthly payment
                    </label>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 rounded-md border border-slate-800 text-slate-300 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 rounded-md bg-ink-900 text-white font-medium disabled:opacity-60"
                    >
                      {saving ? 'Saving…' : editingId ? 'Update entry' : 'Save entry'}
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
