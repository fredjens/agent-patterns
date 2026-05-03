interface Props {
  size?: number;
  className?: string;
}

export function Logo({ size = 18, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <line x1="12" y1="12" x2="12" y2="3"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="20" y2="8"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="20" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="4"  y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="4"  y2="8"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <circle cx="12" cy="3"  r="1.8" fill="currentColor" />
      <circle cx="20" cy="8"  r="1.8" fill="currentColor" />
      <circle cx="20" cy="16" r="1.8" fill="currentColor" />
      <circle cx="12" cy="21" r="1.8" fill="currentColor" />
      <circle cx="4"  cy="16" r="1.8" fill="currentColor" />
      <circle cx="4"  cy="8"  r="1.8" fill="currentColor" />
    </svg>
  );
}
