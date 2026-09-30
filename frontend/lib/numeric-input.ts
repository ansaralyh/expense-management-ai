/** Strip leading zeros while typing (e.g. "067" → "67", keeps "0" and "0.5"). */
export function normalizeNumericInput(raw: string, options?: { integerOnly?: boolean }): string {
  if (raw === '') return '';

  if (raw === '-' || raw === '.' || raw === '-.') {
    return raw === '-.' ? '-0.' : raw;
  }

  const negative = raw.startsWith('-');
  let body = negative ? raw.slice(1) : raw;

  if (options?.integerOnly) {
    body = body.replace(/\D/g, '');
    if (body === '') return negative ? '-' : '';
    body = body.replace(/^0+(?=\d)/, '') || '0';
    return `${negative ? '-' : ''}${body}`;
  }

  const cleaned = body.replace(/[^\d.]/g, '');
  const dotIndex = cleaned.indexOf('.');
  let intPart: string;
  let decPart: string;

  if (dotIndex === -1) {
    intPart = cleaned;
    decPart = '';
  } else {
    intPart = cleaned.slice(0, dotIndex);
    decPart = cleaned.slice(dotIndex + 1).replace(/\./g, '');
  }

  if (intPart === '' && decPart === '' && dotIndex === -1) {
    return negative ? '-' : '';
  }

  const normalizedInt = intPart.replace(/^0+(?=\d)/, '') || '0';
  const hasDot = dotIndex !== -1;
  return `${negative ? '-' : ''}${normalizedInt}${hasDot ? `.${decPart}` : ''}`;
}

export function parseNumericInput(value: string, fallback = 0): number {
  if (value === '' || value === '-' || value === '.' || value === '-0.') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}
