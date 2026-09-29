'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { currentMonthKey } from '../../lib/ledger-events';
import {
  getPeriodDisplayLabel,
  PERIOD_PRESETS,
  type DashboardPeriodValue,
  type SummaryRange,
} from '../../lib/dashboard-period';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type PeriodFilterProps = {
  value: DashboardPeriodValue;
  onChange: (value: DashboardPeriodValue) => void;
};

function yearFromValue(value: DashboardPeriodValue) {
  if (/^\d{4}-\d{2}$/.test(value)) return parseInt(value.slice(0, 4), 10);
  return parseInt(currentMonthKey().slice(0, 4), 10);
}

export default function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => yearFromValue(value));
  const rootRef = useRef<HTMLDivElement>(null);

  const currentKey = currentMonthKey();
  const [currentYear, currentMonth] = currentKey.split('-').map(Number);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (/^\d{4}-\d{2}$/.test(value)) {
      setViewYear(parseInt(value.slice(0, 4), 10));
    }
  }, [value]);

  const selectPreset = (preset: SummaryRange) => {
    onChange(preset);
    setOpen(false);
  };

  const selectMonth = (monthIndex: number) => {
    const month = monthIndex + 1;
    if (viewYear > currentYear || (viewYear === currentYear && month > currentMonth)) return;
    onChange(`${viewYear}-${String(month).padStart(2, '0')}`);
    setOpen(false);
  };

  const isMonthDisabled = (monthIndex: number) => {
    const month = monthIndex + 1;
    return viewYear > currentYear || (viewYear === currentYear && month > currentMonth);
  };

  const isMonthSelected = (monthIndex: number) => {
    const month = monthIndex + 1;
    return value === `${viewYear}-${String(month).padStart(2, '0')}`;
  };

  const isPresetSelected = (preset: SummaryRange) => value === preset;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-slate-950 border border-slate-800 text-sm text-slate-100 hover:border-slate-700 transition-colors min-w-[10.5rem]"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="flex-1 text-left truncate">{getPeriodDisplayLabel(value)}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose period"
          className="absolute right-0 top-full z-50 mt-2 w-[17.5rem] rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden"
        >
          <div className="p-3 border-b border-slate-800 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Quick ranges</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PERIOD_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => selectPreset(preset.value)}
                  className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isPresetSelected(preset.value)
                      ? 'bg-ink-900 text-white'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-3 pt-3 pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Month & year</p>
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setViewYear((year) => year - 1)}
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                aria-label="Previous year"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-slate-100 tabular-nums">{viewYear}</span>
              <button
                type="button"
                onClick={() => setViewYear((year) => year + 1)}
                disabled={viewYear >= currentYear}
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Next year"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 max-h-44 overflow-y-auto pr-0.5">
              {MONTHS.map((label, index) => {
                const selected = isMonthSelected(index);
                const disabled = isMonthDisabled(index);
                const shortLabel = label.slice(0, 3);
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectMonth(index)}
                    title={label}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                      selected
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : disabled
                          ? 'text-slate-600 cursor-not-allowed'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                    }`}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
