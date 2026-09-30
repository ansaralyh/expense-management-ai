'use client';

import { useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  BrainCircuit,
  AlertTriangle,
  HeartPulse,
  Wallet,
  Receipt,
  PiggyBank,
  Target,
  Bot,
  FileText,
  UserCheck,
  ShieldCheck,
  LogOut,
  Upload,
  Repeat,
  Bell,
  Lightbulb,
  CreditCard,
  Scale,
} from 'lucide-react';
import { getInitials, useAuth } from '../../context/AuthContext';
import SmartFinBrand from '../brand/SmartFinBrand';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const navScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef(0);

  useLayoutEffect(() => {
    if (navScrollRef.current) {
      navScrollRef.current.scrollTop = savedScrollRef.current;
    }
  }, [pathname]);

  const handleNavClick = () => {
    if (navScrollRef.current) {
      savedScrollRef.current = navScrollRef.current.scrollTop;
    }
    setIsOpen(false);
  };

  const mainNav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Analytics', href: '/analytics', icon: TrendingUp },
    { name: 'Predictions', href: '/predictions', icon: BrainCircuit },
    { name: 'Forecast Lab', href: '/forecast-lab', icon: TrendingUp },
    { name: 'Anomalies', href: '/anomalies', icon: AlertTriangle },
    { name: 'Financial Health', href: '/financial-health', icon: HeartPulse },
    { name: 'Recommendations', href: '/recommendations', icon: Lightbulb },
    { name: 'Tax & Zakat', href: '/tax-planner', icon: FileText },
    { name: 'Spending Behavior', href: '/behavior', icon: Lightbulb },
    { name: 'Reconcile', href: '/reconcile', icon: Upload },
    { name: 'Life Plan', href: '/life-plan', icon: Scale },
  ];

  const managementNav = [
    { name: 'Income', href: '/income', icon: Wallet },
    { name: 'Expenses', href: '/expenses', icon: Receipt },
    { name: 'Import Excel', href: '/import', icon: Upload },
    { name: 'Bills & Recurring', href: '/recurring', icon: Repeat },
    { name: 'Budgets', href: '/budgets', icon: PiggyBank },
    { name: 'Savings Goals', href: '/savings-goals', icon: Target },
    { name: 'Debt & Loans', href: '/debts', icon: CreditCard },
    { name: 'Net Worth', href: '/networth', icon: Scale },
  ];

  const aiNav = [
    { name: 'Assistant', href: '/ai-assistant', icon: Bot },
    { name: 'Reports', href: '/reports', icon: FileText },
    { name: 'Notifications', href: '/notifications', icon: Bell },
    { name: 'Profile', href: '/profile', icon: UserCheck },
    ...(user?.role === 'ADMIN'
      ? [{ name: 'Administration', href: '/admin', icon: ShieldCheck }]
      : []),
  ];

  const renderNavGroup = (title: string, items: { name: string; href: string; icon: typeof LayoutDashboard }[]) => (
    <div className="space-y-0.5 py-2">
      <p className="px-3 pb-1.5 typo-overline text-ink-400">{title}</p>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            scroll={false}
            onClick={handleNavClick}
            className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-white/10 text-white'
                : 'text-ink-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-ink-400 group-hover:text-ink-100'}`} />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <>
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-ink-950/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-ink-900 text-ink-100 border-r border-ink-800 flex flex-col justify-between transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div
          ref={navScrollRef}
          className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar overscroll-contain"
          style={{ overflowAnchor: 'none' }}
        >
          <SmartFinBrand
            href="/dashboard"
            size={34}
            className="px-1"
            subtitle="Wealth & Planning"
            onClick={handleNavClick}
          />

          <hr className="border-ink-800" />

          <nav className="space-y-3">
            {renderNavGroup('Overview', mainNav)}
            {renderNavGroup('Accounts', managementNav)}
            {renderNavGroup('Workspace', aiNav)}
          </nav>
        </div>

        <div className="p-4 border-t border-ink-800 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-semibold text-xs shrink-0">
                {getInitials(user?.name)}
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name || 'Account'}</p>
                <p className="text-xs text-ink-400 truncate">{user?.email || 'Personal account'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="p-2 text-ink-400 hover:text-white transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
