'use client';

import { useEffect, useState } from 'react';
import { NotificationItem } from '../../../types';
import { Bell, CheckCircle2, AlertCircle } from 'lucide-react';
import { notificationService } from '../../../services/notification.service';
import { ApiError } from '../../../lib/api';

function formatWhen(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function notifyHeaderRefresh() {
  window.dispatchEvent(new Event('smartfin:notifications-changed'));
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState('');
  const unreadCount = items.filter((item) => !item.read).length;

  const loadItems = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await notificationService.list();
      setItems(result.notifications);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, []);

  const markAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    setError('');
    setItems((prev) => prev.map((row) => ({ ...row, read: true })));
    try {
      const result = await notificationService.markAllRead();
      setItems(result.notifications);
      notifyHeaderRefresh();
    } catch (err) {
      await loadItems();
      setError(err instanceof ApiError ? err.message : 'Unable to mark notifications as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const markOne = async (item: NotificationItem) => {
    if (item.read) return;
    try {
      const result = await notificationService.markRead(item.id);
      setItems((prev) => prev.map((row) => (row.id === item.id ? result.notification : row)));
      notifyHeaderRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update that notification.');
    }
  };

  return (
      <div className="space-y-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between p-6 rounded-3xl bg-slate-900 border border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
              <Bell className="w-3.5 h-3.5" /> Notification Center
            </div>
            <h1 className="text-2xl font-display font-semibold text-slate-100 mt-1">Notifications</h1>
            <p className="text-xs text-slate-400 mt-1">Budget alerts, goal progress, health score, forecasts, and anomalies.</p>
          </div>

          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={items.length === 0 || unreadCount === 0 || markingAll}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50"
          >
            {markingAll ? 'Updating…' : unreadCount === 0 ? 'All caught up' : `Mark all read (${unreadCount})`}
          </button>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button type="button" onClick={() => void loadItems()} className="font-medium underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading notifications…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400">No alerts right now. You are all caught up.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => void markOne(item)}
                className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                  item.read ? 'bg-slate-900/60 border-slate-800/80 opacity-75' : 'bg-slate-900 border-emerald-500/30 shadow-sm shadow-emerald-500/5'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-100 text-sm flex items-center gap-2">
                    {item.type === 'budget' || item.type === 'anomaly' || item.type === 'health' || item.type === 'prediction' ? (
                      <AlertCircle className={`w-4 h-4 ${item.type === 'health' ? 'text-rose-400' : item.type === 'prediction' ? 'text-blue-400' : 'text-amber-400'}`} />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {item.title}
                    {!item.read && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-400 border border-emerald-500/20">
                        New
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500 shrink-0">{formatWhen(item.date)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{item.message}</p>
              </button>
            ))}
          </div>
        )}
      </div>
  );
}
