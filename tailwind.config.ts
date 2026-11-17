import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: '#eef8f3',
          100: '#d6efe3',
          200: '#addfc8',
          300: '#7cc8a8',
          400: '#47ab85',
          500: '#1c8a67',
          600: '#167657',
          700: '#115f47',
          800: '#0e4c39',
          900: '#0b3b2d',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Kupon brand palette, shared with the marketing landing page.
        emerald: {
          50: '#eef8f3',
          100: '#d6efe3',
          200: '#addfc8',
          300: '#7cc8a8',
          400: '#47ab85',
          500: '#1c8a67',
          600: '#167657',
          700: '#115f47',
          800: '#0e4c39',
          900: '#0b3b2d',
          950: '#062219',
        },
        navy: {
          DEFAULT: '#0A1730',
          950: '#050D1D',
          900: '#0A1730',
          800: '#13244A',
          700: '#1F335F',
          600: '#34497A',
          300: '#A6B2CB',
          200: '#C5CFDF',
          100: '#E3E8F1',
          50: '#F2F4F7',
        },
        gold: {
          DEFAULT: '#E3C36F',
          50: '#FBF8F1',
          100: '#F6EDD3',
          200: '#EED385',
          300: '#E3C36F',
          500: '#C99D3F',
          600: '#A87B22',
          700: '#86611A',
        },
        ink: {
          DEFAULT: '#0A1730',
          muted: '#53607A',
        },
        paper: '#FBF8F1',
        canvas: '#F4F5F8',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(10 23 48 / 0.04)',
        lift: '0 14px 32px -16px rgb(10 23 48 / 0.28)',
        'emerald-glow': '0 12px 28px -16px rgb(28 138 103 / 0.45)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.25)', opacity: '0' },
          '100%': { transform: 'scale(1.25)', opacity: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-up': 'fade-up 0.35s ease-out both',
        'scale-in': 'scale-in 0.25s ease-out both',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
