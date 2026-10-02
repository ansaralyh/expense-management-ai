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
      <div className="bg-transparent border-0 shadow-none rounded-none ring-0 outline-none">
        <SmartFinLogo size={size} className="shrink-0" />
      </div>
      {subtitle ? <p className="text-[10px] sm:text-xs text-ink-400 mt-1 truncate">{subtitle}</p> : null}
    </>
  );

  const classes = `flex flex-col items-start gap-0 min-w-0 bg-transparent border-0 shadow-none ${className}`;

  if (href) {
    return (
      <Link href={href} scroll={false} onClick={onClick} className={classes}>
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
