import type { Config } from 'tailwindcss';

// TV app palette mirrors the main site (Solo Leveling dark theme) but is tuned
// for a 10-foot living-room UI: larger type, stronger focus states.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0A0A0F',
        surface: '#1E1E2E',
        primary: {
          DEFAULT: '#7C3AED',
          glow: '#A78BFA',
        },
        accent: '#A78BFA',
        action: '#DC2626',
      },
      fontFamily: {
        heading: ['var(--font-bebas)', 'Bebas Neue', 'sans-serif'],
        body: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        jp: ['var(--font-jp)', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(124, 58, 237, 0.45)',
        'glow-lg': '0 0 40px rgba(124, 58, 237, 0.55)',
        // The D-pad focus ring — bright accent halo so the focused element is
        // unmistakable from across the room.
        focus: '0 0 0 3px #A78BFA, 0 0 22px 3px rgba(167, 139, 250, 0.55)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
