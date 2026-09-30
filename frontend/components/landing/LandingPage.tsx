'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  BrainCircuit, 
  TrendingUp, 
  AlertTriangle, 
  HeartPulse, 
  PiggyBank, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  Menu, 
  X, 
  Receipt, 
  Target, 
  Bot
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar 
} from 'recharts';
import { chartTheme, tooltipStyle } from '../../lib/theme';
import SmartFinBrand from '../brand/SmartFinBrand';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const heroCashflowData = [
    { month: 'May', income: 85000, expense: 65000 },
    { month: 'Jun', income: 88000, expense: 68000 },
    { month: 'Jul', income: 90000, expense: 72000 },
    { month: 'Aug', income: 97000, expense: 75000 },
    { month: 'Sep', income: 98500, expense: 78900 },
    { month: 'Oct (F)', income: 98500, expense: 82450 },
  ];

  const predictionShowcaseData = [
    { category: 'Food', actual: 14500, predicted: 16200 },
    { category: 'Rent', actual: 22000, predicted: 22000 },
    { category: 'Shopping', actual: 18500, predicted: 14000 },
    { category: 'Transport', actual: 6200, predicted: 7100 },
    { category: 'Utilities', actual: 4500, predicted: 4800 },
    { category: 'Leisure', actual: 8000, predicted: 8500 },
  ];

  const features = [
    {
      icon: BrainCircuit,
      title: 'Expense forecasting',
      description: 'Estimate next month’s spend from your own history using Linear Regression, Random Forest, and XGBoost.',
    },
    {
      icon: TrendingUp,
      title: 'Spending analytics',
      description: 'See category mix, savings rate, and month-to-month movement without digging through spreadsheets.',
    },
    {
      icon: AlertTriangle,
      title: 'Anomaly review',
      description: 'Flag unusual transactions against your baseline so large one-off charges are not missed.',
    },
    {
      icon: HeartPulse,
      title: 'Health score',
      description: 'A 0–100 index covering savings rate, budget adherence, stability, reserves, and goal pace.',
    },
    {
      icon: PiggyBank,
      title: 'Budgets & limits',
      description: 'Set overall and category limits, then track utilisation with clear 80%, 90%, and 100% thresholds.',
    },
  ];

  const howItWorksSteps = [
    {
      step: '01',
      title: 'Record activity',
      description: 'Log income, expenses, budgets, and savings goals in a single workspace.',
    },
    {
      step: '02',
      title: 'Review the picture',
      description: 'The system summarises cashflow, category mix, and recurring commitments.',
    },
    {
      step: '03',
      title: 'Plan the next month',
      description: 'Use forecasts, anomaly notes, and health diagnostics to adjust spending.',
    },
  ];

  const benefits = [
    { icon: Receipt, title: 'Track every expense', desc: 'Categorise spending with Need vs Want tags for a clearer monthly picture.' },
    { icon: TrendingUp, title: 'Read your patterns', desc: 'Spot velocity, seasonality, and recurring items before they compound.' },
    { icon: BrainCircuit, title: 'Forecast expenses', desc: 'Compare models and keep the best fit for your own records.' },
    { icon: ShieldAlert, title: 'Catch outliers', desc: 'Isolation Forest highlights statistical spikes against your baseline.' },
    { icon: PiggyBank, title: 'Hold a budget', desc: 'Overall and category limits with threshold alerts.' },
    { icon: Target, title: 'Fund goals', desc: 'See progress and the monthly amount still required.' },
    { icon: HeartPulse, title: 'Monitor health', desc: 'A weighted 0–100 score with plain-language diagnostics.' },
    { icon: Bot, title: 'Ask the books', desc: 'Query your own figures in natural language.' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all ${
        scrolled 
          ? 'bg-slate-900/95 border-b border-slate-800 py-3' 
          : 'bg-transparent py-5'
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <SmartFinBrand href="/" size={38} />

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-slate-100 transition-colors">Capabilities</a>
            <a href="#ai-insights" className="hover:text-slate-100 transition-colors">Forecasting</a>
            <a href="#how-it-works" className="hover:text-slate-100 transition-colors">How it works</a>
            <a href="#benefits" className="hover:text-slate-100 transition-colors">Coverage</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link 
              href="/login"
              className="text-sm font-medium text-slate-400 hover:text-slate-100 px-3 py-2 rounded-md"
            >
              Sign in
            </Link>
            <Link 
              href="/register"
              className="text-sm font-medium text-white bg-ink-900 hover:bg-ink-800 px-4 py-2 rounded-md transition-colors"
            >
              Open an account
            </Link>
          </div>

          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md border border-slate-800 text-slate-400"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-slate-800 px-6 py-5 space-y-3 text-sm font-medium">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-slate-400">Capabilities</a>
            <a href="#ai-insights" onClick={() => setMobileMenuOpen(false)} className="block text-slate-400">Forecasting</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block text-slate-400">How it works</a>
            <a href="#benefits" onClick={() => setMobileMenuOpen(false)} className="block text-slate-400">Coverage</a>
            <hr className="border-slate-800" />
            <Link href="/login" className="block py-2 text-slate-100">Sign in</Link>
            <Link href="/register" className="block py-2.5 text-center rounded-md bg-ink-900 text-white">Open an account</Link>
          </div>
        )}
      </nav>

      <section className="pt-28 pb-16 md:pt-36 md:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-5 space-y-6">
              <p className="typo-overline text-emerald-500">
                Personal finance, formally organised
              </p>
              <h1 className="text-4xl sm:text-5xl font-display font-semibold text-slate-100 leading-[1.15]">
                A clear view of income, spend, and the month ahead.
              </h1>
              <p className="text-slate-400 text-base leading-relaxed max-w-xl">
                Record transactions, hold budgets, and use model-backed forecasts to plan the next month — without the noise of a consumer money app.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <Link
                  href="/register"
                  className="px-5 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  Open an account <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#features"
                  className="px-5 py-2.5 rounded-md border border-slate-800 text-slate-100 text-sm font-medium flex items-center justify-center hover:bg-slate-900 transition-colors"
                >
                  View capabilities
                </a>
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Built for students and early professionals who want a disciplined ledger.
              </p>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-xl p-5 md:p-6 bg-slate-900 border border-slate-800 shadow-card space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100">Household overview</h4>
                    <p className="text-xs text-slate-500 mt-0.5">September 2026 · sample workspace</p>
                  </div>
                  <div className="text-xs font-medium text-slate-400 border border-slate-800 rounded-md px-2.5 py-1">
                    Health 78 / 100
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Income', value: 'Rs. 98,500', note: '+12.5%' },
                    { label: 'Expenses', value: 'Rs. 78,900', note: '67% needs' },
                    { label: 'Net savings', value: 'Rs. 19,600', note: '21.5% rate' },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-500 font-medium">{s.label}</span>
                      <p className="text-sm font-semibold text-slate-100 mt-1">{s.value}</p>
                      <span className="text-xs text-emerald-500">{s.note}</span>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500 font-semibold">Next-month forecast</p>
                    <h3 className="text-xl font-display font-semibold text-slate-100 mt-1">Rs. 82,450</h3>
                    <p className="text-xs text-slate-400 mt-0.5">XGBoost selected · R² 0.94</p>
                  </div>
                  <div className="text-xs font-medium text-amber-500">
                    +Rs. 3,550
                  </div>
                </div>

                <div className="h-32 w-full">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={heroCashflowData}>
                        <defs>
                          <linearGradient id="heroInc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartTheme.sage} stopOpacity={0.25}/>
                            <stop offset="95%" stopColor={chartTheme.sage} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="month" stroke={chartTheme.axis} fontSize={chartTheme.tickFontSize} tickLine={false} />
                        <YAxis hide />
                        <Area type="monotone" dataKey="income" stroke={chartTheme.sage} strokeWidth={2} fill="url(#heroInc)" />
                        <Area type="monotone" dataKey="expense" stroke={chartTheme.copper} strokeWidth={2} fill="transparent" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full bg-slate-950 rounded-md" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="typo-overline text-emerald-500">Capabilities</p>
            <h2 className="text-3xl sm:text-4xl font-display font-semibold text-slate-100 mt-2">
              The ledger, the forecast, and the exceptions.
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-3 leading-relaxed">
              Each module is designed for a viva-ready finance system: recorded data, measured models, and readable output.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="w-9 h-9 rounded-md border border-slate-800 text-ink-900 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display font-semibold text-lg text-slate-100">{f.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="ai-insights" className="py-20 border-t border-slate-800 bg-slate-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-5">
              <p className="typo-overline text-emerald-500">Forecasting</p>
              <h2 className="text-3xl sm:text-4xl font-display font-semibold text-slate-100 leading-tight">
                Know the likely spend before the month starts.
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Models are trained on your history, scored on MAE, RMSE, MAPE, and R², then the strongest result is used for the next-month estimate.
              </p>
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-sm font-semibold text-slate-100">Model comparison</span>
                  <p className="text-sm text-slate-400 mt-1">Linear Regression, Random Forest, and XGBoost are evaluated on the same records.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-sm font-semibold text-slate-100">Published metrics</span>
                  <p className="text-sm text-slate-400 mt-1">Error statistics stay visible so a forecast is never a black box.</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="p-6 md:p-8 rounded-xl bg-slate-900 border border-slate-800 shadow-card space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Predicted expense · October 2026</span>
                    <h3 className="text-3xl font-display font-semibold text-slate-100 mt-1">Rs. 82,450</h3>
                  </div>
                  <div className="text-xs font-medium text-slate-400 border border-slate-800 rounded-md px-2.5 py-1">
                    Selected: XGBoost
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'MAE', value: 'Rs. 1,420' },
                    { label: 'RMSE', value: 'Rs. 1,890' },
                    { label: 'R²', value: '0.94' },
                  ].map((m) => (
                    <div key={m.label} className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-500 block">{m.label}</span>
                      <strong className="text-sm font-semibold text-slate-100">{m.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="h-52 w-full">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={predictionShowcaseData}>
                        <XAxis dataKey="category" stroke={chartTheme.axis} fontSize={chartTheme.tickFontSize} tickLine={false} />
                        <YAxis stroke={chartTheme.axis} fontSize={chartTheme.tickFontSize} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                        <Tooltip 
                          contentStyle={tooltipStyle}
                          formatter={(val: number) => [`Rs. ${Number(val).toLocaleString()}`, 'Amount']}
                        />
                        <Bar dataKey="actual" fill={chartTheme.mutedBar} name="Current" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="predicted" fill={chartTheme.navy} name="Forecast" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full bg-slate-950 rounded-md" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="typo-overline text-emerald-500">Process</p>
            <h2 className="text-3xl sm:text-4xl font-display font-semibold text-slate-100 mt-2">How SmartFin is used</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {howItWorksSteps.map((s) => (
              <div key={s.step} className="p-7 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <span className="text-sm font-semibold tracking-[0.14em] text-slate-500">{s.step}</span>
                <h3 className="font-display font-semibold text-lg text-slate-100">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="benefits" className="py-20 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="typo-overline text-emerald-500">Coverage</p>
            <h2 className="text-3xl sm:text-4xl font-display font-semibold text-slate-100 mt-2">
              What the workspace covers
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.title} className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <Icon className="w-4 h-4 text-ink-900" />
                  <h4 className="font-semibold text-sm text-slate-100">{b.title}</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{b.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 md:p-12 rounded-xl bg-ink-900 text-white">
            <h2 className="text-3xl md:text-4xl font-display font-semibold leading-tight max-w-2xl">
              Keep the books in order. Let the models do the looking ahead.
            </h2>
            <p className="text-ink-300 text-sm mt-3 max-w-xl">
              Open a workspace, enter a month of activity, and read income, spend, and forecast side by side.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Link
                href="/register"
                className="px-5 py-2.5 rounded-md bg-white text-ink-900 text-sm font-medium hover:bg-ink-50 transition-colors text-center"
              >
                Open an account
              </Link>
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-md border border-white/20 text-white text-sm font-medium hover:bg-white/5 transition-colors text-center"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-10 text-sm text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div>
              <SmartFinBrand href="/" size={32} />
              <p className="text-slate-400 mt-3">Personal finance management and expense prediction.</p>
            </div>
            <div className="flex flex-wrap gap-5 text-slate-400">
              <a href="#features" className="hover:text-slate-100">Capabilities</a>
              <a href="#ai-insights" className="hover:text-slate-100">Forecasting</a>
              <Link href="/login" className="hover:text-slate-100">Sign in</Link>
              <Link href="/register" className="hover:text-slate-100">Register</Link>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-8">© 2026 SmartFin AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
