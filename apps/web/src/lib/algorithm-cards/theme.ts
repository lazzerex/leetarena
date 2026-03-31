import type { AlgorithmThemeTokens } from '@leetarena/types';

const DEFAULT_THEME: AlgorithmThemeTokens = {
  surface: '#1d2430',
  border: '#94a3b8',
  accent: '#cbd5e1',
  chip: '#2a3342',
  text: '#e2e8f0',
  glow: 'rgba(148, 163, 184, 0.35)',
};

export const ALGORITHM_THEME_TEMPLATES: Record<string, AlgorithmThemeTokens> = {
  tide: {
    surface: '#0d1f2f',
    border: '#3ba7e5',
    accent: '#7dd3fc',
    chip: '#11344c',
    text: '#e0f2fe',
    glow: 'rgba(56, 189, 248, 0.35)',
  },
  forest: {
    surface: '#10261c',
    border: '#38b26f',
    accent: '#86efac',
    chip: '#183629',
    text: '#dcfce7',
    glow: 'rgba(34, 197, 94, 0.35)',
  },
  neon: {
    surface: '#1a1433',
    border: '#8b5cf6',
    accent: '#c4b5fd',
    chip: '#2a1f4d',
    text: '#ede9fe',
    glow: 'rgba(139, 92, 246, 0.35)',
  },
  ember: {
    surface: '#2b170f',
    border: '#f97316',
    accent: '#fdba74',
    chip: '#3a2015',
    text: '#ffedd5',
    glow: 'rgba(249, 115, 22, 0.35)',
  },
  stone: {
    surface: '#1d2430',
    border: '#94a3b8',
    accent: '#cbd5e1',
    chip: '#2a3342',
    text: '#e2e8f0',
    glow: 'rgba(148, 163, 184, 0.35)',
  },
  rose: {
    surface: '#2c1220',
    border: '#ec4899',
    accent: '#f9a8d4',
    chip: '#3d1b2d',
    text: '#fce7f3',
    glow: 'rgba(236, 72, 153, 0.35)',
  },
};

export function resolveAlgorithmTheme(
  themeTemplate?: string,
  overrides?: Partial<AlgorithmThemeTokens>
): AlgorithmThemeTokens {
  const templateTokens = themeTemplate ? ALGORITHM_THEME_TEMPLATES[themeTemplate] : undefined;
  return {
    ...DEFAULT_THEME,
    ...(templateTokens ?? {}),
    ...(overrides ?? {}),
  };
}
