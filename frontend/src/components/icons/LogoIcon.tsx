export default function LogoIcon({ className = '', size = 64 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Three connected nodes forming a triangle */}
      <circle cx="32" cy="12" r="6" stroke="#00F5FF" strokeWidth="2" fill="none" />
      <circle cx="12" cy="48" r="6" stroke="#00F5FF" strokeWidth="2" fill="none" />
      <circle cx="52" cy="48" r="6" stroke="#00F5FF" strokeWidth="2" fill="none" />
      {/* Connecting lines */}
      <line x1="32" y1="18" x2="14" y2="44" stroke="#00F5FF" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="48" x2="44" y2="48" stroke="#00F5FF" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="44" x2="36" y2="18" stroke="#00F5FF" strokeWidth="2" strokeLinecap="round" />
      {/* Inner glow dots */}
      <circle cx="32" cy="12" r="2.5" fill="#00F5FF" opacity="0.6" />
      <circle cx="12" cy="48" r="2.5" fill="#00F5FF" opacity="0.6" />
      <circle cx="52" cy="48" r="2.5" fill="#00F5FF" opacity="0.6" />
    </svg>
  );
}
