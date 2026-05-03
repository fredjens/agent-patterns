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
      <line x1="12" y1="6" x2="5" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="6" x2="19" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="6"  r="2.5" fill="currentColor" />
      <circle cx="5"  cy="18" r="2.5" fill="currentColor" />
      <circle cx="19" cy="18" r="2.5" fill="currentColor" />
    </svg>
  );
}
