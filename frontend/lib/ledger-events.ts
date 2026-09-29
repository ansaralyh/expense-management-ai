export const LEDGER_CHANGED_EVENT = 'smartfin:ledger-changed';

export function notifyLedgerChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LEDGER_CHANGED_EVENT));
  }
}

/** Current calendar month in the user's local timezone (YYYY-MM). */
export function currentMonthKey() {
  return new Date().toLocaleDateString('en-CA').slice(0, 7);
}
