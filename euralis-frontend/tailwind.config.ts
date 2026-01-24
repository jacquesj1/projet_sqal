import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        euralis: {
          primary: '#1E40AF',
          secondary: '#0EA5E9',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
      },
    },
  },
  plugins: [],
}

export default config
