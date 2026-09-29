type SmartFinLogoProps = {
  className?: string;
  size?: number;
  title?: string;
};

const EMERALD = '#10B981';
const EMERALD_DARK = '#134338';
const EMERALD_MID = '#185544';
const SLATE = '#64748B';
const SLATE_DARK = '#475569';

/**
 * SmartFin "SF" monogram — interlocking S and F with an upward growth arrow.
 * Optimized for 24–48px display in nav chrome.
 */
export default function SmartFinLogo({ className, size = 36, title = 'SmartFin AI' }: SmartFinLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>

      {/* F — slate accent (behind S) */}
      <path d="M27 8H33V40H27V8Z" fill={SLATE_DARK} />
      <path d="M33 8H42V14H33V8Z" fill={SLATE} />
      <path d="M33 22H40V28H33V22Z" fill={SLATE} />

      {/* S — emerald body (isometric blocks) */}
      <path d="M8 36L8 28L18 28L22 32L18 36H8Z" fill={EMERALD_DARK} />
      <path d="M8 28L8 20L16 20L20 24L16 28H8Z" fill={EMERALD_MID} />
      <path d="M8 12L8 20L16 20L20 16L16 12H8Z" fill={EMERALD_DARK} />
      <path d="M8 12H16L20 16L16 20L8 20V12Z" fill={EMERALD} />

      {/* Growth arrow — cuts through S toward upper right */}
      <path
        d="M5 41L14 32L12 30L18 24L16 22L24 14L22 12L32 6L38 6L44 4L42 10L34 14L32 12L24 20L26 22L18 30L20 32L11 41H5Z"
        fill={EMERALD}
      />
      <path d="M34 6L44 4L42 10L32 14L34 6Z" fill="#34D399" opacity="0.85" />
    </svg>
  );
}
