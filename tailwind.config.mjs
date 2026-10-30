/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#121316',
          darker: '#0a0b0d',
          card: '#1a1c22',
          border: '#2a2d36',
          gold: '#d4af37',
          amber: '#e69d45',
          accent: '#e28743',
          light: '#f4f4f5',
          muted: '#9ca3af'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
};
