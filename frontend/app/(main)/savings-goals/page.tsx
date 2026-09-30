'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GoalStatus, SavingsGoal } from '../../../types';
import { Target, Plus, Pencil, Trash2, Calendar, Wallet } from 'lucide-react';
import { goalService } from '../../../services/goal.service';
import { ApiError } from '../../../lib/api';
import ContributeModal from '../../../components/goals/ContributeModal';
import NumericInput from '../../../components/ui/NumericInput';

const PRIORITIES: SavingsGoal['priority'][] = ['LOW', 'MEDIUM', 'HIGH'];

const emptyForm = {
  name: '',
  targetAmount: '',
  currentAmount: '0',
  deadline: '',
  priority: 'MEDIUM' as SavingsGoal['priority'],
};

function statusClass(status: GoalStatus) {
  if (status === 'COMPLETED') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (status === 'OVERDUE') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
}

function priorityClass(priority: SavingsGoal['priority']) {
  if (priority === 'HIGH') return 'text-rose-400';
  if (priority === 'MEDIUM') return 'text-amber-400';
  return 'text-slate-400';
}

export default function SavingsGoalsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [contributing, setContributing] = useState<SavingsGoal | null>(null);
  const [toast, setToast] = useState('');

  const loadGoals = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await goalService.list();
      setGoals(res.goals);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load savings goals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGoals();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (goal: SavingsGoal) => {
    setEditingId(goal.id);
    setFormData({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      deadline: goal.deadline,
      priority: goal.priority,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.targetAmount || !formData.deadline) {
      setFormError('Name, target amount, and deadline are required.');
      return;
    }
    setFormError('');
    setSaving(true);
    const payload = {
      name: formData.name.trim(),
      targetAmount: parseFloat(formData.targetAmount),
      currentAmount: parseFloat(formData.currentAmount || '0'),
      deadline: formData.deadline,
      priority: formData.priority,
    };
    try {
      if (editingId) {
        await goalService.update(editingId, payload);
      } else {
        await goalService.create(payload);
      }
      setShowModal(false);
      setEditingId(null);
      await loadGoals();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save savings goal.');
    } finally {
      setSaving(false);
    }
  };

  const handleContributed = (updated: SavingsGoal) => {
    setGoals((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setContributing(null);
    setToast(`Contribution recorded for ${updated.name}.`);
    window.setTimeout(() => setToast(''), 3500);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this savings goal?')) return;
    try {
      await goalService.remove(id);
      setGoals((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete savings goal.');
    }
  };

  return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900 border border-slate-800">
          <div>
            <p className="typo-overline text-slate-400">Planning</p>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-100 mt-1">Savings goals</h1>
            <p className="text-slate-400 text-xs md:text-sm">
              Required monthly saving is based on remaining amount and months until the deadline.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="px-5 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add goal
          </button>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button type="button" onClick={loadGoals} className="font-medium underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading savings goals…</p>
        ) : goals.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-2">
            <Target className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-medium text-slate-100">No savings goals yet</p>
            <p className="text-sm text-slate-400">Add a target and deadline to see how much to save each month.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {goals.map((goal) => {
              const progress = goal.progress ?? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
              const history = goal.contributions || [];
              return (
                <div key={goal.id} className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-lg text-slate-100">{goal.name}</h3>
                      <p className={`text-xs font-semibold uppercase tracking-wide mt-1 ${priorityClass(goal.priority)}`}>
                        {goal.priority} priority
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusClass(goal.status)}`}>
                        {goal.status}
                      </span>
                      <button onClick={() => openEdit(goal)} className="p-1.5 text-slate-500 hover:text-slate-100" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(goal.id)} className="p-1.5 text-slate-500 hover:text-rose-500" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Progress ({progress}%)</span>
                      <span className="text-slate-100 font-semibold">
                        Rs. {goal.currentAmount.toLocaleString()} / Rs. {goal.targetAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-md bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Deadline</span>
                      <span className="text-slate-200 font-medium flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" /> {goal.deadline}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Remaining</span>
                      <span className="text-cyan-400 font-semibold">Rs. {goal.remaining.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Months left</span>
                      <span className="text-slate-200 font-medium">{goal.monthsRemaining}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                      <span>Required monthly</span>
                      <span className="text-emerald-400 font-semibold">
                        Rs. {goal.requiredMonthly.toLocaleString()}
                        {goal.monthsRemaining > 0 ? ' / month' : ''}
                      </span>
                    </div>
                  </div>

                  {goal.status !== 'COMPLETED' && (
                    <button
                      type="button"
                      onClick={() => setContributing(goal)}
                      className="w-full px-4 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center justify-center gap-2"
                    >
                      <Wallet className="w-4 h-4" /> Contribute / Pay
                    </button>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contribution history</p>
                    {history.length === 0 ? (
                      <p className="text-xs text-slate-500">No contributions yet.</p>
                    ) : (
                      <ul className="space-y-2 max-h-40 overflow-y-auto">
                        {history.map((entry) => (
                          <li
                            key={entry.id}
                            className="flex items-start justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs"
                          >
                            <div>
                              <p className="text-slate-200 font-medium">Rs. {entry.amount.toLocaleString()}</p>
                              <p className="text-slate-500">
                                {entry.date} · {entry.source === 'SALARY' ? 'Monthly salary / income' : 'Existing savings'}
                              </p>
                              {entry.notes ? <p className="text-slate-400 mt-1">{entry.notes}</p> : null}
                            </div>
                            <span className="text-slate-500 shrink-0">{entry.category}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 z-[90] rounded-md border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300 shadow-lift">
            {toast}
          </div>
        )}

        {contributing && (
          <ContributeModal
            goal={contributing}
            onClose={() => setContributing(null)}
            onSaved={handleContributed}
          />
        )}

        {showModal &&
          createPortal(
            <div className="fixed inset-0 z-[80] bg-slate-950/70 flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lift">
                <h3 className="text-lg font-display font-semibold text-slate-100">
                  {editingId ? 'Edit savings goal' : 'Add savings goal'}
                </h3>
                <form onSubmit={handleSave} className="space-y-4 text-sm">
                  {formError && (
                    <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-rose-500">{formError}</div>
                  )}
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Name</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={120}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Emergency fund"
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Target (Rs.)</label>
                      <NumericInput
                        required
                        value={formData.targetAmount}
                        onValueChange={(targetAmount) => setFormData({ ...formData, targetAmount })}
                        placeholder="400000"
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Saved so far (Rs.)</label>
                      <NumericInput
                        value={formData.currentAmount}
                        onValueChange={(currentAmount) => setFormData({ ...formData, currentAmount })}
                        placeholder="0"
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Deadline</label>
                      <input
                        type="date"
                        required
                        value={formData.deadline}
                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-medium">Priority</label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as SavingsGoal['priority'] })}
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                      >
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md border border-slate-800 text-slate-300">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-ink-900 text-white disabled:opacity-60">
                      {saving ? 'Saving…' : editingId ? 'Update goal' : 'Save goal'}
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
