/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        surface: {
          void: '#08090A',
          base: '#0C0C0C',
          raised: '#141414',
          ink: '#F5F5F5',
          muted: '#A3A3A3',
          subtle: '#737373',
        },
        accent: {
          DEFAULT: '#D4954A',
          hover: '#E0A863',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        hairline: '0 0 0 1px rgba(255, 255, 255, 0.08)',
        'hairline-strong': '0 0 0 1px rgba(255, 255, 255, 0.15)',
        'hairline-accent': '0 0 0 1px rgba(212, 149, 74, 0.45)',
        'divider-b': '0 1px 0 0 rgba(255, 255, 255, 0.08)',
        'divider-t': '0 -1px 0 0 rgba(255, 255, 255, 0.08)',
      },
    },
  },
  plugins: [],
};
