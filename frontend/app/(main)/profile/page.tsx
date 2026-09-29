'use client';

import { useEffect, useState } from 'react';
import { UserProfile } from '../../../types';
import { useRouter } from 'next/navigation';
import { Save, Download, Trash2, ShieldCheck, Lock, Cpu, Eye, CheckCircle2 } from 'lucide-react';
import { profileService } from '../../../services/profile.service';
import { ApiError } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

const GOALS: NonNullable<UserProfile['financialGoal']>[] = [
  'Save Money',
  'Buy a House',
  'Buy a Car',
  'Education',
  'Emergency Fund',
  'Investment',
  'Travel',
  'Other',
];

const emptyForm = {
  name: '',
  occupation: '',
  age: '',
  monthlyIncome: '',
  familySize: '1',
  financialGoal: 'Save Money' as NonNullable<UserProfile['financialGoal']>,
  riskPreference: 'Medium' as NonNullable<UserProfile['riskPreference']>,
};

export default function ProfilePage() {
  const router = useRouter();
  const { refreshUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'ai'>('profile');
  const [formData, setFormData] = useState(emptyForm);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);

  const [aiDataSharing, setAiDataSharing] = useState(true);
  const [aiMockMode, setAiMockMode] = useState(false);

  const loadProfile = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await profileService.get();
      const profile = res.profile;
      setEmail(profile.email || '');
      setFormData({
        name: profile.name || '',
        occupation: profile.occupation || '',
        age: profile.age != null ? String(profile.age) : '',
        monthlyIncome: profile.monthlyIncome != null ? String(profile.monthlyIncome) : '',
        familySize: String(profile.familySize || 1),
        financialGoal: profile.financialGoal || 'Save Money',
        riskPreference: profile.riskPreference || 'Medium',
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.age) {
      setFormError('Name and age are required.');
      return;
    }
    setFormError('');
    setSaving(true);
    setSaved(false);
    try {
      await profileService.update({
        name: formData.name.trim(),
        occupation: formData.occupation.trim(),
        age: parseInt(formData.age, 10),
        monthlyIncome: parseFloat(formData.monthlyIncome || '0'),
        familySize: parseInt(formData.familySize, 10) || 1,
        financialGoal: formData.financialGoal,
        riskPreference: formData.riskPreference,
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const res = await profileService.exportData();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smartfin-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to export data.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
      setDeleteError('Enter your password to confirm deletion.');
      return;
    }
    if (!window.confirm('Permanently delete your account and all financial data? This cannot be undone.')) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await profileService.deleteAccount(deletePassword);
      logout();
      router.replace('/login');
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Unable to delete account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="typo-overline text-slate-400">Workspace</p>
              <h1 className="text-2xl font-display font-semibold text-slate-100 mt-1">Profile &amp; Privacy Control</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                Manage your financial profile, AI privacy options, security, and data export.
              </p>
            </div>

            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'profile' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'security' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Privacy &amp; Security
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ai')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'ai' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                AI Settings
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button type="button" onClick={loadProfile} className="font-semibold underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="h-40 bg-slate-900 animate-pulse rounded-xl border border-slate-800" />
        ) : (
          <>
            {activeTab === 'profile' && (
              <form onSubmit={handleSave} className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-5 text-sm">
                {formError && (
                  <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-rose-500 text-xs">{formError}</div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1.5 font-medium text-xs">Full name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-ink-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1.5 font-medium text-xs">Email</label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-500 text-sm cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1.5 font-medium text-xs">Occupation</label>
                    <input
                      type="text"
                      value={formData.occupation}
                      onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                      className="w-full p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-ink-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1.5 font-medium text-xs">Age</label>
                    <input
                      type="number"
                      required
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="w-full p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-ink-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1.5 font-medium text-xs">Monthly Income Baseline (Rs.)</label>
                    <input
                      type="number"
                      value={formData.monthlyIncome}
                      onChange={(e) => setFormData({ ...formData, monthlyIncome: e.target.value })}
                      className="w-full p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-ink-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1.5 font-medium text-xs">Family Size</label>
                    <input
                      type="number"
                      value={formData.familySize}
                      onChange={(e) => setFormData({ ...formData, familySize: e.target.value })}
                      className="w-full p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-ink-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1.5 font-medium text-xs">Primary Goal</label>
                    <select
                      value={formData.financialGoal}
                      onChange={(e) => setFormData({ ...formData, financialGoal: e.target.value as any })}
                      className="w-full p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-ink-400"
                    >
                      {GOALS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1.5 font-medium text-xs">Risk Preference</label>
                    <select
                      value={formData.riskPreference}
                      onChange={(e) => setFormData({ ...formData, riskPreference: e.target.value as any })}
                      className="w-full p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-ink-400"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  {saved ? (
                    <span className="text-emerald-400 font-medium text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Financial profile saved.
                    </span>
                  ) : <span />}

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-3 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Profile'}</span>
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 text-slate-100 font-semibold">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span>Account Security &amp; Encryption</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Your financial data is strictly isolated to your authenticated account context using JWT authentication and bcrypt password hashing. API secrets and sensitive credentials are never stored client-side.
                  </p>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1 font-mono">
                    <p>• Status: Secure session active</p>
                    <p>• Authentication: Bearer JWT Token</p>
                    <p>• Server validation: Enforced on all API endpoints</p>
                  </div>
                </div>

                <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Export Complete Financial Data</h3>
                    <p className="text-xs text-slate-400 mt-1">Download your full history of income, expenses, budgets, goals, and net worth as structured JSON.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleExport()}
                    disabled={exporting}
                    className="px-5 py-2.5 rounded-md border border-slate-800 text-slate-100 hover:bg-slate-950 text-xs font-medium flex items-center gap-2 transition-colors shrink-0"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>{exporting ? 'Exporting...' : 'Export JSON Data'}</span>
                  </button>
                </div>

                <div className="p-6 rounded-xl bg-slate-900 border border-rose-500/20 space-y-4">
                  <div className="flex items-center gap-2 text-rose-400 font-semibold">
                    <Trash2 className="w-5 h-5" />
                    <span>Permanent Data Deletion</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Permanently delete your account and remove all stored income, expenses, budgets, and savings goals from our database.
                  </p>
                  <form onSubmit={handleDeleteAccount} className="space-y-3 text-xs max-w-md">
                    {deleteError && (
                      <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-500">{deleteError}</div>
                    )}
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Confirm password to delete account"
                      className="w-full p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-rose-500/50"
                    />
                    <button
                      type="submit"
                      disabled={deleting}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-xs"
                    >
                      {deleting ? 'Deleting...' : 'Delete Account Permanently'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-6">
                <div className="flex items-center gap-2 text-slate-100 font-semibold">
                  <Cpu className="w-5 h-5 text-emerald-400" />
                  <span>AI Copilot &amp; Privacy Preferences</span>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-950 border border-slate-800">
                    <div>
                      <p className="font-medium text-slate-100">Secure Financial Context Layer</p>
                      <p className="text-slate-400 mt-0.5">Only send minimal structured summary metrics to AI providers without raw database dumps.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={aiDataSharing}
                      onChange={(e) => setAiDataSharing(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-950 border border-slate-800">
                    <div>
                      <p className="font-medium text-slate-100">Deterministic Offline Engine Fallback</p>
                      <p className="text-slate-400 mt-0.5">Use local rule-based calculations when AI provider keys are not configured or offline.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={aiMockMode}
                      onChange={(e) => setAiMockMode(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
  );
}
