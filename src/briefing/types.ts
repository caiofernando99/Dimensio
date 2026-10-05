/**
 * Novo modelo do Montador de Slides (v2).
 *
 * Um conceito único — SLIDE — em vez dos três sobrepostos do modelo antigo
 * (freeSlides vs simpleSlides vs slideItems) e sem o sistema paralelo de
 * "regiões" (elementLayout). Cada slide tem:
 * - `kind`: de onde vem o conteúdo (automático, manual ou externo);
 * - `data`: configurações do tipo (textos, URLs, listas);
 * - `hiddenSections`: quais blocos nativos estão ocultos (checkbox, sem arrastar);
 * - `layers`: camadas livres (texto/imagem/forma) sobre o slide;
 * - `theme`: fundo + destaque por slide, num lugar só.
 *
 * O kind `embed` guarda apenas link + estado (título, página, notas) — é o
 * ponto de encaixe da futura integração com o Google Apresentações: o picker
 * futuro só precisa preencher `url` + `title`.
 */

export type BriefKind = 'cover' | 'scale' | 'embed' | 'process' | 'qa' | 'notice' | 'blank';

export type BriefLayerType = 'text' | 'image' | 'shape';

export interface BriefLayer {
  id: string;
  type: BriefLayerType;
  /** texto | URL/dataURL da imagem | 'rect' | 'circle' | 'line' */
  content: string;
  /** geometria em % do palco 16:9 */
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  /** tamanho da fonte em % da largura do palco (texto) */
  fontSize?: number;
  fontWeight?: 400 | 600 | 700 | 900;
  align?: 'left' | 'center' | 'right';
  color?: string;
  bg?: string;
  radius?: number;
  opacity?: number;
  rotation?: number;
  /** espessura (linha) */
  lineWidth?: number;
}

export interface BriefSlideTheme {
  bg: string;
  bgImage?: string;
  accent: string;
}

/** Config por tipo (tudo opcional com defaults no render). */
export interface BriefSlideData {
  // cover
  kicker?: string;
  title?: string;
  team?: string;
  sectorShift?: string;
  quote?: string;
  showQuote?: boolean;
  footerNote?: string;
  showStats?: boolean;
  showManager?: boolean;
  // scale
  subtitle?: string;
  footer?: string;
  showIntervals?: boolean;
  density?: 'comfortable' | 'compact';
  // embed (documento/apresentação externa: só link + estado)
  url?: string;
  label?: string;
  page?: number;
  notes?: string;
  // process
  cardId?: string;
  // qa
  description?: string;
  questions?: string[];
  closing?: string;
  // notice
  items?: string[];
}

export interface BriefSlide {
  id: string;
  kind: BriefKind;
  /** título exibido no organizador */
  title: string;
  enabled: boolean;
  theme: BriefSlideTheme;
  hiddenSections: string[];
  data: BriefSlideData;
  layers: BriefLayer[];
}

export interface BriefDeck {
  version: 1;
  slides: BriefSlide[];
  updatedAt: string;
}

/** Blocos nativos de cada tipo (para "o que mostrar" — sem arrastar). */
export const BRIEF_SECTIONS: Record<BriefKind, Array<{ id: string; label: string }>> = {
  cover: [
    { id: 'header', label: 'Cabeçalho' },
    { id: 'title', label: 'Título principal' },
    { id: 'quote', label: 'Frase do dia' },
    { id: 'footer', label: 'Rodapé' },
  ],
  scale: [
    { id: 'header', label: 'Cabeçalho' },
    { id: 'grid', label: 'Grade da escala' },
    { id: 'footer', label: 'Rodapé' },
  ],
  embed: [
    { id: 'header', label: 'Cabeçalho' },
    { id: 'viewer', label: 'Visualizador' },
  ],
  process: [
    { id: 'header', label: 'Cabeçalho' },
    { id: 'card', label: 'Cartão do processo' },
  ],
  qa: [
    { id: 'header', label: 'Cabeçalho' },
    { id: 'questions', label: 'Perguntas' },
    { id: 'closing', label: 'Encerramento' },
  ],
  notice: [
    { id: 'header', label: 'Cabeçalho' },
    { id: 'items', label: 'Lista de avisos' },
  ],
  blank: [{ id: 'hint', label: 'Dica de edição' }],
};

export const BRIEF_KINDS: Array<{
  kind: BriefKind;
  label: string;
  desc: string;
}> = [
  { kind: 'cover', label: 'Capa', desc: 'Abertura com equipe, turno, data e frase do dia' },
  { kind: 'scale', label: 'Escala do turno', desc: 'Grade de postos com quem está em cada um' },
  { kind: 'embed', label: 'Documento / Slides', desc: 'PDF, Drive ou Google Apresentações por link (só salva o link)' },
  { kind: 'process', label: 'Processo', desc: 'Destaque um cartão de processo da base' },
  { kind: 'qa', label: 'Perguntas', desc: 'Perguntas para a equipe + mensagem final' },
  { kind: 'notice', label: 'Avisos', desc: 'Lista simples de recados do turno' },
  { kind: 'blank', label: 'Livre', desc: 'Slide em branco para montar com texto e imagens' },
];
