/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        common: '#9ca3af',
        rare: '#3b82f6',
        epic: '#a855f7',
        legendary: '#f59e0b',
        graph: '#10b981',
        tree: '#84cc16',
        math: '#f97316',
        dp: '#8b5cf6',
        string: '#ec4899',
        array: '#06b6d4',
      },
      animation: {
        shimmer: 'shimmer 2s linear infinite',
        'card-flip': 'cardFlip 0.6s ease-in-out',
        'pack-reveal': 'packReveal 0.4s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        cardFlip: {
          '0%': { transform: 'rotateY(0deg)' },
          '50%': { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        packReveal: {
          '0%': { transform: 'scale(0.8) translateY(20px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(245, 158, 11, 0.5)' },
          '50%': { boxShadow: '0 0 30px rgba(245, 158, 11, 0.9)' },
        },
      },
      backgroundImage: {
        'card-legendary': 'linear-gradient(135deg, #f59e0b, #fcd34d, #f59e0b, #d97706)',
        'card-epic': 'linear-gradient(135deg, #7c3aed, #a855f7, #7c3aed)',
        'card-rare': 'linear-gradient(135deg, #1d4ed8, #3b82f6, #1d4ed8)',
        'card-common': 'linear-gradient(135deg, #374151, #6b7280, #374151)',
      },
    },
  },
  plugins: [],
};
