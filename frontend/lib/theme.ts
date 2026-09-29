import type { CSSProperties } from 'react';

/** SmartFin visual tokens — institutional finance (navy, cream, forest). */

export const chartTheme = {
  income: '#1F6B56',
  expense: '#8A6A24',
  forecast: '#3D5570',
  sage: '#1F6B56',
  copper: '#8A6A24',
  brass: '#A07C2C',
  navy: '#122033',
  axis: '#7A828C',
  mutedBar: '#D8D4CC',
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#E6E2DA',
  tooltipText: '#1A1A1A',
  tickFontSize: 11,
  legendFontSize: 13,
  palette: [
    '#1F6B56',
    '#3D5570',
    '#8A6A24',
    '#5A4A72',
    '#9A3F38',
    '#2A6B66',
    '#334860',
    '#6B7580',
  ],
};

export const tooltipStyle: CSSProperties = {
  backgroundColor: chartTheme.tooltipBg,
  borderColor: chartTheme.tooltipBorder,
  borderRadius: '8px',
  fontSize: '11pt',
  color: chartTheme.tooltipText,
  boxShadow: '0 8px 24px rgba(18, 32, 51, 0.08)',
};
