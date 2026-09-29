'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NetWorthItem, networthService } from '../../../services/networth.service';
import { ApiError } from '../../../lib/api';
import { Scale, Plus, Pencil, Trash2 } from 'lucide-react';

const ASSET_CATEGORIES = ['Cash', 'Savings', 'Investment', 'Property', 'Other'];
const LIABILITY_CATEGORIES = ['Loan', 'Credit Card', 'Other'];

const emptyForm = {
  kind: 'asset' as 'asset' | 'liability',
  name: '',
  category: 'Savings',
  value: '',
  asOfDate: new Date().toLocaleDateString('en-CA'),
  notes: '',
};

export default function NetWorthPage() {
  const [items, setItems] = useState<NetWorthItem[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);
  const [debtRemaining, setDebtRemaining] = useState(0);
  const [netWorth, setNetWorth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const loadSummary = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await networthService.summary();
      setItems(res.items);
      setTotalAssets(res.totalAssets);
      setTotalLiabilities(res.totalLiabilities);
      setDebtRemaining(res.debtRemaining);
      setNetWorth(res.netWorth);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load net worth.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  const openCreate = (kind: 'asset' | 'liability' = 'asset') => {
    setEditingId(null);
    setFormData({
      ...emptyForm,
      kind,
      category: kind === 'asset' ? 'Savings' : 'Loan',
      asOfDate: new Date().toLocaleDateString('en-CA'),
    });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (item: NetWorthItem) => {
    setEditingId(item.id);
    setFormData({
      kind: item.kind,
      name: item.name,
      category: item.category,
      value: String(item.value),
      asOfDate: item.asOfDate,
      notes: item.notes || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.value) {
      setFormError('Name and value are required.');
      return;
    }
    setFormError('');
    setSaving(true);
    const payload = {
      kind: formData.kind,
      name: formData.name.trim(),
      category: formData.category,
      value: parseFloat(formData.value),
      asOfDate: formData.asOfDate,
      notes: formData.notes.trim() || undefined,
    };
    try {
      if (editingId) {
        await networthService.update(editingId, payload);
      } else {
        await networthService.create(payload);
      }
      setShowModal(false);
      await loadSummary();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save item.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this net worth item?')) return;
    try {
      await networthService.remove(id);
      await loadSummary();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete item.');
    }
  };

  const categories = formData.kind === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;
  const assets = items.filter((i) => i.kind === 'asset');
  const liabilities = items.filter((i) => i.kind === 'liability');

  return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900 border border-slate-800">
          <div>
            <p className="typo-overline text-slate-400">Accounts</p>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-100 mt-1">Net Worth</h1>
            <p className="text-slate-400 text-xs md:text-sm">
              Assets minus liabilities, including tracked loan balances from Debt &amp; Loans.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openCreate('asset')}
              className="px-4 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add asset
            </button>
            <button
              onClick={() => openCreate('liability')}
              className="px-4 py-2.5 rounded-md border border-slate-800 text-slate-300 font-medium text-sm flex items-center gap-2 hover:bg-slate-800"
            >
              <Plus className="w-4 h-4" /> Add liability
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button type="button" onClick={() => void loadSummary()} className="font-medium underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading net worth…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 uppercase tracking-wider">Total assets</span>
                <p className="text-2xl font-display font-semibold text-emerald-400 mt-1">Rs. {totalAssets.toLocaleString()}</p>
              </div>
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 uppercase tracking-wider">Total liabilities</span>
                <p className="text-2xl font-display font-semibold text-rose-400 mt-1">Rs. {totalLiabilities.toLocaleString()}</p>
              </div>
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 uppercase tracking-wider">Loan balance (debts)</span>
                <p className="text-xl font-semibold text-slate-300 mt-1">Rs. {debtRemaining.toLocaleString()}</p>
              </div>
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 uppercase tracking-wider">Net worth</span>
                <p className={`text-2xl font-display font-semibold mt-1 ${netWorth >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
                  Rs. {netWorth.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ItemSection title="Assets" items={assets} onEdit={openEdit} onDelete={handleDelete} emptyLabel="No assets recorded." />
              <ItemSection title="Liabilities" items={liabilities} onEdit={openEdit} onDelete={handleDelete} emptyLabel="No manual liabilities." />
            </div>
          </>
        )}

        {showModal &&
          createPortal(
            <div className="fixed inset-0 z-[80] bg-slate-950/70 flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lift">
                <h3 className="text-lg font-display font-semibold text-slate-100">
                  {editingId ? 'Edit item' : formData.kind === 'asset' ? 'Add asset' : 'Add liability'}
                </h3>
                <form onSubmit={handleSave} className="space-y-4 text-sm">
                  {formError && (
                    <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-rose-500">{formError}</div>
                  )}
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Type</label>
                    <select
                      value={formData.kind}
                      onChange={(e) => {
                        const kind = e.target.value as 'asset' | 'liability';
                        setFormData({
                          ...formData,
                          kind,
                          category: kind === 'asset' ? 'Savings' : 'Loan',
                        });
                      }}
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                    >
                      <option value="asset">Asset</option>
                      <option value="liability">Liability</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Value (Rs.)</label>
                      <input
                        type="number"
                        required
                        min="0.01"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">As of date</label>
                    <input
                      type="date"
                      required
                      value={formData.asOfDate}
                      onChange={(e) => setFormData({ ...formData, asOfDate: e.target.value })}
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md border border-slate-800 text-slate-300">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-ink-900 text-white disabled:opacity-60">
                      {saving ? 'Saving…' : 'Save'}
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

function ItemSection({
  title,
  items,
  onEdit,
  onDelete,
  emptyLabel,
}: {
  title: string;
  items: NetWorthItem[];
  onEdit: (item: NetWorthItem) => void;
  onDelete: (id: string) => void;
  emptyLabel: string;
}) {
  return (
    <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
      <h3 className="font-semibold text-base text-slate-100 flex items-center gap-2">
        <Scale className="w-4 h-4 text-teal-400" /> {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-sm">
              <div>
                <p className="font-medium text-slate-100">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.category} · {item.asOfDate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-100">Rs. {item.value.toLocaleString()}</span>
                <button onClick={() => onEdit(item)} className="p-1 text-slate-500 hover:text-slate-100">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => void onDelete(item.id)} className="p-1 text-slate-500 hover:text-rose-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
