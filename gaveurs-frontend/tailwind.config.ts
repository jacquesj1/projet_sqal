import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Alertes
        critique: '#dc2626',
        important: '#f97316',
        info: '#3b82f6',

        // Status
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',

        // UI
        primary: '#6366f1',
        secondary: '#8b5cf6',
        accent: '#06b6d4',
      },
    },
  },
  plugins: [],
};

export default config;
