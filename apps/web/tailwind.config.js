/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        /* Brand */
        brand: {
          DEFAULT: '#7c3aed',
          light:   '#a78bfa',
          dim:     '#6d28d9',
          glow:    'rgba(124,58,237,0.35)',
        },
        gold: {
          DEFAULT: '#f59e0b',
          light:   '#fcd34d',
          dim:     '#b45309',
        },
        /* Rarity */
        common:    '#64748b',
        rare:      '#3b82f6',
        epic:      '#a855f7',
        legendary: '#f59e0b',
        /* Elements */
        graph:  '#10b981',
        tree:   '#84cc16',
        math:   '#f97316',
        dp:     '#8b5cf6',
        string: '#ec4899',
        array:  '#06b6d4',
      },
      fontFamily: {
        cinzel:   ['Cinzel', 'serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
        grotesk:  ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'card-legendary': 'linear-gradient(135deg, #f59e0b, #fcd34d, #f59e0b, #d97706)',
        'card-epic':      'linear-gradient(135deg, #7c3aed, #a855f7, #7c3aed)',
        'card-rare':      'linear-gradient(135deg, #1d4ed8, #3b82f6, #1d4ed8)',
        'card-common':    'linear-gradient(135deg, #374151, #6b7280, #374151)',
        'mesh-brand':     'radial-gradient(ellipse 80% 55% at 15% 35%, rgba(124,58,237,0.15) 0%, transparent 60%), radial-gradient(ellipse 60% 45% at 85% 65%, rgba(79,70,229,0.12) 0%, transparent 55%)',
      },
      animation: {
        shimmer:       'shimmer 2s linear infinite',
        'card-flip':   'cardFlip 0.6s ease-in-out',
        'pack-reveal': 'packReveal 0.4s ease-out',
        float:         'float-soft 6s ease-in-out infinite',
        'float-med':   'float-soft 4s ease-in-out infinite',
        glow:          'glow-pulse 2.5s ease-in-out infinite',
        'pulse-slow':  'pulse-slow 3s ease-in-out infinite',
        'orb-drift':   'orb-drift 18s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        cardFlip: {
          '0%':   { transform: 'rotateY(0deg)' },
          '50%':  { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        packReveal: {
          '0%':   { transform: 'scale(0.8) translateY(20px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)',      opacity: '1' },
        },
        'float-soft': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 18px -4px rgba(245,158,11,0.5)' },
          '50%':      { boxShadow: '0 0 36px -2px rgba(245,158,11,0.85)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        'orb-drift': {
          '0%':   { transform: 'translate(0px, 0px) scale(1)' },
          '33%':  { transform: 'translate(40px, -25px) scale(1.05)' },
          '66%':  { transform: 'translate(-25px, 18px) scale(0.96)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
      },
      boxShadow: {
        'glow-gold':  '0 0 28px -4px rgba(245,158,11,0.55)',
        'glow-brand': '0 0 28px -4px rgba(124,58,237,0.55)',
        'glow-rare':  '0 0 24px -4px rgba(59,130,246,0.55)',
        'glow-epic':  '0 0 24px -4px rgba(168,85,247,0.55)',
        'card':       '0 20px 40px -15px rgba(2,4,12,0.9), 0 0 0 1px rgba(255,255,255,0.03) inset',
      },
    },
  },
  plugins: [],
};
