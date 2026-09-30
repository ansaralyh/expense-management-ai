import Image from 'next/image';

type SmartFinLogoProps = {
  className?: string;
  size?: number;
  title?: string;
};

/** SmartFin AI wordmark — icon + SmartFin AI text from brand asset. */
export default function SmartFinLogo({ className = '', size = 36, title = 'SmartFin AI' }: SmartFinLogoProps) {
  const height = size;
  const width = Math.round(size * 3.35);

  return (
    <Image
      src="/smartfin-logo.jpg"
      alt={title}
      width={width}
      height={height}
      className={`object-contain object-left ${className}`}
      style={{ width, height }}
      priority
    />
  );
}
