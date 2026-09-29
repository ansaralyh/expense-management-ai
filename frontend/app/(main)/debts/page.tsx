'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Debt, debtService } from '../../../services/debt.service';
import { ApiError } from '../../../lib/api';
import { CreditCard, Plus, Pencil, Trash2 } from 'lucide-react';

const emptyForm = {
  name: '',
  principal: '',
  interestRate: '',
  tenureMonths: '',
  paidMonths: '0',
  startDate: new Date().toLocaleDateString('en-CA'),
  notes: '',
};

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [totalRemaining, setTotalRemaining] = useState(0);
  const [totalMonthlyEmi, setTotalMonthlyEmi] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const loadDebts = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await debtService.list();
      setDebts(res.debts);
      setTotalRemaining(res.totalRemaining);
      setTotalMonthlyEmi(res.totalMonthlyEmi);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load debts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDebts();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormData({ ...emptyForm, startDate: new Date().toLocaleDateString('en-CA') });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (item: Debt) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      principal: String(item.principal),
      interestRate: String(item.interestRate),
      tenureMonths: String(item.tenureMonths),
      paidMonths: String(item.paidMonths),
      startDate: item.startDate,
      notes: item.notes || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.principal || !formData.tenureMonths) {
      setFormError('Name, principal, and tenure are required.');
      return;
    }
    setFormError('');
    setSaving(true);
    const payload = {
      name: formData.name.trim(),
      principal: parseFloat(formData.principal),
      interestRate: parseFloat(formData.interestRate || '0'),
      tenureMonths: parseInt(formData.tenureMonths, 10),
      paidMonths: parseInt(formData.paidMonths || '0', 10),
      startDate: formData.startDate,
      notes: formData.notes.trim() || undefined,
    };
    try {
      if (editingId) {
        const res = await debtService.update(editingId, payload);
        setDebts((prev) => prev.map((item) => (item.id === editingId ? res.debt : item)));
      } else {
        const res = await debtService.create(payload);
        setDebts((prev) => [res.debt, ...prev]);
      }
      setShowModal(false);
      await loadDebts();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save debt.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this loan entry?')) return;
    try {
      await debtService.remove(id);
      setDebts((prev) => prev.filter((item) => item.id !== id));
      await loadDebts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete debt.');
    }
  };

  return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900 border border-slate-800">
          <div>
            <p className="typo-overline text-slate-400">Accounts</p>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-100 mt-1">Debt &amp; Loans</h1>
            <p className="text-slate-400 text-xs md:text-sm">
              Track EMIs, interest, and payoff progress for loans and credit obligations.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="px-5 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add loan
          </button>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button type="button" onClick={() => void loadDebts()} className="font-medium underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        )}

        {!loading && debts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase tracking-wider">Total remaining</span>
              <p className="text-2xl font-display font-semibold text-rose-400 mt-1">Rs. {totalRemaining.toLocaleString()}</p>
            </div>
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase tracking-wider">Monthly EMI total</span>
              <p className="text-2xl font-display font-semibold text-slate-100 mt-1">Rs. {totalMonthlyEmi.toLocaleString()}</p>
            </div>
          </div>
        )}

        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto">
          {loading ? (
            <p className="text-sm text-slate-400">Loading debts…</p>
          ) : debts.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <CreditCard className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-100">No loans tracked yet</p>
              <p className="text-sm text-slate-400">Add a home loan, car loan, or credit card EMI to monitor payoff.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="pb-3">Loan</th>
                  <th className="pb-3">EMI</th>
                  <th className="pb-3">Progress</th>
                  <th className="pb-3">Remaining</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {debts.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5">
                      <p className="font-medium text-slate-100">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.interestRate}% · {item.tenureMonths} mo · started {item.startDate}
                      </p>
                    </td>
                    <td className="py-3.5 text-slate-100 font-semibold">Rs. {item.emiAmount.toLocaleString()}</td>
                    <td className="py-3.5">
                      <div className="space-y-1">
                        <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${item.progressPercent}%` }} />
                        </div>
                        <span className="text-xs text-slate-400">{item.paidMonths}/{item.tenureMonths} mo ({item.progressPercent}%)</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-rose-400 font-medium">Rs. {item.remainingBalance.toLocaleString()}</td>
                    <td className="py-3.5 text-right">
                      <button onClick={() => openEdit(item)} className="p-1.5 text-slate-500 hover:text-slate-100" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => void handleDelete(item.id)} className="p-1.5 text-slate-500 hover:text-rose-500" title="Delete">
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
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lift max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-display font-semibold text-slate-100">{editingId ? 'Edit loan' : 'Add loan'}</h3>
                <form onSubmit={handleSave} className="space-y-4 text-sm">
                  {formError && (
                    <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-rose-500">{formError}</div>
                  )}
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Loan name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Home loan"
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Principal (Rs.)</label>
                      <input
                        type="number"
                        required
                        min="0.01"
                        value={formData.principal}
                        onChange={(e) => setFormData({ ...formData, principal: e.target.value })}
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Interest rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.interestRate}
                        onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Tenure (months)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.tenureMonths}
                        onChange={(e) => setFormData({ ...formData, tenureMonths: e.target.value })}
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Paid months</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.paidMonths}
                        onChange={(e) => setFormData({ ...formData, paidMonths: e.target.value })}
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Start date</label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Notes</label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Optional"
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md border border-slate-800 text-slate-300">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-ink-900 text-white disabled:opacity-60">
                      {saving ? 'Saving…' : editingId ? 'Update loan' : 'Save loan'}
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
