'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '../../components/layout/AppLayout';
import { Expense, ExpenseCategory, PaymentMethod, TransactionType } from '../../types';
import { Receipt, Plus, Search, Filter, Trash2, Pencil, Repeat, Sparkles, AlertTriangle } from 'lucide-react';
import { expenseService } from '../../services/expense.service';
import { categorizeService, DuplicateExpense } from '../../services/categorize.service';
import { ApiError } from '../../lib/api';
import { notifyLedgerChanged } from '../../lib/ledger-events';

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

const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'Debit Card',
  'Credit Card',
  'Bank Transfer',
  'Mobile Wallet',
  'Other',
];

const emptyForm = {
  amount: '',
  description: '',
  category: 'Food' as ExpenseCategory,
  subcategory: '',
  date: new Date().toLocaleDateString('en-CA'),
  paymentMethod: 'Credit Card' as PaymentMethod,
  transactionType: 'NEED' as TransactionType,
  recurring: false,
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [deletingItem, setDeletingItem] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateExpense[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const loadExpenses = async (filters?: { search?: string; category?: string; transactionType?: string }) => {
    setError('');
    setLoading(true);
    try {
      const res = await expenseService.list({
        search: filters?.search || undefined,
        category: (filters?.category as ExpenseCategory | 'ALL') || 'ALL',
        transactionType: (filters?.transactionType as TransactionType | 'ALL') || 'ALL',
      });
      setExpenses(res.expenses);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load expense entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadExpenses({ search, category: selectedCategory, transactionType: selectedType });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, selectedType]);

  const openCreate = () => {
    setEditingId(null);
    setFormData({ ...emptyForm, date: new Date().toLocaleDateString('en-CA') });
    setFormError('');
    setDuplicates([]);
    setShowModal(true);
  };

  const openEdit = (item: Expense) => {
    setEditingId(item.id);
    setFormData({
      amount: String(item.amount),
      description: item.description,
      category: item.category,
      subcategory: item.subcategory || '',
      date: item.date,
      paymentMethod: item.paymentMethod,
      transactionType: item.transactionType,
      recurring: item.recurring,
    });
    setFormError('');
    setDuplicates([]);
    setShowModal(true);
  };

  const handleSuggestCategory = async () => {
    if (!formData.description.trim()) return;
    setSuggesting(true);
    setFormError('');
    try {
      const res = await categorizeService.suggest(formData.description);
      setFormData((prev) => ({ ...prev, category: res.suggestion.category }));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to suggest category.');
    } finally {
      setSuggesting(false);
    }
  };

  const checkDuplicates = async () => {
    const amount = parseFloat(formData.amount);
    if (!formData.description.trim() || !formData.amount || Number.isNaN(amount)) {
      setDuplicates([]);
      return [];
    }
    setCheckingDuplicates(true);
    try {
      const res = await categorizeService.duplicates(amount, formData.description, formData.date);
      const filtered = editingId ? res.duplicates.filter((d) => d.id !== editingId) : res.duplicates;
      setDuplicates(filtered);
      return filtered;
    } catch {
      setDuplicates([]);
      return [];
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description.trim()) {
      setFormError('Description and amount are required.');
      return;
    }
    setFormError('');
    const found = await checkDuplicates();
    if (found.length > 0) {
      const proceed = window.confirm(
        `Possible duplicate: ${found.length} similar expense(s) found near this date. Save anyway?`
      );
      if (!proceed) return;
    }
    setSaving(true);
    const payload = {
      amount: parseFloat(formData.amount),
      description: formData.description.trim(),
      category: formData.category,
      subcategory: formData.subcategory.trim() || undefined,
      date: formData.date,
      paymentMethod: formData.paymentMethod,
      transactionType: formData.transactionType,
      recurring: formData.recurring,
    };
    try {
      if (editingId) {
        const res = await expenseService.update(editingId, payload);
        setExpenses((prev) => prev.map((item) => (item.id === editingId ? res.expense : item)));
      } else {
        const res = await expenseService.create(payload);
        setExpenses((prev) => [res.expense, ...prev]);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData(emptyForm);
      setDuplicates([]);
      notifyLedgerChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save expense entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setDeleting(true);
    setError('');
    try {
      await expenseService.remove(deletingItem.id);
      setExpenses((prev) => prev.filter((item) => item.id !== deletingItem.id));
      setDeletingItem(null);
      notifyLedgerChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete expense entry.');
    } finally {
      setDeleting(false);
    }
  };

  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900 border border-slate-800">
          <div>
            <p className="typo-overline text-slate-400">Accounts</p>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-100 mt-1">Expenses</h1>
            <p className="text-slate-400 text-xs md:text-sm">
              Record spending with category, Need vs Want, and payment method. These entries are saved to your account.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/expenses/scan"
              className="px-4 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center gap-2 transition-colors shadow-xs"
            >
              <Sparkles className="w-4 h-4" /> Scan Receipt
            </a>
            <button
              onClick={openCreate}
              className="px-5 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add expense
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadExpenses({ search, category: selectedCategory, transactionType: selectedType })}
              className="shrink-0 font-medium text-rose-500 underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description or category"
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-md text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-ink-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-950 text-sm text-slate-100 border border-slate-800 rounded-md px-3 py-2 focus:outline-none"
              >
                <option value="ALL">All categories</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-slate-950 text-sm text-slate-100 border border-slate-800 rounded-md px-3 py-2 focus:outline-none"
            >
              <option value="ALL">Need & Want</option>
              <option value="NEED">NEED</option>
              <option value="WANT">WANT</option>
            </select>

            <div className="text-sm text-slate-400">
              Total: <strong className="text-slate-100">Rs. {totalSpent.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto">
          {loading ? (
            <p className="text-sm text-slate-400">Loading expenses…</p>
          ) : expenses.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Receipt className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-100">No expense entries yet</p>
              <p className="text-sm text-slate-400">Add your first purchase to start the spending ledger.</p>
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-100">No matching entries</p>
              <p className="text-sm text-slate-400">Try a different search, category, or Need/Want filter.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="pb-3">Description</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Need / Want</th>
                  <th className="pb-3">Payment</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {expenses.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5">
                      <p className="font-medium text-slate-100">{item.description}</p>
                      {item.subcategory && <p className="text-xs text-slate-500">{item.subcategory}</p>}
                      {item.recurring && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600">
                          <Repeat className="w-3 h-3" /> Recurring
                        </span>
                      )}
                    </td>
                    <td className="py-3.5">
                      <span className="px-2.5 py-1 rounded-full bg-slate-950 text-slate-300 border border-slate-800 text-xs font-medium">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.transactionType === 'NEED'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}
                      >
                        {item.transactionType}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-400">{item.paymentMethod}</td>
                    <td className="py-3.5 text-slate-400">{item.date}</td>
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
                        type="button"
                        onClick={() => setDeletingItem(item)}
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
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lift max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-display font-semibold text-slate-100">
                  {editingId ? 'Edit expense' : 'Add expense'}
                </h3>
                <form onSubmit={handleSave} className="space-y-4 text-sm">
                  {formError && (
                    <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-rose-500">
                      {formError}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-slate-400 font-medium">Description</label>
                      {formData.description.trim().length >= 2 && (
                        <button
                          type="button"
                          onClick={() => void handleSuggestCategory()}
                          disabled={suggesting}
                          className="text-xs text-emerald-500 hover:underline flex items-center gap-1 disabled:opacity-60"
                        >
                          <Sparkles className="w-3 h-3" /> {suggesting ? 'Suggesting…' : 'Suggest category'}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={240}
                      value={formData.description}
                      onChange={(e) => {
                        setFormData({ ...formData, description: e.target.value });
                        setDuplicates([]);
                      }}
                      onBlur={() => void checkDuplicates()}
                      placeholder="e.g. Supermarket groceries"
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-ink-400"
                    />
                  </div>
                  {duplicates.length > 0 && (
                    <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400 space-y-1">
                      <p className="font-medium flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Possible duplicate{duplicates.length > 1 ? 's' : ''} found
                      </p>
                      {duplicates.map((dup) => (
                        <p key={dup.id} className="text-amber-400/90">
                          {dup.description} · Rs. {dup.amount.toLocaleString()} · {dup.date}
                        </p>
                      ))}
                    </div>
                  )}
                  {checkingDuplicates && (
                    <p className="text-xs text-slate-500">Checking for duplicates…</p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Amount (Rs.)</label>
                      <input
                        type="number"
                        required
                        min="0.01"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        placeholder="14500"
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-ink-400"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none"
                      >
                        {CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Subcategory</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={formData.subcategory}
                      onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                      placeholder="Optional, e.g. Groceries"
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Need / Want</label>
                      <select
                        value={formData.transactionType}
                        onChange={(e) =>
                          setFormData({ ...formData, transactionType: e.target.value as TransactionType })
                        }
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none"
                      >
                        <option value="NEED">NEED (Essential)</option>
                        <option value="WANT">WANT (Discretionary)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Payment method</label>
                      <select
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none"
                      >
                        {PAYMENT_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
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
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="expense-recurring"
                      checked={formData.recurring}
                      onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                      className="rounded border-slate-800"
                    />
                    <label htmlFor="expense-recurring" className="text-slate-300">
                      Recurring monthly expense
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

        {deletingItem &&
          createPortal(
            <div
              className="fixed inset-0 z-[90] bg-slate-950/70 flex items-center justify-center p-4"
              onClick={() => {
                if (!deleting) setDeletingItem(null);
              }}
            >
              <div
                className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lift"
                onClick={(event) => event.stopPropagation()}
              >
                <div>
                  <h3 className="text-lg font-display font-semibold text-slate-100">Delete expense?</h3>
                  <p className="text-sm text-slate-400 mt-1">This entry will be removed from your ledger. This cannot be undone.</p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Description</span>
                    <span className="text-slate-100 font-medium text-right">{deletingItem.description}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Category</span>
                    <span className="text-slate-100">{deletingItem.category}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Need / Want</span>
                    <span className="text-slate-100">{deletingItem.transactionType}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Payment</span>
                    <span className="text-slate-100">{deletingItem.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Date</span>
                    <span className="text-slate-100">{deletingItem.date}</span>
                  </div>
                  <div className="flex justify-between gap-3 pt-2 border-t border-slate-800">
                    <span className="text-slate-400">Amount</span>
                    <span className="text-rose-400 font-semibold">Rs. {deletingItem.amount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setDeletingItem(null)}
                    className="px-4 py-2 rounded-md border border-slate-800 text-slate-300 font-medium disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                    className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-medium disabled:opacity-60"
                  >
                    {deleting ? 'Deleting…' : 'Delete entry'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </AppLayout>
  );
}
