import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/** Full-width page container — matches predictions / dashboard hierarchy. */
export function PageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`w-full max-w-7xl mx-auto space-y-6 ${className}`}>{children}</div>;
}

type PageHeaderProps = {
  overline: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function PageHeader({ overline, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-card">
      <div className="space-y-1">
        <p className="typo-overline text-slate-400">{overline}</p>
        <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-100">{title}</h1>
        <p className="text-slate-400 text-xs md:text-sm max-w-2xl">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type PageCardProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  badge?: ReactNode;
};

export function PageCard({ children, className = '', title, subtitle, badge }: PageCardProps) {
  return (
    <section className={`p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-card space-y-4 ${className}`}>
      {(title || badge) && (
        <div className="flex items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-lg font-display font-semibold text-slate-100">{title}</h2> : null}
            {subtitle ? <p className="text-xs text-slate-400 mt-1">{subtitle}</p> : null}
          </div>
          {badge}
        </div>
      )}
      {children}
    </section>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  badge?: string;
  badgeTone?: 'best' | 'neutral' | 'warn';
};

export function MetricCard({ label, value, hint, badge, badgeTone = 'neutral' }: MetricCardProps) {
  const badgeClass =
    badgeTone === 'best'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : badgeTone === 'warn'
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        : 'bg-slate-950 text-slate-400 border-slate-800';

  return (
    <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        {badge ? (
          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${badgeClass}`}>{badge}</span>
        ) : null}
      </div>
      <p className="text-2xl font-display font-semibold text-slate-100">{value}</p>
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function PageBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'best' | 'neutral' | 'warn' | 'info';
}) {
  const toneClass =
    tone === 'best'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : tone === 'warn'
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        : tone === 'info'
          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
          : 'bg-slate-950 text-slate-400 border-slate-800';

  return (
    <span className={`inline-flex px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded border ${toneClass}`}>
      {children}
    </span>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="font-medium underline-offset-2 hover:underline shrink-0">
          Retry
        </button>
      ) : null}
    </div>
  );
}

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="p-10 rounded-xl bg-slate-900 border border-slate-800 shadow-card text-center space-y-3">
      {icon ? <div className="flex justify-center text-slate-500">{icon}</div> : null}
      <p className="text-slate-100 font-display font-semibold text-lg">{title}</p>
      <p className="text-sm text-slate-400 max-w-md mx-auto">{description}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-slate-800/60 border border-slate-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 rounded-xl bg-slate-800/60 border border-slate-800" />
        <div className="h-80 rounded-xl bg-slate-800/60 border border-slate-800" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-slate-800/40 border border-slate-800" />
        ))}
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  loadingLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="px-5 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      {loading ? loadingLabel || 'Loading…' : children}
    </button>
  );
}
