'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Bell, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getInitials, useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notification.service';
import { searchService, SearchResult } from '../../services/search.service';
import { NotificationItem } from '../../types';

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

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

export default function Header({ setSidebarOpen }: HeaderProps) {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const unreadCount = notifications.filter((item) => !item.read).length;

  const loadNotifications = async () => {
    try {
      const result = await notificationService.list();
      setNotifications(result.notifications);
    } catch {
      setNotifications([]);
    }
  };

  useEffect(() => {
    void loadNotifications();
    const refresh = () => void loadNotifications();
    window.addEventListener('smartfin:notifications-changed', refresh);
    return () => window.removeEventListener('smartfin:notifications-changed', refresh);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await searchService.search(q);
        setSearchResults(res.results);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openNotificationsPage = () => {
    setShowNotifications(false);
    router.push('/notifications');
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-4 md:px-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 text-slate-400 hover:text-slate-100 rounded-md hover:bg-slate-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div ref={searchRef} className="relative hidden md:block w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim().length >= 2 && searchResults.length > 0) setSearchOpen(true);
            }}
            placeholder="Search transactions, budgets, goals (Ctrl+K)..."
            className="w-full pl-9 pr-12 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 rounded border border-slate-700">
            Ctrl K
          </kbd>
          {searchOpen && searchQuery.trim().length >= 2 && (
            <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-lift z-50 overflow-hidden">
              {searchLoading ? (
                <p className="px-4 py-3 text-xs text-slate-400">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-400">No results for &ldquo;{searchQuery.trim()}&rdquo;</p>
              ) : (
                <ul className="max-h-72 overflow-y-auto custom-scrollbar py-1">
                  {searchResults.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSearchOpen(false);
                          router.push(item.href);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-800/60 transition-colors"
                      >
                        <p className="text-sm font-medium text-slate-100 truncate">{item.title}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {item.subtitle}
                          {item.amount != null ? ` · Rs. ${item.amount.toLocaleString()}` : ''}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md border border-slate-800 text-xs font-medium text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Systems operational
        </div>

        <div ref={notificationRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) void loadNotifications();
            }}
            className="relative p-2 text-slate-400 hover:text-slate-100 rounded-md hover:bg-slate-800 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-ink-900 text-white text-overline font-semibold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-xl shadow-lift z-50 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="text-sm font-semibold text-slate-100">Notifications</h4>
                <button
                  type="button"
                  onClick={openNotificationsPage}
                  className="text-xs text-emerald-500 hover:underline"
                >
                  View all
                </button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No budget overruns or unresolved anomalies.</p>
                ) : (
                  notifications.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg text-sm space-y-1 border ${
                        item.read ? 'bg-slate-950/40 border-slate-800 text-slate-400' : 'bg-slate-950 border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-100 flex items-center gap-1.5">
                          {item.type === 'budget' || item.type === 'anomaly' ? (
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          {item.title}
                        </span>
                        <span className="text-xs text-slate-500 shrink-0">{formatWhen(item.date)}</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{item.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <Link href="/profile" className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-md hover:bg-slate-800 transition-colors">
          <div className="w-7 h-7 rounded-full bg-ink-900 text-white flex items-center justify-center font-semibold text-xs">
            {getInitials(user?.name)}
          </div>
          <span className="text-sm font-medium text-slate-100 hidden sm:inline-block">{user?.name || 'Account'}</span>
        </Link>
      </div>
    </header>
  );
}
