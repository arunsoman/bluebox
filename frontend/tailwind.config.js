/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#050A14',
        abyss: '#080F1F',
        midnight: '#0D1A2D',
        ocean: '#0F2847',
        slate: '#1A3A5C',
        'cyan-core': '#00F5FF',
        'cyan-deep': '#00D4E5',
        'cyan-muted': 'rgba(0, 245, 255, 0.15)',
        'neon-green': '#39FF14',
        'signal-amber': '#FFB800',
        'signal-red': '#FF3366',
        'electric-violet': '#7B2FFF',
        'text-primary': '#E8F0FE',
        'text-secondary': '#8BA4C7',
        'text-tertiary': '#4A6487',
        'text-glow': 'rgba(0, 245, 255, 0.85)',
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      spacing: {
        'space-xs': '4px',
        'space-sm': '8px',
        'space-md': '16px',
        'space-lg': '24px',
        'space-xl': '32px',
        'space-2xl': '48px',
        'space-3xl': '64px',
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        'glow-cyan': '0 0 20px rgba(0, 245, 255, 0.15), 0 0 40px rgba(0, 245, 255, 0.05)',
        'glow-cyan-strong': '0 0 30px rgba(0, 245, 255, 0.25), 0 0 60px rgba(0, 245, 255, 0.1)',
        'glow-violet': '0 0 20px rgba(123, 47, 255, 0.15)',
        'shadow-float': '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
      backdropBlur: {
        glass: '20px',
        'glass-heavy': '40px',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0, 245, 255, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 245, 255, 0.4)' },
        },
        gradientShift: {
          '0%': { backgroundPosition: '0% 0%, 100% 100%, 50% 50%, 0% 0%' },
          '100%': { backgroundPosition: '100% 100%, 0% 0%, 50% 50%, 0% 0%' },
        },
        dashFlow: {
          '0%': { strokeDashoffset: '20' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        shimmer: 'shimmer 1.5s infinite',
        pulseGlow: 'pulseGlow 2s ease-in-out infinite',
        gradientShift: 'gradientShift 20s ease-in-out infinite alternate',
        dashFlow: 'dashFlow 1.5s linear infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
