import Link from 'next/link';
import SmartFinLogo from './SmartFinLogo';

type SmartFinBrandProps = {
  href?: string;
  size?: number;
  className?: string;
  subtitle?: string;
  onClick?: () => void;
};

export default function SmartFinBrand({
  href = '/dashboard',
  size = 36,
  className = '',
  subtitle,
  onClick,
}: SmartFinBrandProps) {
  const content = (
    <>
      <SmartFinLogo size={size} className="shrink-0" />
      <div className="min-w-0">
        <p className="font-display text-sm sm:text-base font-semibold leading-none tracking-wide">
          <span className="text-inherit">SMARTFIN</span>{' '}
          <span className="text-[#10B981]">AI</span>
        </p>
        {subtitle ? <p className="text-[10px] sm:text-xs text-ink-400 mt-1 truncate">{subtitle}</p> : null}
      </div>
    </>
  );

  const classes = `flex items-center gap-2.5 min-w-0 ${className}`;

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <div className={classes} onClick={onClick} role={onClick ? 'button' : undefined}>
      {content}
    </div>
  );
}
