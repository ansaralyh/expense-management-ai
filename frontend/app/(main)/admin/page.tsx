'use client';

import { useEffect, useState } from 'react';
import RoleGuard from '../../../components/auth/RoleGuard';
import { AuditLog } from '../../../types';
import { Lock } from 'lucide-react';
import { adminService, AdminUser } from '../../../services/admin.service';
import { ApiError } from '../../../lib/api';

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export default function AdminPage() {
  const [users, setUsers] = useState(0);
  const [transactions, setTransactions] = useState(0);
  const [predictions, setPredictions] = useState(0);
  const [anomalies, setAnomalies] = useState(0);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = async () => {
    setError('');
    setLoading(true);
    try {
      const [result, usersResult] = await Promise.all([adminService.overview(), adminService.listUsers()]);
      setUsers(result.users);
      setTransactions(result.transactions);
      setPredictions(result.predictions);
      setAnomalies(result.anomalies);
      setLogs(result.auditLogs);
      setAdminUsers(usersResult.users);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load admin overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const handleRoleToggle = async (user: AdminUser) => {
    const nextRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    setRoleUpdating(user.id);
    setError('');
    try {
      const res = await adminService.updateUserRole(user.id, nextRole);
      setAdminUsers((prev) => prev.map((item) => (item.id === user.id ? res.user : item)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update role.');
    } finally {
      setRoleUpdating(null);
    }
  };

  return (
      <RoleGuard>
        <div className="space-y-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between p-6 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <p className="typo-overline text-slate-400">Administration</p>
              <h1 className="text-2xl font-display font-semibold text-slate-100 mt-1">Audit portal</h1>
              <p className="text-xs text-slate-400 mt-1">Counts and logs from MongoDB. Mutations after this release are recorded automatically.</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
              <span>{error}</span>
              <button type="button" onClick={() => void loadOverview()} className="font-medium underline-offset-2 hover:underline">
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-400">Loading admin totals…</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">Total Registered Users</span>
                  <h3 className="text-2xl font-black text-slate-100">{users.toLocaleString()} Users</h3>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">Active Financial Transactions</span>
                  <h3 className="text-2xl font-black text-emerald-400">{transactions.toLocaleString()} Records</h3>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">ML Predictions Executed</span>
                  <h3 className="text-2xl font-black text-purple-400">{predictions.toLocaleString()} Forecasting Runs</h3>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">Detected Anomalies Flagged</span>
                  <h3 className="text-2xl font-black text-amber-400">{anomalies.toLocaleString()} Instances</h3>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="font-bold text-base text-slate-100">User management</h3>
                {adminUsers.length === 0 ? (
                  <p className="text-sm text-slate-400">No users found.</p>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                        <th className="pb-2">Name</th>
                        <th className="pb-2">Email</th>
                        <th className="pb-2">Role</th>
                        <th className="pb-2 text-right">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {adminUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-800/40">
                          <td className="py-3 font-semibold text-slate-100">{user.name}</td>
                          <td className="py-3">{user.email}</td>
                          <td className="py-3">
                            <button
                              type="button"
                              disabled={roleUpdating === user.id}
                              onClick={() => void handleRoleToggle(user)}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors disabled:opacity-60 ${
                                user.role === 'ADMIN'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                              }`}
                            >
                              {roleUpdating === user.id ? 'Updating…' : user.role}
                            </button>
                          </td>
                          <td className="py-3 text-right text-slate-500">{formatWhen(user.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-400" /> System Audit Logs
                </h3>

                {logs.length === 0 ? (
                  <p className="text-sm text-slate-400">No audited writes yet. Create or update income, expenses, budgets, or goals to add a log row.</p>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                        <th className="pb-2">User Name</th>
                        <th className="pb-2">Action</th>
                        <th className="pb-2">Module</th>
                        <th className="pb-2">IP Address</th>
                        <th className="pb-2 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/40">
                          <td className="py-3 font-semibold text-slate-100">{log.userName}</td>
                          <td className="py-3 font-mono text-purple-400 font-bold">{log.action}</td>
                          <td className="py-3 text-slate-400">{log.module}</td>
                          <td className="py-3 text-slate-400">{log.ipAddress}</td>
                          <td className="py-3 text-right text-slate-500">{formatWhen(log.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </RoleGuard>
  );
}
