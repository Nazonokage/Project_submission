import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14161a',
        paper: '#faf9f6',
        accent: '#3b5bfd',
        muted: '#6b7280',
        line: '#e5e7eb',
        warn: '#b45309',
        danger: '#b91c1c',
        ok: '#15803d',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
