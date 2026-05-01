/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sora: ['Sora', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg: '#0b0e18',
        bg2: '#111520',
        bg3: '#181d2e',
        card: '#141929',
        card2: '#1c2235',
        accent: '#6366f1',
        accent2: '#4f46e5',
        cyan: '#06b6d4',
        green: '#22c55e',
        red: '#ef4444',
        yellow: '#f59e0b',
        purple: '#8b5cf6',
        blue: '#3b82f6',
        muted: '#6b7591',
        muted2: '#8892aa',
      }
    },
  },
  plugins: [],
}
