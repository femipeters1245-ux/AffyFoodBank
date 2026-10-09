/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FAF5FF',
          100: '#F3E8FF',
          200: '#E9D5FF',
          300: '#D8B4FE',
          400: '#C084FC',
          500: '#9333EA',  // Vivid Orchid Violet (from logo)
          600: '#7E22CE',  // Royal Purple
          700: '#581C87',  // Deep Violet
          800: '#3B0764',  // Dark Indigo Purple
          900: '#25104E',  // Exact Deep Brand Purple from logo
          950: '#180838',  // Midnight Purple
        },
        affy: {
          dark: '#24104F',
          purple: '#25104E',
          violet: '#9333EA',
          gold: '#F59E0B',
          lime: '#4ADE80',
          cyan: '#00D2D3',
          pink: '#EC4899',
          magenta: '#FF1378',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backgroundImage: {
        'affy-gradient': 'linear-gradient(135deg, #F59E0B 0%, #4ADE80 30%, #00D2D3 65%, #FF1378 100%)',
        'affy-dark-bg': 'linear-gradient(145deg, #24104F 0%, #170630 100%)',
      },
      boxShadow: {
        'glow': '0 0 25px -5px rgba(147, 51, 234, 0.35)',
        'glow-dark': '0 0 30px -5px rgba(36, 16, 79, 0.5)',
        'glow-accent': '0 0 25px -5px rgba(255, 19, 120, 0.35)',
      },
    },
  },
  plugins: [],
};
