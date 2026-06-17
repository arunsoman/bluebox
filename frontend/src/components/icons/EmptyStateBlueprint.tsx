export default function EmptyStateBlueprint({ className = '', size = 240 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Document page */}
      <rect
        x="56"
        y="32"
        width="128"
        height="176"
        rx="8"
        stroke="#00F5FF"
        strokeWidth="2"
        fill="rgba(0, 245, 255, 0.03)"
      />
      {/* Folded corner */}
      <path
        d="M152 32L184 64H160C155.6 64 152 60.4 152 56V32Z"
        stroke="#00F5FF"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="rgba(0, 245, 255, 0.05)"
      />
      {/* Title line */}
      <line x1="80" y1="88" x2="160" y2="88" stroke="#00F5FF" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      {/* Content lines */}
      <line x1="80" y1="112" x2="160" y2="112" stroke="#00F5FF" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <line x1="80" y1="128" x2="144" y2="128" stroke="#00F5FF" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      <line x1="80" y1="144" x2="152" y2="144" stroke="#00F5FF" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      {/* Checkmarks */}
      <circle cx="76" cy="172" r="12" stroke="#00F5FF" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M70 172L74 176L82 168" stroke="#00F5FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx="120" cy="172" r="12" stroke="#00F5FF" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M114 172L118 176L126 168" stroke="#00F5FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      {/* Blueprint grid dots */}
      <circle cx="64" cy="56" r="1" fill="#00F5FF" opacity="0.2" />
      <circle cx="80" cy="56" r="1" fill="#00F5FF" opacity="0.2" />
      <circle cx="96" cy="56" r="1" fill="#00F5FF" opacity="0.2" />
      <circle cx="112" cy="56" r="1" fill="#00F5FF" opacity="0.2" />
      <circle cx="128" cy="56" r="1" fill="#00F5FF" opacity="0.2" />
      <circle cx="144" cy="56" r="1" fill="#00F5FF" opacity="0.2" />
      <circle cx="160" cy="56" r="1" fill="#00F5FF" opacity="0.2" />
      <circle cx="64" cy="68" r="1" fill="#00F5FF" opacity="0.15" />
      <circle cx="80" cy="68" r="1" fill="#00F5FF" opacity="0.15" />
      <circle cx="96" cy="68" r="1" fill="#00F5FF" opacity="0.15" />
      <circle cx="112" cy="68" r="1" fill="#00F5FF" opacity="0.15" />
      <circle cx="128" cy="68" r="1" fill="#00F5FF" opacity="0.15" />
      <circle cx="144" cy="68" r="1" fill="#00F5FF" opacity="0.15" />
      <circle cx="160" cy="68" r="1" fill="#00F5FF" opacity="0.15" />
    </svg>
  );
}
