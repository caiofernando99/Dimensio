
export type PresentationTheme =
  | 'system'
  | 'tv_dark'
  | 'corporate_light'
  | 'royal_dimensio'
  | 'emerald_ops'
  | 'amber_ops'
  | 'slate_modern'
  | 'midnight_blue'
  | 'high_contrast';

export type DensityMode = 'auto' | 'compact' | 'normal' | 'comfortable' | 'spacious';
export type FontSizePreset = 'auto' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type FontFamilyPreset = 'sans' | 'display' | 'mono' | 'condensed';
export type BreakDisplayMode = 'grouped' | 'badge' | 'none';
export type TaskCardHeaderStyle = 'banner' | 'subtle' | 'minimal';

export interface CardCustomLayout {
  colSpan?: number; // 1 to 4
  internalCols?: number; // 1 to 4
  highlight?: boolean;
}

export interface QuickPresentationConfig {
  theme: PresentationTheme;
  density: DensityMode;
  fontSize: FontSizePreset;
  fontScale: number; // 0.75 to 1.75
  fontFamily: FontFamilyPreset;
  stretchItems: boolean;
  headerStyle: TaskCardHeaderStyle;
  breakDisplay: BreakDisplayMode;
  showRoles: boolean;
  showHeadcounts: boolean;
  groupSubtasks: boolean;
  abbreviateNames: boolean;
  hideEmptyTasks: boolean;
  showMetricsBar: boolean;
  showHeaderDetails: boolean;
  footerNote: string;
  totalColumns: number | 'auto';
  cardOrder?: string[];
  cardLayouts?: Record<string, CardCustomLayout>;
}

export const DEFAULT_CONFIG: QuickPresentationConfig = {
  theme: 'system', // Default is the app theme!
  density: 'auto',
  fontSize: 'auto',
  fontScale: 1.0,
  fontFamily: 'sans',
  stretchItems: true,
  headerStyle: 'banner',
  breakDisplay: 'grouped',
  showRoles: true,
  showHeadcounts: true,
  groupSubtasks: true,
  abbreviateNames: false,
  hideEmptyTasks: true,
  showMetricsBar: true,
  showHeaderDetails: true,
  footerNote: '',
  totalColumns: 'auto',
  cardOrder: [],
  cardLayouts: {},
};

export interface PresentationThemeStyle {
  name: string;
  bg: string;
  cardBg: string;
  cardBorder: string;
  itemBg: string;
  itemBorder: string;
  text: string;
  textMuted: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  headerBg: string;
  headerBorder: string;
  badgeBg: string;
  badgeText: string;
  breakBg: string;
  breakText: string;
  breakBorder: string;
  footerBg: string;
}

// Fixed theme definitions with high-contrast color palettes
export const presentationThemeStyles: Record<PresentationTheme, PresentationThemeStyle> = {
  system: {
    name: 'Tema Padrão (Acompanha o App)',
    bg: 'var(--bg)',
    cardBg: 'var(--paper)',
    cardBorder: 'var(--line)',
    itemBg: 'var(--bg)',
    itemBorder: 'var(--line)',
    text: 'var(--ink)',
    textMuted: 'var(--muted)',
    accent: 'var(--primary)',
    accentBg: 'var(--primary-soft)',
    accentBorder: 'var(--primary-border)',
    headerBg: 'var(--paper)',
    headerBorder: 'var(--line)',
    badgeBg: 'var(--primary-soft)',
    badgeText: 'var(--primary)',
    breakBg: 'var(--bg)',
    breakText: 'var(--ink)',
    breakBorder: 'var(--line)',
    footerBg: 'var(--paper)',
  },
  tv_dark: {
    name: 'Escuro TV / OLED (Preto Puro & Alto Contraste)',
    bg: '#090d16',
    cardBg: '#111827',
    cardBorder: '#1f293d',
    itemBg: '#162032',
    itemBorder: '#23304d',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    accent: '#0284c7',
    accentBg: 'rgba(2, 132, 199, 0.2)',
    accentBorder: '#0284c7',
    headerBg: '#0f172a',
    headerBorder: '#1e293b',
    badgeBg: '#1e293b',
    badgeText: '#38bdf8',
    breakBg: '#1c1917',
    breakText: '#fdba74',
    breakBorder: '#7c2d12',
    footerBg: '#0f172a',
  },
  corporate_light: {
    name: 'Claro Corporativo (Clean)',
    bg: '#f1f5f9',
    cardBg: '#ffffff',
    cardBorder: '#cbd5e1',
    itemBg: '#f8fafc',
    itemBorder: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#475569',
    accent: '#2563eb',
    accentBg: '#eff6ff',
    accentBorder: '#bfdbfe',
    headerBg: '#ffffff',
    headerBorder: '#e2e8f0',
    badgeBg: '#eff6ff',
    badgeText: '#1d4ed8',
    breakBg: '#fff7ed',
    breakText: '#c2410c',
    breakBorder: '#fed7aa',
    footerBg: '#f8fafc',
  },
  royal_dimensio: {
    name: 'Dimensio Royal (Índigo Profundo)',
    bg: '#09091f',
    cardBg: '#121235',
    cardBorder: '#282860',
    itemBg: '#181844',
    itemBorder: '#2e2e6c',
    text: '#f1f5f9',
    textMuted: '#a5b4fc',
    accent: '#6366f1',
    accentBg: 'rgba(99, 102, 241, 0.2)',
    accentBorder: '#6366f1',
    headerBg: '#101030',
    headerBorder: '#25255e',
    badgeBg: '#312e81',
    badgeText: '#c7d2fe',
    breakBg: '#2e1065',
    breakText: '#f472b6',
    breakBorder: '#701a75',
    footerBg: '#101030',
  },
  emerald_ops: {
    name: 'Esmeralda Operacional (Verde Floresta)',
    bg: '#04130d',
    cardBg: '#092117',
    cardBorder: '#124231',
    itemBg: '#0d2b1f',
    itemBorder: '#194d3a',
    text: '#f0fdf4',
    textMuted: '#86efac',
    accent: '#059669',
    accentBg: 'rgba(5, 150, 105, 0.2)',
    accentBorder: '#059669',
    headerBg: '#061c13',
    headerBorder: '#114a36',
    badgeBg: '#064e3b',
    badgeText: '#a7f3d0',
    breakBg: '#14280f',
    breakText: '#fde047',
    breakBorder: '#4d7c0f',
    footerBg: '#061c13',
  },
  amber_ops: {
    name: 'Âmbar Industrial (Grafite & Ouro)',
    bg: '#141414',
    cardBg: '#1c1b18',
    cardBorder: '#383329',
    itemBg: '#26241e',
    itemBorder: '#474032',
    text: '#fefce8',
    textMuted: '#d4d4d8',
    accent: '#d97706',
    accentBg: 'rgba(217, 119, 6, 0.2)',
    accentBorder: '#d97706',
    headerBg: '#1f1e1a',
    headerBorder: '#3d382c',
    badgeBg: '#451a03',
    badgeText: '#fde68a',
    breakBg: '#291b00',
    breakText: '#fbbf24',
    breakBorder: '#78350f',
    footerBg: '#1c1b18',
  },
  slate_modern: {
    name: 'Slate Modern (Cinza Noturno & Ciano)',
    bg: '#0f172a',
    cardBg: '#1e293b',
    cardBorder: '#334155',
    itemBg: '#243247',
    itemBorder: '#3b4c66',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    accent: '#06b6d4',
    accentBg: 'rgba(6, 182, 212, 0.2)',
    accentBorder: '#06b6d4',
    headerBg: '#182234',
    headerBorder: '#2d3b4e',
    badgeBg: '#164e63',
    badgeText: '#67e8f9',
    breakBg: '#1e1b4b',
    breakText: '#a5b4fc',
    breakBorder: '#3730a3',
    footerBg: '#182234',
  },
  midnight_blue: {
    name: 'Azul Meia-Noite (Marinho Corporativo)',
    bg: '#080d1a',
    cardBg: '#0f172a',
    cardBorder: '#1e2d4a',
    itemBg: '#17233d',
    itemBorder: '#23385d',
    text: '#ffffff',
    textMuted: '#93c5fd',
    accent: '#3b82f6',
    accentBg: 'rgba(59, 130, 246, 0.2)',
    accentBorder: '#3b82f6',
    headerBg: '#0b1324',
    headerBorder: '#1b2a47',
    badgeBg: '#1e3a8a',
    badgeText: '#bfdbfe',
    breakBg: '#172554',
    breakText: '#93c5fd',
    breakBorder: '#1d4ed8',
    footerBg: '#0b1324',
  },
  high_contrast: {
    name: 'Alto Contraste P&B (TV / Painel Industrial)',
    bg: '#000000',
    cardBg: '#0a0a0a',
    cardBorder: '#ffffff',
    itemBg: '#171717',
    itemBorder: '#525252',
    text: '#ffffff',
    textMuted: '#d4d4d4',
    accent: '#facc15',
    accentBg: '#ca8a04',
    accentBorder: '#facc15',
    headerBg: '#000000',
    headerBorder: '#ffffff',
    badgeBg: '#ffffff',
    badgeText: '#000000',
    breakBg: '#262626',
    breakText: '#facc15',
    breakBorder: '#a3a3a3',
    footerBg: '#000000',
  },
};

// Safe runtime theme resolver that dynamically extracts computed CSS variables when 'system' is active
export function resolvePresentationTheme(themeKey: PresentationTheme): PresentationThemeStyle {
  if (themeKey === 'system' && typeof window !== 'undefined') {
    const styles = getComputedStyle(document.documentElement);
    const bg = styles.getPropertyValue('--bg').trim() || '#f3f4fa';
    const paper = styles.getPropertyValue('--paper').trim() || '#ffffff';
    const ink = styles.getPropertyValue('--ink').trim() || '#161633';
    const muted = styles.getPropertyValue('--muted').trim() || '#414368';
    const line = styles.getPropertyValue('--line').trim() || '#d1d6eb';
    const primary = styles.getPropertyValue('--primary').trim() || '#4f46e5';
    const primarySoft = styles.getPropertyValue('--primary-soft').trim() || '#eef2ff';
    const primaryBorder = styles.getPropertyValue('--primary-border').trim() || '#93a5f7';
    const isDark = document.documentElement.classList.contains('dark');

    return {
      name: 'Tema Padrão (Acompanha o App)',
      bg: bg,
      cardBg: paper,
      cardBorder: line,
      itemBg: isDark ? 'rgba(255, 255, 255, 0.05)' : bg,
      itemBorder: line,
      text: ink,
      textMuted: muted,
      accent: primary,
      accentBg: primarySoft,
      accentBorder: primaryBorder,
      headerBg: paper,
      headerBorder: line,
      badgeBg: primarySoft,
      badgeText: primary,
      breakBg: isDark ? 'rgba(0, 0, 0, 0.3)' : primarySoft,
      breakText: ink,
      breakBorder: line,
      footerBg: paper,
    };
  }
  return presentationThemeStyles[themeKey] || presentationThemeStyles.system;
}

export interface QuickPresentationView169Props {
  config?: QuickPresentationConfig;
  onConfigChange?: (config: QuickPresentationConfig) => void;
  selectedShift?: string;
  selectedShifts?: string[];
  selectedTLs?: string[];
  selectedRoles?: string[];
  selectedCategories?: string[];
  selectedTaskIds?: string[];
  searchTerm?: string;
  isFullscreen?: boolean;
  onFullscreenChange?: (fs: boolean) => void;
  slideRef?: React.RefObject<HTMLDivElement>;
  hideControls?: boolean;
}

