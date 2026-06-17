export default function EmptyStateChat({ className = '', size = 240 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Chat bubble */}
      <path
        d="M60 100C60 82.3 74.3 68 92 68H148C165.7 68 180 82.3 180 100V140C180 157.7 165.7 172 148 172H120L88 196V172H92C74.3 172 60 157.7 60 140V100Z"
        stroke="#00F5FF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="rgba(0, 245, 255, 0.05)"
      />
      {/* Lines inside chat bubble */}
      <line x1="84" y1="96" x2="156" y2="96" stroke="#00F5FF" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <line x1="84" y1="116" x2="136" y2="116" stroke="#00F5FF" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <line x1="84" y1="136" x2="120" y2="136" stroke="#00F5FF" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      {/* Sparkle 1 */}
      <path d="M48 56L52 64L60 68L52 72L48 80L44 72L36 68L44 64Z" fill="#00F5FF" opacity="0.8" />
      {/* Sparkle 2 */}
      <path d="M180 48L183 54L189 57L183 60L180 66L177 60L171 57L177 54Z" fill="#00F5FF" opacity="0.6" />
      {/* Sparkle 3 */}
      <path d="M196 96L198 100L202 102L198 104L196 108L194 104L190 102L194 100Z" fill="#00F5FF" opacity="0.5" />
      {/* Small decorative dots */}
      <circle cx="40" cy="120" r="3" fill="#00F5FF" opacity="0.3" />
      <circle cx="200" cy="140" r="2" fill="#00F5FF" opacity="0.3" />
      <circle cx="52" cy="160" r="2.5" fill="#00F5FF" opacity="0.2" />
    </svg>
  );
}
