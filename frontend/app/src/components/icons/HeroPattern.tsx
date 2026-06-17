import React from 'react';

const HeroPattern = React.memo(function HeroPattern({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', top: 0, left: 0, opacity: 0.06, pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="circuit-pattern" x="0" y="0" width="64" height="64" patternUnits="userSpaceOnUse">
          {/* Horizontal lines */}
          <line x1="0" y1="16" x2="32" y2="16" stroke="#00F5FF" strokeWidth="0.5" />
          <line x1="48" y1="16" x2="64" y2="16" stroke="#00F5FF" strokeWidth="0.5" />
          <line x1="0" y1="48" x2="16" y2="48" stroke="#00F5FF" strokeWidth="0.5" />
          <line x1="32" y1="48" x2="64" y2="48" stroke="#00F5FF" strokeWidth="0.5" />
          {/* Vertical lines */}
          <line x1="16" y1="0" x2="16" y2="32" stroke="#00F5FF" strokeWidth="0.5" />
          <line x1="16" y1="48" x2="16" y2="64" stroke="#00F5FF" strokeWidth="0.5" />
          <line x1="48" y1="0" x2="48" y2="16" stroke="#00F5FF" strokeWidth="0.5" />
          <line x1="48" y1="32" x2="48" y2="64" stroke="#00F5FF" strokeWidth="0.5" />
          {/* Dots at intersections */}
          <circle cx="16" cy="16" r="1.5" fill="#00F5FF" />
          <circle cx="48" cy="16" r="1.5" fill="#00F5FF" />
          <circle cx="16" cy="48" r="1.5" fill="#00F5FF" />
          <circle cx="48" cy="48" r="1.5" fill="#00F5FF" />
          {/* Corner dots */}
          <circle cx="0" cy="0" r="1" fill="#00F5FF" opacity="0.5" />
          <circle cx="64" cy="0" r="1" fill="#00F5FF" opacity="0.5" />
          <circle cx="0" cy="64" r="1" fill="#00F5FF" opacity="0.5" />
          <circle cx="64" cy="64" r="1" fill="#00F5FF" opacity="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#circuit-pattern)" />
    </svg>
  );
});

export default HeroPattern;
