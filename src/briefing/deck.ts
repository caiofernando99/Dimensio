import type { BriefDeck, BriefKind, BriefLayer, BriefSlide, BriefSlideData } from './types';
import { BRIEF_KINDS } from './types';
import { generateId } from '../utils/helpers';

export const BRIEF_ACCENT_DEFAULT = '#4f46e5';
export const BRIEF_BG_DEFAULT = '#0f172a';

function nid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${generateId().slice(0, 6)}`;
}

const KIND_TITLES: Record<BriefKind, string> = {
  cover: 'Capa',
  scale: 'Escala do turno',
  embed: 'Documento',
  process: 'Processo',
  qa: 'Perguntas',
  notice: 'Avisos',
  blank: 'Slide livre',
};

const KIND_ACCENTS: Record<BriefKind, string> = {
  cover: '#4f46e5',
  scale: '#0ea5e9',
  embed: '#8b5cf6',
  process: '#10b981',
  qa: '#f59e0b',
  notice: '#ef4444',
  blank: '#64748b',
};

export function defaultSlideData(kind: BriefKind): BriefSlideData {
  switch (kind) {
    case 'cover':
      return { kicker: 'Briefing operacional', showQuote: true, showStats: true, showManager: true };
    case 'scale':
      return { title: 'Escala do turno', showIntervals: true, density: 'comfortable' };
    case 'embed':
      return { label: 'Documento da operação', page: 1 };
    case 'process':
      return {};
    case 'qa':
      return { title: 'Perguntas & dúvidas', closing: 'Segurança em primeiro lugar. Bom turno!' };
    case 'notice':
      return { title: 'Avisos do turno', items: [] };
    case 'blank':
      return {};
  }
}

export function createSlide(kind: BriefKind, title?: string): BriefSlide {
  return {
    id: nid('slide'),
    kind,
    title: title?.trim() || KIND_TITLES[kind],
    enabled: true,
    theme: { bg: BRIEF_BG_DEFAULT, accent: KIND_ACCENTS[kind] },
    hiddenSections: [],
    data: defaultSlideData(kind),
    layers: [],
  };
}

export function defaultDeck(): BriefDeck {
  return {
    version: 1,
    slides: [createSlide('cover'), createSlide('scale'), createSlide('notice')],
    updatedAt: new Date().toISOString(),
  };
}

function stamp(deck: BriefDeck): BriefDeck {
  return { ...deck, updatedAt: new Date().toISOString() };
}

export function addSlide(deck: BriefDeck, kind: BriefKind, title?: string): BriefDeck {
  return stamp({ ...deck, slides: [...deck.slides, createSlide(kind, title)] });
}

export function duplicateSlide(deck: BriefDeck, id: string): BriefDeck {
  const src = deck.slides.find((s) => s.id === id);
  if (!src) return deck;
  const copy: BriefSlide = {
    ...JSON.parse(JSON.stringify(src)),
    id: nid('slide'),
    title: `${src.title} (cópia)`,
  };
  const idx = deck.slides.findIndex((s) => s.id === id);
  const slides = [...deck.slides];
  slides.splice(idx + 1, 0, copy);
  return stamp({ ...deck, slides });
}

export function removeSlide(deck: BriefDeck, id: string): BriefDeck {
  if (deck.slides.length <= 1) return deck;
  return stamp({ ...deck, slides: deck.slides.filter((s) => s.id !== id) });
}

export function moveSlide(deck: BriefDeck, id: string, dir: -1 | 1): BriefDeck {
  const idx = deck.slides.findIndex((s) => s.id === id);
  const j = idx + dir;
  if (idx < 0 || j < 0 || j >= deck.slides.length) return deck;
  const slides = [...deck.slides];
  [slides[idx], slides[j]] = [slides[j], slides[idx]];
  return stamp({ ...deck, slides });
}

export function toggleSlide(deck: BriefDeck, id: string): BriefDeck {
  const slides = deck.slides.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
  // Nunca deixa zero slides ativos
  if (!slides.some((s) => s.enabled)) return deck;
  return stamp({ ...deck, slides });
}

export function updateSlide(deck: BriefDeck, id: string, patch: Partial<BriefSlide>): BriefDeck {
  return stamp({
    ...deck,
    slides: deck.slides.map((s) => (s.id === id ? { ...s, ...patch, id: s.id } : s)),
  });
}

export function patchSlideData(deck: BriefDeck, id: string, data: Partial<BriefSlideData>): BriefDeck {
  return stamp({
    ...deck,
    slides: deck.slides.map((s) => (s.id === id ? { ...s, data: { ...s.data, ...data } } : s)),
  });
}

export function setSlideLayers(deck: BriefDeck, id: string, layers: BriefLayer[]): BriefDeck {
  return stamp({
    ...deck,
    slides: deck.slides.map((s) => (s.id === id ? { ...s, layers } : s)),
  });
}

export function createLayer(type: BriefLayer['type'], maxZ: number): BriefLayer {
  const base = { id: nid('layer'), x: 30, y: 38, w: 40, h: 14, z: maxZ + 1, opacity: 1, rotation: 0 };
  if (type === 'text') {
    return {
      ...base,
      type,
      content: 'Clique duas vezes para editar',
      fontSize: 3,
      fontWeight: 900,
      align: 'center',
      color: '#ffffff',
    };
  }
  if (type === 'image') {
    return { ...base, type, content: '', w: 34, h: 44, radius: 12 };
  }
  return { ...base, type, content: 'rect', color: '#4f46e5', h: 10 };
}

/** Valida/normaliza um deck carregado (import, backup, nuvem). Retorna null se inválido. */
export function normalizeDeck(raw: unknown): BriefDeck | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<BriefDeck>;
  if (!Array.isArray(r.slides) || r.slides.length === 0) return null;
  const kinds = new Set(BRIEF_KINDS.map((k) => k.kind));
  const slides: BriefSlide[] = [];
  for (const s of r.slides) {
    if (!s || typeof s !== 'object') continue;
    const kind: BriefKind = kinds.has((s as BriefSlide).kind) ? (s as BriefSlide).kind : 'blank';
    const layers = Array.isArray((s as BriefSlide).layers)
      ? (s as BriefSlide).layers.filter((l) => l && typeof l === 'object').map((l, i) => ({
          id: String((l as BriefLayer).id || `layer_${i}`),
          type: ((l as BriefLayer).type === 'image' || (l as BriefLayer).type === 'shape' ? (l as BriefLayer).type : 'text') as BriefLayer['type'],
          content: String((l as BriefLayer).content ?? ''),
          x: num((l as BriefLayer).x, 10),
          y: num((l as BriefLayer).y, 10),
          w: num((l as BriefLayer).w, 30),
          h: num((l as BriefLayer).h, 12),
          z: num((l as BriefLayer).z, i),
          fontSize: (l as BriefLayer).fontSize,
          fontWeight: (l as BriefLayer).fontWeight,
          align: (l as BriefLayer).align,
          color: (l as BriefLayer).color,
          bg: (l as BriefLayer).bg,
          radius: (l as BriefLayer).radius,
          opacity: (l as BriefLayer).opacity,
          rotation: (l as BriefLayer).rotation,
          lineWidth: (l as BriefLayer).lineWidth,
        }))
      : [];
    slides.push({
      id: String((s as BriefSlide).id || nid('slide')),
      kind,
      title: String((s as BriefSlide).title || KIND_TITLES[kind]),
      enabled: (s as BriefSlide).enabled !== false,
      theme: {
        bg: String((s as BriefSlide).theme?.bg || BRIEF_BG_DEFAULT),
        bgImage: (s as BriefSlide).theme?.bgImage || undefined,
        accent: String((s as BriefSlide).theme?.accent || KIND_ACCENTS[kind]),
      },
      hiddenSections: Array.isArray((s as BriefSlide).hiddenSections)
        ? (s as BriefSlide).hiddenSections.map(String)
        : [],
      data: ((s as BriefSlide).data && typeof (s as BriefSlide).data === 'object' ? (s as BriefSlide).data : {}) as BriefSlideData,
      layers,
    });
  }
  if (slides.length === 0) return null;
  if (!slides.some((s) => s.enabled)) slides[0].enabled = true;
  return { version: 1, slides, updatedAt: String(r.updatedAt || new Date().toISOString()) };
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
