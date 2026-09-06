import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { MultiSelectFilter } from '../components/MultiSelectFilter';
import { SlideItemOverlay } from '../components/SlideItemOverlay';
import { PdfPageViewer } from '../components/PdfPageViewer';
import { FramedImage } from '../components/FramedImage';
import {
  Calendar,
  Clock,
  Maximize2,
  Minimize2,
  Printer,
  Save,
  Sparkles,
  Users,
  CheckCircle2,
  Building2,
  BookOpen,
  ShieldCheck,
  Lightbulb,
  FileText,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Plus,
  Trash2,
  Edit3,
  X,
  LayoutGrid,
  GraduationCap,
  Info,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  Play,
  FileSpreadsheet,
  HelpCircle,
  ExternalLink,
  MessageSquare,
  Megaphone,
  Eye,
  RefreshCw,
  Tag,
  Briefcase,
  Download,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Settings2,
  GripVertical,
  RotateCcw,
  Check,
  Layers,
  LayoutTemplate,
  Pencil,
  FilePlus2,
  PaintBucket,
  Focus,
  MoveVertical,
  MoveHorizontal,
  Palette,
  Type,
} from 'lucide-react';
import { formatDateBR, formatDateLongBR, getCollaboratorStatus, abbreviateName } from '../utils/helpers';
import { ProcessKnowledge, ProcessType, SlideConfigItem, SlideId, SlideItem, FreeSlideConfig, SlideElementLayout, SimpleSlideConfig, SlideTypography } from '../types';
import { SlideRegionEditor, RegionDef } from '../components/SlideRegionEditor';
import { SlideTemplatePicker, SlideTemplate } from '../components/SlideTemplatePicker';
import { SlideTypographyControls } from '../components/SlideTypographyControls';
import { SimpleSlideControls } from '../components/SimpleSlideControls';
import { MarkdownContent } from '../components/MarkdownContent';
import { PageHeader, Card, CardHeader, CardBody, CardFooter, SectionHeader, Button, Badge, Tabs, Field, Input, Select, Textarea, Toggle, Modal } from '../components/ui';

const DEFAULT_SLIDE_ORDER: SlideConfigItem[] = [
  { id: 'cover', enabled: true, title: 'Capa / Apresentação' },
  { id: 'operational_pdf', enabled: true, title: 'Informativo da Operação' },
  { id: 'scale', enabled: true, title: 'Escala e Dimensionamento' },
];

const SLIDE_METADATA: Record<SlideId, { defaultTitle: string }> = {
  cover: { defaultTitle: 'Capa / Apresentação' },
  operational_pdf: { defaultTitle: 'Informativo da Operação' },
  process: { defaultTitle: 'Reforço do Processo' },
  scale: { defaultTitle: 'Escala e Dimensionamento' },
  qa: { defaultTitle: 'Perguntas & Dúvidas' },
  avisos: { defaultTitle: 'Avisos & Alinhamentos' },
  dicas: { defaultTitle: 'Dicas Rápidas' },
};

const OPTIONAL_ADDITIONAL_SLIDES: SlideConfigItem[] = [
  { id: 'process', enabled: true, title: 'Reforço do Processo' },
  { id: 'qa', enabled: true, title: 'Perguntas & Dúvidas' },
  { id: 'avisos', enabled: true, title: 'Avisos & Alinhamentos' },
  { id: 'dicas', enabled: true, title: 'Dicas Rápidas' },
];

// Editable built-in element regions per slide (default geometry, overridable via elementLayout)
const SLIDE_REGION_DEFS: Record<string, Record<string, RegionDef>> = {
  cover: {
    header: { x: 4, y: 3, w: 92, h: 9, label: 'Cabeçalho' },
    title: { x: 6, y: 15, w: 80, h: 71, label: 'Título & Frase' },
    footer: { x: 4, y: 90, w: 92, h: 7, label: 'Rodapé' },
  },
  operational_pdf: {
    header: { x: 3, y: 3, w: 94, h: 9, label: 'Cabeçalho' },
    content: { x: 3, y: 15, w: 94, h: 72, label: 'Documento / PDF' },
    footer: { x: 3, y: 90, w: 94, h: 7, label: 'Rodapé' },
  },
  process: {
    header: { x: 3, y: 3, w: 94, h: 9, label: 'Cabeçalho' },
    content: { x: 3, y: 15, w: 94, h: 72, label: 'Conteúdo do Processo' },
    footer: { x: 3, y: 90, w: 94, h: 7, label: 'Rodapé' },
  },
  scale: {
    header: { x: 3, y: 3, w: 94, h: 9, label: 'Cabeçalho' },
    content: { x: 3, y: 15, w: 94, h: 72, label: 'Escala / Tarefas' },
    footer: { x: 3, y: 90, w: 94, h: 7, label: 'Rodapé' },
  },
  qa: {
    header: { x: 3, y: 3, w: 94, h: 9, label: 'Cabeçalho' },
    content: { x: 3, y: 15, w: 94, h: 72, label: 'Perguntas & Cards' },
    footer: { x: 3, y: 90, w: 94, h: 7, label: 'Rodapé' },
  },
  avisos: {
    header: { x: 3, y: 3, w: 94, h: 9, label: 'Cabeçalho' },
    content: { x: 3, y: 15, w: 94, h: 72, label: 'Avisos & Alinhamentos' },
    footer: { x: 3, y: 90, w: 94, h: 7, label: 'Rodapé' },
  },
  dicas: {
    header: { x: 3, y: 3, w: 94, h: 9, label: 'Cabeçalho' },
    content: { x: 3, y: 15, w: 94, h: 72, label: 'Cards de Dicas' },
    footer: { x: 3, y: 90, w: 94, h: 7, label: 'Rodapé' },
  },
};

const PRESET_FREE_SLIDE_IMAGES = [
  { name: 'Equipe / Reunião', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Escritório Moderno', url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Logística', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Amanhecer', url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Tecnologia', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Segurança', url: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=1200&q=80' },
];

const getNormalizedSlideOrder = (
  rawOrder?: SlideConfigItem[],
  freeSlidesList?: FreeSlideConfig[],
  simpleSlidesMap?: Record<string, SimpleSlideConfig>
): SlideConfigItem[] => {
  const result: SlideConfigItem[] = Array.isArray(rawOrder) && rawOrder.length > 0
    ? [...rawOrder]
    : [...DEFAULT_SLIDE_ORDER];

  const existingIds = new Set(result.map((s) => s.id));

  // 1. Garantir que os slides padrão essenciais estejam na lista
  DEFAULT_SLIDE_ORDER.forEach((def) => {
    if (!existingIds.has(def.id)) {
      result.push({ ...def });
      existingIds.add(def.id);
    }
  });

  // 2. Preservar TODOS os slides livres criados pelo usuário
  if (Array.isArray(freeSlidesList)) {
    freeSlidesList.forEach((f) => {
      if (!existingIds.has(f.id)) {
        result.push({
          id: f.id,
          enabled: true,
          title: f.title || 'Slide Livre',
        });
        existingIds.add(f.id);
      }
    });
  }

  // 3. Preservar slides de Avisos / Dicas se existirem
  if (simpleSlidesMap) {
    Object.keys(simpleSlidesMap).forEach((id) => {
      if (!existingIds.has(id)) {
        const meta = OPTIONAL_ADDITIONAL_SLIDES.find((s) => s.id === id);
        if (meta) {
          result.push({ ...meta });
          existingIds.add(id);
        }
      }
    });
  }

  return result;
};

// Preset background images for Cover Slide
const PRESET_COVER_IMAGES = [
  { name: 'Centro de Distribuição', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Trabalho em Equipe', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Tecnologia & Logística', url: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Docas & Expedição', url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Segurança & Ergonomia', url: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Início de Turno / Amanhecer', url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80' },
];

// Preset background images for Q&A / Dúvidas Slide (Slide 5)
const PRESET_QA_IMAGES = [
  { name: 'Dark Tech & Mesh', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Purple Glow & Waves', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Emerald Logistics', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Modern Workspace', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Ondas Abstratas Azul', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80' },
];

// Preset operational images for Process Knowledge Cards
const PRESET_OPERATIONAL_IMAGES = [
  { name: 'Estoque / Inventário', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80' },
  { name: 'Ergonomia / Segurança', url: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=800&q=80' },
  { name: 'Docas / Operação', url: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=800&q=80' },
  { name: 'Avarias / Inspeção', url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80' },
  { name: 'Packing / Caixas', url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80' },
  { name: 'Bipagem / Scanner', url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80' },
];

// Preset background images for Avisos & Alinhamentos slide
const PRESET_AVISOS_IMAGES = [
  { name: 'Dark Tech & Mesh', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Amber Warehouse', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Comunicação / Equipe', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Ondas Abstratas', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80' },
];

// Preset background images for Dicas Rápidas slide
const PRESET_DICAS_IMAGES = [
  { name: 'Purple Glow & Waves', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Dark Tech & Mesh', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Amanhecer', url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Modern Workspace', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80' },
];

// Visual templates (background + accent) applied per slide type
const SLIDE_TEMPLATES: Record<string, SlideTemplate[]> = {
  cover: [
    { id: 'emerald', name: 'Verde Operação', bgUrl: PRESET_COVER_IMAGES[1].url, bgColor: '#022c22', accent: '#10b981' },
    { id: 'sky', name: 'Azul Tecnologia', bgUrl: PRESET_COVER_IMAGES[2].url, bgColor: '#0c4a6e', accent: '#38bdf8' },
    { id: 'amber', name: 'Amber Logística', bgUrl: PRESET_COVER_IMAGES[0].url, bgColor: '#1c1917', accent: '#f59e0b' },
    { id: 'rose', name: 'Amanhecer Rose', bgUrl: PRESET_COVER_IMAGES[5].url, bgColor: '#4c0519', accent: '#fb7185' },
  ],
  qa: [
    { id: 'purple', name: 'Purple Dúvidas', bgUrl: PRESET_QA_IMAGES[1].url, bgColor: '#2e1065', accent: '#a78bfa' },
    { id: 'emerald', name: 'Verde Alinhamento', bgUrl: PRESET_QA_IMAGES[2].url, bgColor: '#022c22', accent: '#34d399' },
    { id: 'blue', name: 'Azul Ondas', bgUrl: PRESET_QA_IMAGES[4].url, bgColor: '#172554', accent: '#60a5fa' },
    { id: 'slate', name: 'Slate Dark', bgUrl: PRESET_QA_IMAGES[0].url, bgColor: '#0f172a', accent: '#94a3b8' },
  ],
  avisos: [
    { id: 'amber', name: 'Amber Alert', bgUrl: PRESET_AVISOS_IMAGES[0].url, bgColor: '#1c1917', accent: '#f59e0b' },
    { id: 'emerald', name: 'Emerald Avisos', bgUrl: PRESET_AVISOS_IMAGES[1].url, bgColor: '#022c22', accent: '#10b981' },
    { id: 'sky', name: 'Sky Comunicação', bgUrl: PRESET_AVISOS_IMAGES[2].url, bgColor: '#082f49', accent: '#38bdf8' },
    { id: 'rose', name: 'Rose Avisos', bgUrl: PRESET_AVISOS_IMAGES[3].url, bgColor: '#4c0519', accent: '#fb7185' },
  ],
  dicas: [
    { id: 'violet', name: 'Violet Dicas', bgUrl: PRESET_DICAS_IMAGES[0].url, bgColor: '#2e1065', accent: '#a78bfa' },
    { id: 'indigo', name: 'Indigo Tips', bgUrl: PRESET_DICAS_IMAGES[1].url, bgColor: '#172554', accent: '#818cf8' },
    { id: 'cyan', name: 'Cyan Amanhecer', bgUrl: PRESET_DICAS_IMAGES[2].url, bgColor: '#083344', accent: '#22d3ee' },
    { id: 'slate', name: 'Slate Tips', bgUrl: PRESET_DICAS_IMAGES[3].url, bgColor: '#0f172a', accent: '#94a3b8' },
  ],
};

// Default content for the built-in "simple" slides (avisos & dicas)
const DEFAULT_SIMPLE_SLIDES: Record<string, SimpleSlideConfig> = {
  avisos: {
    title: 'Avisos & Alinhamentos do Turno',
    subtitle: 'Comunicados importantes da liderança e orientações do dia',
    items: [
      'Alinhe com o Team Leader o volume e as prioridades da operação antes do início das tarefas.',
      'Reporte imediatamente qualquer avaria, divergência de inventário ou risco de segurança.',
      'Respeite os horários de janta/almoço e os revezamentos conforme a escala divulgada.',
      'Mantenha a área de trabalho organizada e devolva os equipamentos no fim do turno.',
    ],
    accent: '#f59e0b',
    bgUrl: PRESET_AVISOS_IMAGES[0].url,
    bgColor: '#1c1917',
  },
  dicas: {
    title: 'Dicas Rápidas para a Operação',
    subtitle: 'Pequenas ações que fazem a diferença no dia a dia',
    items: [
      'Confira sempre a etiqueta antes de fechar a caixa para evitar erros de rota.',
      'Mantenha a postura ereta e use as técnicas de ergonomia na paletização.',
      'Bipe o produto e o endereço separadamente para garantir a conferência.',
      'Em caso de divergência, pare a tarefa e chame o Team Leader imediatamente.',
    ],
    accent: '#a78bfa',
    bgUrl: PRESET_DICAS_IMAGES[0].url,
    bgColor: '#2e1065',
  },
};

// Curated daily operational motivational quotes
const MOTIVATIONAL_QUOTES = [
  'A segurança, a qualidade e o trabalho em equipe nos levarão a alcançar a excelência operacional todos os dias.',
  'A excelência da nossa logística é construída com o cuidado e a dedicação de cada um de nós neste turno.',
  'Pequenas melhorias diárias na operação geram grandes resultados e um ambiente de trabalho mais seguro.',
  'O sucesso da nossa equipe depende do foco, da comunicação clara e da colaboração constante.',
  'Trabalhar com segurança não é apenas uma regra, é o nosso maior compromisso com nós mesmos e nossas famílias.',
  'Nenhum processo é tão urgente que não possa ser realizado com total segurança, qualidade e padrão.',
  'Grande equipe, metas claras: juntos fazemos a operação logística fluir com máxima eficiência!',
];

/**
 * Helper to compress image files locally before storing in state.
 */
const compressImageFile = (file: File, maxWidth = 1000): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compressedDataUrl);
      };
      img.onerror = () => reject(new Error('Falha ao carregar a imagem'));
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

/**
 * Smart Embed URL formatter for PDFs, Google Drive, Google Slides, and Canva.
 */
const formatDocumentEmbedUrl = (rawUrl: string, page: number): string => {
  if (!rawUrl) return '';
  const url = rawUrl.trim();

  // Google Drive File preview (e.g., https://drive.google.com/file/d/FILE_ID/view?usp=sharing)
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return `https://drive.google.com/file/d/${fileId}/preview#page=${page}`;
  }

  // Google Presentation / Slides (e.g., https://docs.google.com/presentation/d/PRESENTATION_ID/edit)
  const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slidesMatch) {
    const presId = slidesMatch[1];
    return `https://docs.google.com/presentation/d/${presId}/embed?start=false&loop=false&delayms=3000#slide=id.p${page}`;
  }

  // Canva Embed
  if (url.includes('canva.com/design/')) {
    return url.includes('view?embed') ? url : `${url}?embed`;
  }

  // Direct Web PDF URL -> Use Google Docs Viewer
  if (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?')) {
    return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}#page=${page}`;
  }

  return url;
};

/**
 * Extracts a Google Drive file ID from common share/download links.
 */
const getDriveFileId = (rawUrl: string): string | null => {
  const url = rawUrl.trim();
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return idMatch ? idMatch[1] : null;
};

/**
 * Resolves a PDF source to CORS-enabled URLs usable by pdf.js (first is tried first,
 * subsequent URLs are used as fallbacks if the previous one fails).
 */
const getPdfSourceUrls = (rawUrl: string): string[] => {
  const url = rawUrl.trim();
  const driveId = getDriveFileId(url);
  if (driveId) {
    return [
      `https://drive.usercontent.google.com/download?id=${driveId}&export=download`,
      `https://drive.google.com/uc?export=download&id=${driveId}`,
    ];
  }
  return [url];
};

/**
 * Whether the given URL points to a PDF we can render page-by-page (Drive file or direct .pdf).
 */
const isPdfSource = (rawUrl: string): boolean => {
  const url = rawUrl.trim();
  if (!url) return false;
  if (getDriveFileId(url)) return true;
  const lower = url.toLowerCase();
  return lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('.pdf#');
};

export const BriefingView: React.FC = () => {
  const {
    state,
    updateBriefingConfig,
    addProcessKnowledge,
    updateProcessKnowledge,
    deleteProcessKnowledge,
    showNotice,
    syncToOnlineSpreadsheet,
    addAuditLog,
  } = useApp();

  const [isSavingSlides, setIsSavingSlides] = useState(false);

  const handleManualSaveBriefing = async () => {
    setIsSavingSlides(true);
    try {
      addAuditLog('configuracao', 'Salvou manualmente as alterações no Montador de Slides', state.selectedDate);
      if (state.onlineSpreadsheet && state.onlineSpreadsheet.webhookUrl) {
        await syncToOnlineSpreadsheet();
      }
      showNotice('✅ Alterações nos slides salvas com sucesso!');
    } catch {
      showNotice('⚠️ Falha ao sincronizar com a planilha online.');
    } finally {
      setIsSavingSlides(false);
    }
  };

  const activeDate = state.selectedDate;
  const briefingCfg = state.briefingConfig || {};

  // Configurable slide items (flexible text/image layers per slide)
  const slideItemsMap = briefingCfg.slideItems || {};
  const getSlideItems = (id: SlideId): SlideItem[] => slideItemsMap[id] || [];
  const setSlideItems = (id: SlideId, items: SlideItem[]) => {
    updateBriefingConfig({ slideItems: { ...slideItemsMap, [id]: items } });
  };

  // Free (blank) slides created by the user
  const freeSlides: FreeSlideConfig[] = briefingCfg.freeSlides || [];
  const getFreeSlide = (id: SlideId): FreeSlideConfig | undefined => freeSlides.find((f) => f.id === id);
  const updateFreeSlide = (id: string, patch: Partial<FreeSlideConfig>) => {
    updateBriefingConfig({
      freeSlides: freeSlides.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  };

  // Built-in "simple" slides (avisos & dicas) with editable content
  const simpleSlidesMap = briefingCfg.simpleSlides || {};
  const getSimpleSlide = (id: string): SimpleSlideConfig | undefined => simpleSlidesMap[id];
  const updateSimpleSlide = (id: string, patch: Partial<SimpleSlideConfig>) => {
    updateBriefingConfig({
      simpleSlides: { ...simpleSlidesMap, [id]: { ...(simpleSlidesMap[id] || {}), ...patch } },
    });
  };

  // Per-slide typography (font family & sizes)
  const typographyMap = briefingCfg.typography || {};
  const getSlideTypo = (id: SlideId): SlideTypography => typographyMap[id] || {};
  const updateSlideTypo = (id: SlideId, patch: Partial<SlideTypography>) => {
    updateBriefingConfig({
      typography: { ...typographyMap, [id]: { ...(typographyMap[id] || {}), ...patch } },
    });
  };

  // Per-slide accent color (used by templates)
  const slideThemeMap = briefingCfg.slideTheme || {};
  const getSlideAccent = (id: SlideId): string | undefined => slideThemeMap[id]?.accent;
  const setSlideAccent = (id: SlideId, accent: string | undefined) => {
    const next = { ...slideThemeMap };
    if (accent) next[id] = { ...(next[id] || {}), accent };
    else if (next[id]) {
      const rest = { ...next[id] };
      delete rest.accent;
      if (Object.keys(rest).length > 0) next[id] = rest;
      else delete next[id];
    }
    updateBriefingConfig({ slideTheme: next });
  };

  const applySlideTemplate = (slideId: SlideId, tpl: SlideTemplate) => {
    if (slideId === 'cover') {
      updateBriefingConfig({ coverBgUrl: tpl.bgUrl });
    } else if (slideId === 'qa') {
      updateBriefingConfig({ qaBgUrl: tpl.bgUrl, qaDirectImageUrl: '' });
    } else if (slideId === 'avisos' || slideId === 'dicas') {
      updateSimpleSlide(slideId, { bgUrl: tpl.bgUrl, bgColor: tpl.bgColor, accent: tpl.accent });
    } else {
      setSlideBgColor(slideId, tpl.bgColor);
    }
    setSlideAccent(slideId, tpl.accent);
    showNotice(`Template "${tpl.name}" aplicado ao slide.`);
  };

  // Built-in element layout overrides (drag/resize/hide regions of existing slides)
  const elementLayoutMap = briefingCfg.elementLayout || {};
  const slideBgColorMap = briefingCfg.slideBgColor || {};
  const getRegionLayout = (slideId: SlideId): Record<string, SlideElementLayout> =>
    elementLayoutMap[slideId] || {};
  const setRegionLayout = (slideId: SlideId, layout: Record<string, SlideElementLayout>) => {
    updateBriefingConfig({
      elementLayout: { ...elementLayoutMap, [slideId]: layout },
    });
  };
  const setSlideBgColor = (slideId: SlideId, color: string | undefined) => {
    const next = { ...slideBgColorMap };
    if (color) next[slideId] = color;
    else delete next[slideId];
    updateBriefingConfig({ slideBgColor: next });
  };
  const getRegionRect = (slideId: SlideId, regionId: string, def: RegionDef) => {
    const ov = elementLayoutMap[slideId]?.[regionId];
    return {
      x: ov?.x ?? def.x,
      y: ov?.y ?? def.y,
      w: ov?.w ?? def.w,
      h: ov?.h ?? def.h,
      hidden: ov?.hidden ?? false,
    };
  };

  // Editor mode: edit flexible layers ("camadas") or built-in elements ("elementos")
  const [editTarget, setEditTarget] = useState<'camadas' | 'elementos'>('camadas');
  const [editRegionId, setEditRegionId] = useState<string | null>(null);

  // Slide Order & Enabled/Disabled Configuration
  const slideOrder = getNormalizedSlideOrder(briefingCfg.slideOrder, briefingCfg.freeSlides, briefingCfg.simpleSlides);
  const activeSlides = slideOrder.filter((s) => s.enabled);
  const effectiveActiveSlides = activeSlides.length > 0 ? activeSlides : [DEFAULT_SLIDE_ORDER[0]];

  // Navigation Tabs & Presentation Mode state
  const [activeTab, setActiveTab] = useState<SlideId>(() => effectiveActiveSlides[0].id);
  const freeSlideActive = getFreeSlide(activeTab);
  const [isSlideOrderModalOpen, setIsSlideOrderModalOpen] = useState(false);
  const [presentationSlideId, setPresentationSlideId] = useState<SlideId>(() => effectiveActiveSlides[0].id);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const presentationContainerRef = useRef<HTMLDivElement>(null);

  // Slide 1 (Cover) Local State synced with briefingCfg
  const coverBgUrl = briefingCfg.coverBgUrl || PRESET_COVER_IMAGES[0].url;
  const coverBgColor = briefingCfg.coverBgColor;
  const coverBgOverlayOpacity = briefingCfg.coverBgOverlayOpacity ?? 0.65;
  const coverTitle = briefingCfg.coverTitle || 'Briefing Diário Operacional';
  const coverSubtitle = briefingCfg.coverSubtitle || 'Alinhamento de Turno & Informativo Diário';
  const coverTeamName = briefingCfg.coverTeamName || '';
  const coverSectorShiftText = briefingCfg.coverSectorShiftText || '';
  const coverDateText = briefingCfg.coverDateText || '';
  const coverFooterCustomText = briefingCfg.coverFooterCustomText || '';
  const motivationalQuote = briefingCfg.motivationalQuote || MOTIVATIONAL_QUOTES[0];
  const showQuote = briefingCfg.showQuote !== false && !briefingCfg.coverHideQuote;

  // Slide 4 (Scale) text & font customization
  const scaleTitle = briefingCfg.scaleTitle || '';
  const scaleSubtitle = briefingCfg.scaleSubtitle || '';
  const scaleFooterText = briefingCfg.scaleFooterText || '';
  const scaleTitleSize = briefingCfg.scaleTitleSize;
  const scaleSubtitleSize = briefingCfg.scaleSubtitleSize;
  const scaleFooterSize = briefingCfg.scaleFooterSize;

  // Real Size Preview Mode (1:1 / 100% HD Canvas view)
  const [isRealSizePreview, setIsRealSizePreview] = useState<boolean>(false);
  const [realSizeZoom, setRealSizeZoom] = useState<number>(100);

  // Reorder Tasks helper for Scale Slide
  // NOTE: orderedTasks is defined below processedTasks (used via useMemo in
  // renderSlideContent) because it depends on processedTasks at runtime.

  const handleMoveTaskOrder = (taskId: string, direction: 'up' | 'down') => {
    const currentList = (briefingCfg.scaleTaskOrderIds && briefingCfg.scaleTaskOrderIds.length > 0)
      ? [...briefingCfg.scaleTaskOrderIds]
      : processedTasks.map((t) => t.id);

    const idx = currentList.indexOf(taskId);
    if (idx === -1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentList.length) return;

    const temp = currentList[idx];
    currentList[idx] = currentList[targetIdx];
    currentList[targetIdx] = temp;

    updateBriefingConfig({ scaleTaskOrderIds: currentList });
  };

  const handleResetTaskOrder = () => {
    updateBriefingConfig({ scaleTaskOrderIds: [] });
    showNotice('Ordem padrão das tarefas restaurada.');
  };

  // Slide 2 (Operational PDF) Local State synced with briefingCfg
  const pdfUrl = briefingCfg.pdfUrl || '';
  const pdfPageNumber = briefingCfg.pdfPageNumber || 1;
  const pdfDirectImageUrl = briefingCfg.pdfDirectImageUrl || '';
  const pdfFitMode = briefingCfg.pdfFitMode || 'contain';
  const pdfZoom = briefingCfg.pdfZoom ?? 1;
  const pdfPanX = briefingCfg.pdfPanX ?? 0.5;
  const pdfPanY = briefingCfg.pdfPanY ?? 0.5;

  const resetPdfFraming = () => {
    updateBriefingConfig({ pdfFitMode: 'contain', pdfZoom: 1, pdfPanX: 0.5, pdfPanY: 0.5 });
    showNotice('Enquadramento do PDF restaurado para o padrão (conter / centralizado).');
  };

  // Force iframe reload when page changes
  const [iframeReloadKey, setIframeReloadKey] = useState(0);

  // pdf.js page viewer state (fallback to iframe on failure)
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfViewerFailed, setPdfViewerFailed] = useState(false);
  const [pageInput, setPageInput] = useState<string>(String(pdfPageNumber));

  // Reset the pdf.js viewer failure/fallback when the URL changes
  useEffect(() => {
    setPdfViewerFailed(false);
    setPdfTotalPages(0);
  }, [pdfUrl]);

  // Keep the typed page input in sync with the applied page
  useEffect(() => {
    setPageInput(String(pdfPageNumber));
  }, [pdfPageNumber]);

  // Clamp the page to the actual total once the PDF metadata loads
  useEffect(() => {
    if (pdfTotalPages > 0 && pdfPageNumber > pdfTotalPages) {
      updateBriefingConfig({ pdfPageNumber: pdfTotalPages });
    }
  }, [pdfTotalPages, pdfPageNumber, updateBriefingConfig]);

  const commitPdfPage = () => {
    const n = parseInt(pageInput, 10);
    if (!Number.isFinite(n) || n < 1) {
      setPageInput(String(pdfPageNumber));
      return;
    }
    const clamped = pdfTotalPages > 0 ? Math.min(n, pdfTotalPages) : n;
    updateBriefingConfig({ pdfPageNumber: clamped });
    setPageInput(String(clamped));
  };

  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingSlideImage, setIsUploadingSlideImage] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTLs, setSelectedTLs] = useState<string[]>([]);
  const [fontSizeMode, setFontSizeMode] = useState<'auto' | 'compact' | 'normal' | 'large'>('auto');
  const [showIntervals, setShowIntervals] = useState(true);
  const [abbreviateNames, setAbbreviateNames] = useState(true); // Default enabled as requested
  const [dimensioningViewMode, setDimensioningViewMode] = useState<'task_grid' | 'meal_slots'>('task_grid');
  const [mealTypeLabel, setMealTypeLabel] = useState<'janta' | 'almoco' | 'refeicao'>(() => {
    const shift = (state.teamShift || '').toUpperCase();
    if (['T1', 'T4'].includes(shift)) return 'almoco';
    return 'janta';
  });

  // Slide Order Handlers
  const handleToggleSlideEnabled = (id: SlideId) => {
    const updated = slideOrder.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    if (!updated.some((s) => s.enabled)) {
      showNotice('Ative pelo menos um slide para a apresentação.');
      return;
    }
    updateBriefingConfig({ slideOrder: updated });
  };

  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slideOrder.length) return;
    const updated = [...slideOrder];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    updateBriefingConfig({ slideOrder: updated });
  };

  const handleResetSlideOrder = () => {
    updateBriefingConfig({ slideOrder: DEFAULT_SLIDE_ORDER });
    showNotice('Ordem dos slides restaurada para o padrão.');
  };

  const handleAddSlide = (id: SlideId) => {
    const alreadyExists = slideOrder.some((s) => s.id === id);
    if (alreadyExists) {
      showNotice('Este slide já está na lista.');
      return;
    }
    const meta = OPTIONAL_ADDITIONAL_SLIDES.find((s) => s.id === id);
    if (!meta) return;
    const updated = [...slideOrder, { ...meta }];
    const patch: { slideOrder?: SlideConfigItem[]; simpleSlides?: Record<string, SimpleSlideConfig> } = {
      slideOrder: updated,
    };
    if (id === 'avisos' || id === 'dicas') {
      patch.simpleSlides = {
        ...simpleSlidesMap,
        [id]: { ...(DEFAULT_SIMPLE_SLIDES[id] || {}), ...(simpleSlidesMap[id] || {}) },
      };
    }
    updateBriefingConfig(patch);
    showNotice(`Slide "${meta.title}" adicionado à apresentação.`);
  };

  const handleRemoveSlide = (id: SlideId) => {
    const updated = slideOrder.filter((s) => s.id !== id);
    if (!updated.some((s) => s.enabled)) {
      showNotice('Mantenha pelo menos um slide ativo.');
      return;
    }
    updateBriefingConfig({
      slideOrder: updated,
      freeSlides: freeSlides.filter((f) => f.id !== id),
    });
    if (activeTab === id) {
      setActiveTab(updated.find((s) => s.enabled)?.id || DEFAULT_SLIDE_ORDER[0].id);
    }
    showNotice('Slide removido da apresentação.');
  };

  const handleCreateFreeSlide = () => {
    const newId = `free-${Date.now().toString(36)}`;
    const newSlide: FreeSlideConfig = {
      id: newId,
      title: `Slide Livre ${freeSlides.length + 1}`,
      bgUrl: '',
      bgColor: '#111827',
    };
    const defaultLayer: SlideItem = {
      id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
      type: 'text',
      content: newSlide.title,
      x: 10,
      y: 42,
      w: 80,
      h: 16,
      z: 1,
      fontSize: 2.6,
      fontWeight: 900,
      align: 'center',
      color: '#ffffff',
    };
    updateBriefingConfig({
      freeSlides: [...freeSlides, newSlide],
      slideOrder: [...slideOrder, { id: newId, enabled: true, title: newSlide.title }],
      slideItems: { ...slideItemsMap, [newId]: [defaultLayer] },
    });
    setIsSlideOrderModalOpen(false);
    setActiveTab(newId);
    showNotice('Slide livre criado! Edite o conteúdo com o botão "+ Texto / + Imagem".');
  };

  const handleFreeSlideBgUpload = (file: File) => {
    if (!activeTab) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateFreeSlide(activeTab, { bgUrl: dataUrl });
      showNotice('Imagem de fundo aplicada ao slide livre.');
    };
    reader.readAsDataURL(file);
  };

  // Helper to get dynamic slide number for display
  const getSlideNumber = (id: SlideId): number | null => {
    const idx = slideOrder.findIndex((s) => s.id === id);
    return idx !== -1 ? idx + 1 : null;
  };

  // Sync presentation slide if current presentation slide gets disabled
  useEffect(() => {
    if (!effectiveActiveSlides.some((s) => s.id === presentationSlideId)) {
      setPresentationSlideId(effectiveActiveSlides[0].id);
    }
  }, [effectiveActiveSlides, presentationSlideId]);

  const currentPresentationIndex = Math.max(
    0,
    effectiveActiveSlides.findIndex((s) => s.id === presentationSlideId)
  );

  const handleNextSlide = () => {
    const nextIdx = Math.min(effectiveActiveSlides.length - 1, currentPresentationIndex + 1);
    setPresentationSlideId(effectiveActiveSlides[nextIdx].id);
  };

  const handlePrevSlide = () => {
    const prevIdx = Math.max(0, currentPresentationIndex - 1);
    setPresentationSlideId(effectiveActiveSlides[prevIdx].id);
  };

  // Keyboard navigation for presentation mode
  useEffect(() => {
    if (!isPresentationMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevSlide();
      } else if (e.key === 'Escape') {
        exitPresentation();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresentationMode, currentPresentationIndex, effectiveActiveSlides]);

  // Idle auto-hide of presentation controls (pure slide mode: only the slide stays visible)
  const [presentationControlsVisible, setPresentationControlsVisible] = useState(true);

  useEffect(() => {
    if (!isPresentationMode) {
      setPresentationControlsVisible(true);
      return;
    }

    let hideTimer: number | undefined;

    const showControls = () => {
      setPresentationControlsVisible(true);
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setPresentationControlsVisible(false), 3000);
    };

    const onPointerMove = () => showControls();

    window.addEventListener('mousemove', onPointerMove);
    showControls();

    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [isPresentationMode]);

  // Force iframe reload when pdfPageNumber changes (for Google Docs Viewer / Drive preview)
  useEffect(() => {
    setIframeReloadKey((prev) => prev + 1);
  }, [pdfPageNumber]);

  // Slide 5 (Q&A / Perguntas) State & Full Configuration synced with briefingCfg
  const DEFAULT_QA_QUESTIONS = [
    'Alguma dúvida em relação ao dimensionamento e alocação de tarefas do dia?',
    'Dúvidas sobre os horários de janta, pausas e revezamento da equipe?',
    'Alinhamento de segurança do trabalho, ergonomia e uso correto de EPIs?',
    'Avisos da liderança, metas de produtividade e sugestões gerais do turno?',
  ];
  const [qaQuestions, setQaQuestions] = useState<string[]>(() => {
    return briefingCfg.qaQuestions && briefingCfg.qaQuestions.length > 0
      ? briefingCfg.qaQuestions
      : DEFAULT_QA_QUESTIONS;
  });
  const [newQaInput, setNewQaInput] = useState('');

  const qaTitle = briefingCfg.qaTitle || '5. Seção de Perguntas, Dúvidas e Alinhamentos';
  const qaSubtitle = briefingCfg.qaSubtitle || 'Espaço aberto para dúvidas da equipe e avisos da liderança';
  const qaDescription = briefingCfg.qaDescription || 'Aproveite este momento para alinhar prioridades do turno, esclarecer procedimentos e ouvir os apontamentos do time.';
  const qaBgUrl = briefingCfg.qaBgUrl || PRESET_QA_IMAGES[0].url;
  const qaDirectImageUrl = briefingCfg.qaDirectImageUrl || '';
  const qaSafetyText = briefingCfg.qaSafetyText || 'Valide o uso de calçados de segurança, luvas e coletes refletores antes de dirigir-se às áreas operacionais.';
  const qaQualityText = briefingCfg.qaQualityText || 'Sempre bipe o código do produto e do endereço. Em caso de avaria ou divergência, notifique o Team Leader.';
  const qaSupportText = briefingCfg.qaSupportText || 'Algum apontamento adicional? Procure seu Team Leader durante a operação.';

  const [isUploadingQaBg, setIsUploadingQaBg] = useState(false);

  // Process Knowledge state
  const processList = state.processKnowledgeList || [];
  const [selectedProcessId, setSelectedProcessId] = useState<string>(processList[0]?.id || '');
  const [selectedProcessCategories, setSelectedProcessCategories] = useState<string[]>([]);
  const [selectedProcessTypes, setSelectedProcessTypes] = useState<string[]>([]);

  // Modal State for Process Knowledge CRUD
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [typeInput, setTypeInput] = useState<ProcessType>('explicacao');
  const [categoryInput, setCategoryInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [keyTakeawaysInput, setKeyTakeawaysInput] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isUploadingProcessImage, setIsUploadingProcessImage] = useState(false);

  // Metadata for filter options
  const allRoles = Array.from(new Set(state.collaborators.map((c) => c.role || 'Operador'))).filter(Boolean);
  const roleOptions = allRoles.map((r) => ({ label: r, value: r }));

  const allCategories = Array.from(new Set(state.collaborators.map((c) => c.category || 'Geral'))).filter(Boolean);
  const categoryOptions = allCategories.map((c) => ({ label: c, value: c }));

  const allTLs = Array.from(new Set(state.collaborators.map((c) => c.teamLeader || state.defaultTeamLeader || 'Sem Time'))).filter(Boolean);
  const tlOptions = allTLs.map((tl) => ({ label: tl, value: tl }));

  const processCategories = Array.from(new Set(processList.map((p) => p.category))).filter(Boolean);
  const processCategoryOptions = processCategories.map((c) => ({ label: c, value: c }));

  const processTypeOptions = [
    { label: 'Explicação', value: 'explicacao' },
    { label: 'Segurança', value: 'seguranca' },
    { label: 'Qualidade', value: 'qualidade' },
    { label: 'Dica Prática', value: 'dica' },
  ];

  // Active collaborators and presence
  const activeCollaborators = state.collaborators || [];
  const dayIntervals = state.intervals[activeDate] || {};

  const presentCollaborators = activeCollaborators.filter((c) => {
    const statusInfo = getCollaboratorStatus(c, activeDate, state);
    return statusInfo.status === 'presente' || statusInfo.status === 'atraso';
  });

  // Process tasks for Scale Slide
  const processedTasks = (state.tasks || [])
    .filter((t) => t.active !== false)
    .map((task) => {
      const taskMembers = (task.members || [])
        .map((mId) => state.collaborators.find((c) => c.id === mId))
        .filter((c): c is NonNullable<typeof c> => {
          if (!c) return false;
          const statusInfo = getCollaboratorStatus(c, activeDate, state);
          if (statusInfo.status !== 'presente') return false;

          if (selectedRoles.length > 0 && !selectedRoles.includes(c.role)) return false;
          if (selectedCategories.length > 0 && !selectedCategories.includes(c.category)) return false;
          if (selectedTLs.length > 0 && !selectedTLs.includes(c.teamLeader || state.defaultTeamLeader || 'Sem Time')) return false;

          return true;
        });

      return {
        ...task,
        taskMembers,
      };
    })
    .filter((task) => task.taskMembers.length > 0);

  // Reorder Tasks helper for Scale Slide (depends on processedTasks above)
  const orderedTasks = React.useMemo(() => {
    const customOrder = briefingCfg.scaleTaskOrderIds || [];
    if (!customOrder || customOrder.length === 0) return processedTasks;

    const taskMap = new Map(processedTasks.map((t) => [t.id, t]));
    const result: typeof processedTasks = [];

    customOrder.forEach((id) => {
      if (taskMap.has(id)) {
        result.push(taskMap.get(id)!);
        taskMap.delete(id);
      }
    });

    taskMap.forEach((t) => result.push(t));
    return result;
  }, [processedTasks, briefingCfg.scaleTaskOrderIds]);

  // Helper to find break slot time for a person
  const getBreakTime = (personId: string) => {
    const slot = (state.breaks || []).find((b) => (dayIntervals[b.id] || []).includes(personId));
    return slot ? slot.time : null;
  };

  // Helper to group members of a task by their break slot
  const groupTaskMembersByBreakTime = (taskMembers: typeof state.collaborators) => {
    const map = new Map<string, typeof state.collaborators>();

    taskMembers.forEach((person) => {
      const time = getBreakTime(person.id) || 'Sem Horário Definido';
      if (!map.has(time)) {
        map.set(time, []);
      }
      map.get(time)!.push(person);
    });

    const result: Array<{ timeLabel: string; members: typeof state.collaborators }> = [];
    map.forEach((members, timeLabel) => {
      result.push({ timeLabel, members });
    });

    result.sort((a, b) => {
      if (a.timeLabel.includes('Sem Horário')) return 1;
      if (b.timeLabel.includes('Sem Horário')) return -1;
      return a.timeLabel.localeCompare(b.timeLabel);
    });

    return result;
  };

  // Fullscreen helpers (vendor-prefixed for wider browser support)
  const isNativeFullscreen = (): boolean =>
    !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).msFullscreenElement);

  const requestNativeFullscreen = (el: Element | null) => {
    if (!el) return;
    const anyEl = el as any;
    const rfs = anyEl.requestFullscreen?.bind(el) || anyEl.webkitRequestFullscreen?.bind(el) || anyEl.msRequestFullscreen?.bind(el);
    if (!rfs) return;
    try {
      const p = rfs();
      p?.catch?.(() => {});
    } catch {
      /* noop */
    }
  };

  const exitNativeFullscreen = () => {
    const doc = document as any;
    const fn = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
    if (fn) {
      try {
        fn.call(doc);
      } catch {
        /* noop */
      }
    }
  };

  // Keep the UI in sync with the real fullscreen state (including Esc / F exits)
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(isNativeFullscreen());
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('msfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('msfullscreenchange', onFsChange);
    };
  }, []);

  // Toggle Fullscreen helper
  const toggleFullscreen = () => {
    if (isNativeFullscreen()) {
      exitNativeFullscreen();
    } else {
      requestNativeFullscreen(presentationContainerRef.current || document.documentElement);
    }
  };

  // Enter presentation + best-effort fullscreen once the overlay has mounted
  const startPresentation = () => {
    setPresentationSlideId(activeTab as SlideId);
    setIsPresentationMode(true);
    requestAnimationFrame(() => {
      requestNativeFullscreen(presentationContainerRef.current || document.documentElement);
    });
  };

  // Leave presentation mode and also exit native fullscreen if it was engaged
  const exitPresentation = () => {
    setIsPresentationMode(false);
    if (isNativeFullscreen()) exitNativeFullscreen();
  };

  // Handle Cover BG Upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingCover(true);
      const compressed = await compressImageFile(file, 1200);
      updateBriefingConfig({ coverBgUrl: compressed });
      showNotice('Imagem de fundo da capa atualizada com sucesso!');
    } catch (err) {
      alert('Erro ao carregar imagem.');
    } finally {
      setIsUploadingCover(false);
    }
  };

  // Handle Slide Image Upload for Operational PDF fallback
  const handleSlideImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingSlideImage(true);
      const compressed = await compressImageFile(file, 1200);
      updateBriefingConfig({ pdfDirectImageUrl: compressed });
      showNotice('Imagem da folha do slide carregada!');
    } catch (err) {
      alert('Erro ao carregar imagem.');
    } finally {
      setIsUploadingSlideImage(false);
    }
  };

  // Random quote generator
  const handleRandomQuote = () => {
    const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    const newQuote = MOTIVATIONAL_QUOTES[randomIndex];
    updateBriefingConfig({ motivationalQuote: newQuote });
  };

  const activeShiftFilter = state.selectedShiftFilter || state.teamShift || 'ALL';

  // Process Knowledge Filtering
  const filteredProcessList = processList.filter((p) => {
    if (activeShiftFilter !== 'ALL' && activeShiftFilter !== 'todos' && activeShiftFilter !== 'Geral') {
      const itemShift = p.shift || 'Todos';
      if (itemShift !== 'Todos' && itemShift !== 'Geral' && itemShift !== activeShiftFilter) {
        return false;
      }
    }
    const matchesCat = selectedProcessCategories.length === 0 || selectedProcessCategories.includes(p.category);
    const matchesType = selectedProcessTypes.length === 0 || selectedProcessTypes.includes(p.type);
    return matchesCat && matchesType;
  });

  const activeProcessIndex = filteredProcessList.findIndex((p) => p.id === selectedProcessId);
  const currentProcess: ProcessKnowledge | undefined =
    filteredProcessList[activeProcessIndex] || filteredProcessList[0] || processList[0];

  const handleNextProcess = () => {
    if (filteredProcessList.length === 0) return;
    const nextIdx = (activeProcessIndex + 1) % filteredProcessList.length;
    setSelectedProcessId(filteredProcessList[nextIdx].id);
  };

  const handlePrevProcess = () => {
    if (filteredProcessList.length === 0) return;
    const prevIdx = (activeProcessIndex - 1 + filteredProcessList.length) % filteredProcessList.length;
    setSelectedProcessId(filteredProcessList[prevIdx].id);
  };

  const handleRandomProcess = () => {
    if (filteredProcessList.length === 0) return;
    const randomIdx = Math.floor(Math.random() * filteredProcessList.length);
    setSelectedProcessId(filteredProcessList[randomIdx].id);
  };

  // Process CRUD Handlers
  const handleOpenAddProcessModal = () => {
    setEditingProcessId(null);
    setTitleInput('');
    setTypeInput('explicacao');
    setCategoryInput(state.sector || 'Operação');
    setDescriptionInput('');
    setKeyTakeawaysInput('');
    setImageUrlInput('');
    setIsManageModalOpen(true);
  };

  const handleOpenEditProcessModal = (item: ProcessKnowledge) => {
    setEditingProcessId(item.id);
    setTitleInput(item.title);
    setTypeInput(item.type);
    setCategoryInput(item.category);
    setDescriptionInput(item.description);
    setKeyTakeawaysInput((item.keyTakeaways || []).join('\n'));
    setImageUrlInput(item.imageUrl || '');
    setIsManageModalOpen(true);
  };

  const handleSaveProcess = () => {
    if (!titleInput.trim()) return;
    const takeaways = keyTakeawaysInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingProcessId) {
      updateProcessKnowledge(editingProcessId, {
        title: titleInput.trim(),
        type: typeInput,
        category: categoryInput.trim() || 'Geral',
        description: descriptionInput.trim(),
        keyTakeaways: takeaways,
        imageUrl: imageUrlInput.trim() || undefined,
      });
    } else {
      addProcessKnowledge({
        title: titleInput.trim(),
        type: typeInput,
        category: categoryInput.trim() || 'Geral',
        description: descriptionInput.trim(),
        keyTakeaways: takeaways,
        imageUrl: imageUrlInput.trim() || undefined,
        active: true,
      });
    }
    setIsManageModalOpen(false);
  };

  // Type badge details
  const getTypeBadgeDetails = (type: ProcessType) => {
    switch (type) {
      case 'caracteristica':
        return {
          label: 'Característica do Processo',
          bg: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800',
          icon: <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
        };
      case 'curiosidade':
        return {
          label: 'Curiosidade Operacional',
          bg: 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
          icon: <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
        };
      case 'explicacao':
        return {
          label: 'Explicação do Processo',
          bg: 'bg-indigo-100 text-indigo-950 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-100 dark:border-indigo-800',
          icon: <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
        };
      case 'procedimento':
        return {
          label: 'Procedimento Padrão (SOP)',
          bg: 'bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950 dark:text-purple-100 dark:border-purple-800',
          icon: <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
        };
      case 'seguranca':
        return {
          label: 'Segurança do Trabalho',
          bg: 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800',
          icon: <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
        };
      case 'qualidade':
        return {
          label: 'Conformidade & Qualidade',
          bg: 'bg-teal-100 text-teal-950 border-teal-300 dark:bg-teal-950 dark:text-teal-100 dark:border-teal-800',
          icon: <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />,
        };
      default:
        return {
          label: 'Informação de Processo',
          bg: 'bg-gray-100 text-gray-900 border-gray-300 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700',
          icon: <Info className="w-4 h-4 text-gray-600" />,
        };
    }
  };

  const totalDimensioned = processedTasks.reduce((acc, t) => acc + t.taskMembers.length, 0);

  let nameFontSize = 'text-xs';
  let dotPaddingClass = 'py-0.5';

  if (fontSizeMode === 'compact') {
    nameFontSize = 'text-[10px]';
    dotPaddingClass = 'py-0.2';
  } else if (fontSizeMode === 'normal') {
    nameFontSize = 'text-xs font-semibold';
    dotPaddingClass = 'py-0.5';
  } else if (fontSizeMode === 'large') {
    nameFontSize = 'text-sm font-bold';
    dotPaddingClass = 'py-1';
  } else {
    if (totalDimensioned > 45) {
      nameFontSize = 'text-[10px]';
      dotPaddingClass = 'py-0.2';
    } else if (totalDimensioned > 25) {
      nameFontSize = 'text-[11px]';
      dotPaddingClass = 'py-0.5';
    } else {
      nameFontSize = 'text-xs font-bold';
      dotPaddingClass = 'py-1';
    }
  }

  // Active Embed URL for Slide 2
  const activeEmbedUrl = formatDocumentEmbedUrl(pdfUrl, pdfPageNumber);

  // Force iframe reload when page number changes
  useEffect(() => {
    setIframeReloadKey((k) => k + 1);
  }, [pdfPageNumber]);

  // Renders a built-in slide element as an absolutely-positioned region (movable/resizable via elementLayout)
  const RegionBox: React.FC<{
    slideId: SlideId;
    regionId: string;
    def: RegionDef;
    children: React.ReactNode;
    fillMode?: 'flex-col' | 'flex-row' | 'block';
    className?: string;
  }> = ({ slideId, regionId, def, children, fillMode = 'block', className = '' }) => {
    const rect = getRegionRect(slideId, regionId, def);
    if (rect.hidden) return null;
    const flexClass =
      fillMode === 'flex-col' ? 'flex flex-col' : fillMode === 'flex-row' ? 'flex flex-row' : '';
    return (
      <div
        className={`absolute ${flexClass} ${className}`}
        style={{
          left: `${rect.x}%`,
          top: `${rect.y}%`,
          width: `${rect.w}%`,
          height: `${rect.h}%`,
        }}
      >
        {children}
      </div>
    );
  };

  // Render individual slide component by slideId ('cover' | 'operational_pdf' | 'process' | 'scale' | 'qa' | 'avisos' | 'dicas' | free)
  const renderSlideContent = (slideId: SlideId) => {
    const currentIdx = effectiveActiveSlides.findIndex((s) => s.id === slideId);
    const slideNumberDisplay = currentIdx !== -1 ? currentIdx + 1 : 1;
    const totalSlidesDisplay = effectiveActiveSlides.length;
    const typo = getSlideTypo(slideId);
    const fontFamily = typo.fontFamily || undefined;
    const sTitle = typo.titleSize ? `${typo.titleSize}px` : undefined;
    const sBody = typo.bodySize ? `${typo.bodySize}px` : undefined;
    const sFooter = typo.footerSize ? `${typo.footerSize}px` : undefined;

    switch (slideId) {
      case 'cover':
        // SLIDE 1: COVER / APRESENTAÇÃO
        const hideHeader = briefingCfg.coverHideHeader === true;
        const hideLogo = briefingCfg.coverHideLogo === true;
        const hideTeamName = briefingCfg.coverHideTeamName === true;
        const hideSectorShift = briefingCfg.coverHideSectorShift === true;
        const hideDateBadge = briefingCfg.coverHideDateBadge === true;
        const hideCategoryBadge = briefingCfg.coverHideCategoryBadge === true;
        const hideMainTitle = briefingCfg.coverHideMainTitle === true;
        const hideFooter = briefingCfg.coverHideFooter === true;
        const hidePresentStats = briefingCfg.coverHidePresentStats === true;
        const hideManagerStat = briefingCfg.coverHideManagerStat === true;

        return (
          <div
            className="relative aspect-video rounded-3xl overflow-hidden border border-[var(--line)] shadow-xl bg-slate-950 text-white my-auto mx-auto shrink-0 select-none"
            style={{
              aspectRatio: '16 / 9',
              width: 'min(100cqw, calc(100cqh * 16 / 9))',
              height: 'min(100cqh, calc(100cqw * 9 / 16))',
              fontFamily,
              backgroundColor: coverBgColor || undefined,
            }}
          >
            {/* Background Image with Customizable Dark Overlay */}
            {coverBgUrl && (
              <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-700 scale-105"
                style={{ backgroundImage: `url(${coverBgUrl})` }}
              />
            )}
            <div
              className="absolute inset-0 bg-slate-950"
              style={{ opacity: coverBgOverlayOpacity }}
            />

            {/* Header Identity Badge */}
            {!hideHeader && (!hideLogo || !hideTeamName || !hideSectorShift || !hideDateBadge) && (
              <RegionBox slideId="cover" regionId="header" def={SLIDE_REGION_DEFS.cover.header} fillMode="flex-row" className="z-10">
                <div className="w-full h-full flex items-center justify-between border-b border-white/20 pb-4 px-1">
                  <div className="flex items-center gap-3">
                    {!hideLogo && (
                      <div className="w-12 h-12 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center font-black text-xl shadow-lg border border-white/30" style={{ backgroundColor: getSlideAccent('cover') || undefined }}>
                        <Building2 className="w-6 h-6" />
                      </div>
                    )}
                    {(!hideTeamName || !hideSectorShift) && (
                      <div>
                        {!hideTeamName && (
                          <h3 className="text-xl font-black uppercase tracking-wider text-white">
                            {coverTeamName || state.teamName || 'OPERAÇÃO LOGÍSTICA'}
                          </h3>
                        )}
                        {!hideSectorShift && (
                          <p className="text-xs font-bold text-slate-300 tracking-wide uppercase">
                            {coverSectorShiftText || `SETOR ${state.sector || 'OPERACIONAL'} • TURNO ${state.teamShift || 'T2'}`}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {!hideDateBadge && (
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-xs font-black">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span className="text-white capitalize">{coverDateText || formatDateLongBR(activeDate)}</span>
                    </div>
                  )}
                </div>
              </RegionBox>
            )}

            {/* Center Main Presentation Title */}
            {(!hideCategoryBadge || !hideMainTitle || showQuote) && (
              <RegionBox slideId="cover" regionId="title" def={SLIDE_REGION_DEFS.cover.title} fillMode="flex-col" className="z-10">
                <div className="w-full h-full flex flex-col justify-center py-4 max-w-3xl space-y-3.5">
                  {!hideCategoryBadge && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-widest">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{coverTitle}</span>
                    </div>
                  )}

                  {!hideMainTitle && (
                    <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight drop-shadow-md" style={sTitle ? { fontSize: sTitle } : undefined}>
                      {coverSubtitle}
                    </h1>
                  )}

                  {showQuote && (
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3.5 rounded-2xl text-slate-200 italic font-medium text-sm sm:text-base flex items-start gap-3 shadow-md">
                      <MessageSquare className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="not-italic text-[10px] uppercase tracking-wider font-extrabold text-emerald-400 mb-1">
                          Frase Motivacional do Dia
                        </p>
                        <p style={sBody ? { fontSize: sBody } : undefined}>"{motivationalQuote}"</p>
                      </div>
                    </div>
                  )}
                </div>
              </RegionBox>
            )}

            {/* Footer Metrics */}
            {!hideFooter && (!hidePresentStats || !hideManagerStat || !!coverFooterCustomText) && (
              <RegionBox slideId="cover" regionId="footer" def={SLIDE_REGION_DEFS.cover.footer} fillMode="flex-col" className="z-10">
                <div className="w-full h-full flex items-center justify-between border-t border-white/20 pt-3 px-1" style={sFooter ? { fontSize: sFooter } : undefined}>
                  {coverFooterCustomText ? (
                    <div className="text-xs font-bold text-slate-200">{coverFooterCustomText}</div>
                  ) : (
                    <div className="flex items-center gap-6">
                      {!hidePresentStats && (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-400" />
                          <span>
                            Equipe Presente Hoje: <strong className="text-white font-extrabold text-sm">{presentCollaborators.length}</strong> colaboradores
                          </span>
                        </div>
                      )}
                      {!hideManagerStat && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-400" />
                          <span>
                            Gestor: <strong className="text-white font-extrabold">{state.manager || 'Geral'}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
                    Slide {slideNumberDisplay} de {totalSlidesDisplay} • Capa de Apresentação
                  </div>
                </div>
              </RegionBox>
            )}
          </div>
        );

      case 'operational_pdf':
        // SLIDE 2: INFORMATIVO DA OPERAÇÃO (PDF / DOCUMENT)
        return (
          <div
            className="relative aspect-video rounded-3xl overflow-hidden border border-[var(--line)] shadow-xl bg-[var(--paper)] my-auto mx-auto shrink-0 select-none"
            style={{
              aspectRatio: '16 / 9',
              width: 'min(100cqw, calc(100cqh * 16 / 9))',
              height: 'min(100cqh, calc(100cqw * 9 / 16))',
              backgroundColor: slideBgColorMap['operational_pdf'] || undefined,
              fontFamily,
            }}
          >
            {/* Header */}
            <RegionBox slideId="operational_pdf" regionId="header" def={SLIDE_REGION_DEFS.operational_pdf.header} fillMode="flex-row" className="z-10">
              <div className="w-full h-full flex items-center justify-between border-b border-[var(--line)] pb-2.5 px-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[var(--ink)] uppercase tracking-wide" style={sTitle ? { fontSize: sTitle } : undefined}>
                      Informativo da Operação
                    </h3>
                    <p className="text-[11px] font-bold text-[var(--muted)]">
                      Informativo diário emitido pela liderança/qualidade • Página {pdfPageNumber}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-xl text-xs font-black">
                    Página {pdfPageNumber} selecionada
                  </span>
                </div>
              </div>
            </RegionBox>

            {/* Document Render Area */}
            <RegionBox slideId="operational_pdf" regionId="content" def={SLIDE_REGION_DEFS.operational_pdf.content} fillMode="flex-col" className="z-10">
              <div className="w-full h-full min-h-0 bg-[var(--bg)] rounded-2xl border border-[var(--line)] overflow-hidden relative flex flex-col items-center justify-center">
                {pdfDirectImageUrl ? (
                  // Direct uploaded slide image (honors the same framing panel as the PDF viewer)
                  <FramedImage
                    src={pdfDirectImageUrl}
                    alt="Informativo Operacional"
                    className="bg-slate-900"
                    fitMode={pdfFitMode}
                    zoom={pdfZoom}
                    panX={pdfPanX}
                    panY={pdfPanY}
                  />
                ) : isPdfSource(pdfUrl) && !pdfViewerFailed ? (
                  // Page-by-page PDF rendering (centered, fit by max height)
                  <PdfPageViewer
                    url={(getPdfSourceUrls(pdfUrl)[0] || '').trim()}
                    altUrls={getPdfSourceUrls(pdfUrl).slice(1)}
                    page={pdfPageNumber}
                    onTotalPages={(total) => setPdfTotalPages(total)}
                    onError={() => setPdfViewerFailed(true)}
                    fitMode={pdfFitMode}
                    zoom={pdfZoom}
                    panX={pdfPanX}
                    panY={pdfPanY}
                  />
                ) : activeEmbedUrl ? (
                  // Interactive Embedded PDF / Document Viewer (fallback)
                  <div className="w-full h-full flex items-center justify-center overflow-hidden">
                    <iframe
                      key={`${activeEmbedUrl}-${iframeReloadKey}`}
                      src={activeEmbedUrl}
                      title="Informativo Operacional do Dia"
                      className="w-full h-full max-h-full border-none rounded-2xl bg-white"
                      allow="autoplay; encrypted-media; fullscreen"
                      style={{ width: '100%', height: '100%', maxHeight: '100%' }}
                    />
                  </div>
                ) : (
                  // Empty state preview prompt
                  <div className="p-8 text-center space-y-3 max-w-md">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-2xl mx-auto flex items-center justify-center shadow-inner">
                      <FileText className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-black text-[var(--ink)]">
                      Nenhum Informativo PDF Carregado
                    </h4>
                    <p className="text-xs text-[var(--muted)] font-medium leading-relaxed">
                      Cole o link do PDF no campo abaixo ou faça upload de uma foto da folha do informativo para exibir nesta tela de briefing.
                    </p>
                  </div>
                )}
              </div>
            </RegionBox>

            {/* Slide 2 Footer */}
            <RegionBox slideId="operational_pdf" regionId="footer" def={SLIDE_REGION_DEFS.operational_pdf.footer} fillMode="flex-row" className="z-10">
              <div className="w-full h-full flex items-center justify-between border-t border-[var(--line)] pt-2.5 px-1" style={sFooter ? { fontSize: sFooter } : undefined}>
                <span className="truncate max-w-md">
                  {pdfUrl ? `URL: ${pdfUrl}` : 'Insira a URL do PDF ou Google Drive nas opções'}
                </span>
                <span className="text-[10px] uppercase font-black text-[var(--primary)]">
                  Slide {slideNumberDisplay} de {totalSlidesDisplay} • Informativo Operacional
                </span>
              </div>
            </RegionBox>
          </div>
        );

      case 'process':
        // SLIDE 3: REFORÇO DE CONHECIMENTO DO PROCESSO
        return (
          <div
            className="relative aspect-video rounded-3xl overflow-hidden border border-[var(--line)] shadow-xl bg-[var(--paper)] my-auto mx-auto shrink-0 select-none"
            style={{
              aspectRatio: '16 / 9',
              width: 'min(100cqw, calc(100cqh * 16 / 9))',
              height: 'min(100cqh, calc(100cqw * 9 / 16))',
              backgroundColor: slideBgColorMap['process'] || undefined,
              fontFamily,
            }}
          >
            {currentProcess ? (
              <>
                {/* Header */}
                <RegionBox slideId="process" regionId="header" def={SLIDE_REGION_DEFS.process.header} fillMode="flex-row" className="z-10">
                  <div className="w-full h-full flex items-center justify-between border-b border-[var(--line)] pb-3 px-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black" style={{ backgroundColor: getSlideAccent('process') || undefined }}>
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[var(--ink)] uppercase tracking-wide">
                          Reforço de Conhecimento do Processo
                        </h3>
                        <p className="text-xs font-bold text-[var(--muted)]">
                          {currentProcess.category} • Card {activeProcessIndex + 1} de {filteredProcessList.length}
                        </p>
                      </div>
                    </div>

                    {/* Badge */}
                    {(() => {
                      const badge = getTypeBadgeDetails(currentProcess.type);
                      return (
                        <span className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 ${badge.bg}`}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      );
                    })()}
                  </div>
                </RegionBox>

                {/* Main Process Content */}
                <RegionBox slideId="process" regionId="content" def={SLIDE_REGION_DEFS.process.content} fillMode="flex-col" className="z-10">
                  <div className="w-full h-full min-h-0 grid grid-cols-1 md:grid-cols-12 gap-5 items-center overflow-hidden py-2">
                    <div className={`${currentProcess.imageUrl ? 'md:col-span-7' : 'md:col-span-12'} space-y-3.5 h-full flex flex-col justify-center`}>
                      <h2 className="text-xl sm:text-3xl font-black text-[var(--ink)] leading-snug" style={sTitle ? { fontSize: sTitle } : undefined}>
                        {currentProcess.title}
                      </h2>

                      <div className="bg-[var(--bg)] p-3.5 rounded-2xl border border-[var(--line)] text-xs sm:text-sm font-medium text-[var(--ink)] leading-relaxed overflow-y-auto" style={sBody ? { fontSize: sBody } : undefined}>
                        {currentProcess.description}
                      </div>

                      {currentProcess.keyTakeaways && currentProcess.keyTakeaways.length > 0 && (
                        <div className="space-y-1.5 overflow-y-auto">
                          <h4 className="text-xs font-black text-[var(--primary)] uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>Pontos de Atenção & Boas Práticas:</span>
                          </h4>
                          <ul className="grid grid-cols-1 gap-1.5">
                            {currentProcess.keyTakeaways.map((takeaway, idx) => (
                              <li
                                key={idx}
                                className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-100 p-2 rounded-xl text-xs sm:text-xs font-bold flex items-start gap-2"
                              >
                                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] shrink-0 font-black mt-0.5">
                                  {idx + 1}
                                </span>
                                <span>{takeaway}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {currentProcess.imageUrl && (
                      <div className="md:col-span-5 flex items-center justify-center h-full max-h-[320px]">
                        <img
                          src={currentProcess.imageUrl}
                          alt={currentProcess.title}
                          className="max-h-full max-w-full object-contain rounded-2xl border border-[var(--line)] shadow-md"
                        />
                      </div>
                    )}
                  </div>
                </RegionBox>

                {/* Footer */}
                <RegionBox slideId="process" regionId="footer" def={SLIDE_REGION_DEFS.process.footer} fillMode="flex-row" className="z-10">
                  <div className="w-full h-full flex items-center justify-between border-t border-[var(--line)] pt-2.5 px-1" style={sFooter ? { fontSize: sFooter } : undefined}>
                    <span>Equipe: {state.teamName}</span>
                    <span className="text-[10px] font-black uppercase text-purple-600">
                      Slide {slideNumberDisplay} de {totalSlidesDisplay} • Reforço de Processo
                    </span>
                  </div>
                </RegionBox>
              </>
            ) : (
              <RegionBox slideId="process" regionId="content" def={SLIDE_REGION_DEFS.process.content} fillMode="flex-col" className="z-10">
                <div className="w-full h-full flex items-center justify-center">
                  <div className="p-12 text-center space-y-3">
                    <GraduationCap className="w-12 h-12 text-purple-600 mx-auto" />
                    <h3 className="text-lg font-black text-[var(--ink)]">
                      Nenhum Card de Conhecimento de Processo Encontrado
                    </h3>
                    <p className="text-xs text-[var(--muted)] font-medium">
                      Cadastre tópicos de treinamento ou boas práticas para apresentar neste slide do briefing.
                    </p>
                    <button
                      onClick={handleOpenAddProcessModal}
                      className="px-4 py-2 bg-purple-600 text-white text-xs font-black rounded-xl hover:bg-purple-700 cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Cadastrar Novo Processo</span>
                    </button>
                  </div>
                </div>
              </RegionBox>
            )}
          </div>
        );

      case 'scale': {
        // SLIDE 4: ESCALA E DIMENSIONAMENTO (CONFIGURABLE BLOCKS, FONTS, AND HEADERS)
        const baseTasks = orderedTasks;
        const numTasks = baseTasks.length;
        const maxTaskMembers = Math.max(...baseTasks.map((t) => t.taskMembers.length), 0);
        const totalTaskMembers = baseTasks.reduce((sum, t) => sum + t.taskMembers.length, 0);

        // Density & Font customization overrides or smart defaults
        const customGridCols = briefingCfg.scaleGridCols;
        const customCardPadding = briefingCfg.scaleCardPadding;
        const customTaskNameSize = briefingCfg.scaleTaskNameSize;
        const customCollabNameSize = briefingCfg.scaleCollaboratorNameSize;
        const headerStyle = briefingCfg.scaleHeaderStyle || 'banner'; // 'banner' | 'subtle' | 'minimal'
        const customHeaderBgColor = briefingCfg.scaleHeaderBgColor;

        let gridCols: string;
        if (customGridCols && customGridCols !== 'auto') {
          if (customGridCols === 2) gridCols = 'grid-cols-2';
          else if (customGridCols === 3) gridCols = 'grid-cols-3';
          else if (customGridCols === 4) gridCols = 'grid-cols-4';
          else gridCols = 'grid-cols-5';
        } else {
          if (numTasks <= 2) gridCols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3';
          else if (numTasks <= 8) gridCols = 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-4';
          else gridCols = 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5';
        }

        let cardPadding: string;
        if (customCardPadding === 'compact') cardPadding = 'p-1 space-y-0.5';
        else if (customCardPadding === 'normal') cardPadding = 'p-2 space-y-1';
        else if (customCardPadding === 'spacious') cardPadding = 'p-3 space-y-1.5';
        else {
          if (numTasks <= 2) cardPadding = maxTaskMembers > 8 ? 'p-1.5 space-y-0.5' : 'p-2 space-y-1';
          else if (numTasks <= 8) cardPadding = 'p-1.5 space-y-0.5';
          else cardPadding = 'p-1 space-y-0.5';
        }

        let defaultCardTitleSize = '10px';
        if (numTasks <= 2) defaultCardTitleSize = maxTaskMembers > 8 ? '10.5px' : '12px';
        else if (numTasks <= 8) defaultCardTitleSize = '10px';
        else defaultCardTitleSize = '9.5px';

        let defaultNameSize = '9px';
        if (numTasks <= 2) defaultNameSize = maxTaskMembers > 8 ? '8.5px' : '10px';
        else if (numTasks <= 8) defaultNameSize = maxTaskMembers > 6 ? '8.5px' : '9.5px';
        else defaultNameSize = '8px';

        const itemPadding = customCardPadding === 'spacious' ? 'px-2 py-1' : customCardPadding === 'compact' ? 'px-1 py-[1px]' : 'px-1.5 py-0.5';

        // Meal slots active list
        const activeMealSlots = (state.breaks || [])
          .map((slot) => {
            const idsInSlot = dayIntervals[slot.id] || [];
            const membersInSlot = idsInSlot
              .map((id) => presentCollaborators.find((c) => c.id === id))
              .filter((c): c is NonNullable<typeof c> => Boolean(c));
            return { slot, membersInSlot };
          })
          .filter((item) => item.membersInSlot.length > 0);

        const numMealSlots = activeMealSlots.length;
        const maxSlotMembers = Math.max(...activeMealSlots.map((s) => s.membersInSlot.length), 1);

        let mealGridCols = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
        if (numMealSlots === 1) mealGridCols = 'grid-cols-1 max-w-xl mx-auto';
        else if (numMealSlots === 2) mealGridCols = 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto';
        else if (numMealSlots >= 4) mealGridCols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

        const slotCardPadding = maxSlotMembers > 10 ? 'p-2 space-y-1' : 'p-3 space-y-1.5';
        const slotNameSize = maxSlotMembers > 12 ? '8.5px' : maxSlotMembers > 8 ? '9.5px' : '12px';
        const slotMemberPadding = maxSlotMembers > 10 ? 'p-1' : 'p-1.5';

        return (
          <div
            className="relative aspect-video rounded-3xl overflow-hidden border border-[var(--line)] shadow-xl bg-[var(--paper)] my-auto mx-auto shrink-0 select-none"
            style={{
              aspectRatio: '16 / 9',
              width: 'min(100cqw, calc(100cqh * 16 / 9))',
              height: 'min(100cqh, calc(100cqw * 9 / 16))',
              backgroundColor: slideBgColorMap['scale'] || undefined,
              fontFamily,
            }}
          >
            {/* Clean Presentation Header */}
            <RegionBox slideId="scale" regionId="header" def={SLIDE_REGION_DEFS.scale.header} fillMode="flex-row" className="z-10">
              <div className="w-full h-full flex items-center justify-between border-b border-[var(--line)] pb-2.5 px-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center font-black shadow-md" style={{ backgroundColor: getSlideAccent('scale') || undefined }}>
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <div>
                    <h3
                      className="text-base sm:text-lg font-black text-[var(--ink)] uppercase tracking-wide"
                      style={(sTitle || scaleTitleSize) ? { fontSize: sTitle || `${scaleTitleSize}px` } : undefined}
                    >
                      {scaleTitle || '4. Escala e Dimensionamento de Tarefas'}
                    </h3>
                    <p className="text-xs font-bold text-[var(--muted)]" style={(sBody || scaleSubtitleSize) ? { fontSize: sBody || `${scaleSubtitleSize}px` } : undefined}>
                      {scaleSubtitle.trim() || `${state.teamName} • ${formatDateBR(activeDate)} • ${totalDimensioned} Alocados (${presentCollaborators.length} Presentes)`}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)] rounded-xl font-black text-xs flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>{dimensioningViewMode === 'task_grid' ? 'Alocação por Tarefa' : `Escala de ${mealTypeLabel === 'almoco' ? 'Almoço' : 'Janta'}`}</span>
                </span>
              </div>
            </RegionBox>

            {/* Main Content Area */}
            <RegionBox slideId="scale" regionId="content" def={SLIDE_REGION_DEFS.scale.content} fillMode="flex-col" className="z-10">
              <div className="w-full h-full min-h-0 overflow-hidden flex flex-col justify-start">
              {dimensioningViewMode === 'task_grid' ? (
                /* TASK GRID MODE */
                baseTasks.length > 0 ? (
                  <div className={`grid ${gridCols} gap-2.5 items-stretch h-full min-h-0 overflow-hidden`}>
                    {baseTasks.map((task) => {
                      const isLargeTask = task.taskMembers.length >= 6;
                      const timeGroups = groupTaskMembersByBreakTime(task.taskMembers);

                      return (
                        <div
                          key={task.id}
                          className={`bg-[var(--bg)] border border-[var(--line)] rounded-2xl ${cardPadding} flex flex-col justify-start shadow-2xs transition-all h-full min-h-0 overflow-hidden ${
                            isLargeTask && numTasks >= 3 ? 'sm:col-span-2 bg-gradient-to-br from-[var(--bg)] to-[var(--paper)]' : ''
                          }`}
                        >
                          {/* TASK HEADER WITH HIGHLIGHT BANNER OPTION */}
                          {headerStyle === 'banner' ? (
                            <div
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-t-xl shrink-0 mb-1.5 shadow-2xs border-b border-white/20"
                              style={{
                                backgroundColor: customHeaderBgColor || getSlideAccent('scale') || 'var(--primary)',
                                color: '#ffffff',
                              }}
                            >
                              <h4
                                className="font-black uppercase tracking-wide truncate pr-1 text-white"
                                style={{ fontSize: customTaskNameSize ? `${customTaskNameSize}px` : defaultCardTitleSize }}
                                title={task.name}
                              >
                                {task.name}
                              </h4>
                              <span className="px-2 py-0.5 bg-white/20 text-white rounded-full text-[10px] font-black shrink-0 backdrop-blur-xs">
                                {task.taskMembers.length} {task.taskMembers.length === 1 ? 'p' : 'p'}
                              </span>
                            </div>
                          ) : headerStyle === 'subtle' ? (
                            <div className="flex items-center justify-between px-2 py-1 bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)] rounded-xl shrink-0 mb-1">
                              <h4
                                className="font-black uppercase tracking-wide truncate pr-1"
                                style={{ fontSize: customTaskNameSize ? `${customTaskNameSize}px` : defaultCardTitleSize }}
                                title={task.name}
                              >
                                {task.name}
                              </h4>
                              <span className="px-2 py-0.5 bg-[var(--primary)] text-white rounded-full text-[10px] font-black shrink-0">
                                {task.taskMembers.length}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between border-b border-[var(--line)] pb-1 shrink-0 mb-1">
                              <h4
                                className="font-black uppercase tracking-wide truncate pr-1 text-[var(--ink)]"
                                style={{ fontSize: customTaskNameSize ? `${customTaskNameSize}px` : defaultCardTitleSize }}
                                title={task.name}
                              >
                                {task.name}
                              </h4>
                              <span className="px-2 py-0.5 bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)] rounded-full text-[10px] font-black shrink-0">
                                {task.taskMembers.length}
                              </span>
                            </div>
                          )}

                          <div className="space-y-1 flex-1 min-h-0 overflow-hidden flex flex-col justify-start">
                            {timeGroups.map((group, idx) => (
                              <div key={idx} className="space-y-0.5">
                                {/* Centered Time Section Line Divider */}
                                {showIntervals && (
                                  <div className="flex items-center gap-1 mt-0.5 mb-0.5">
                                    <div className="h-px bg-[var(--line)] flex-1" />
                                    <span className="px-2 py-0.5 bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)] rounded-full text-[9px] font-black flex items-center gap-1 shrink-0 shadow-2xs">
                                      <Clock className="w-3 h-3 text-[var(--primary)] shrink-0" />
                                      <span>{group.timeLabel} ({group.members.length})</span>
                                    </span>
                                    <div className="h-px bg-[var(--line)] flex-1" />
                                  </div>
                                )}

                                {/* Collaborators in this time slot */}
                                <div className={isLargeTask || group.members.length >= 5 ? 'grid grid-cols-2 sm:grid-cols-3 gap-1' : 'space-y-0.5'}>
                                  {group.members.map((person) => {
                                    const displayName = abbreviateNames
                                      ? abbreviateName(person.name, false)
                                      : person.name;

                                    return (
                                      <div
                                        key={person.id}
                                        className={`flex items-center justify-between bg-[var(--paper)] border border-[var(--line)] rounded-lg ${itemPadding} shadow-2xs`}
                                      >
                                        <div className="min-w-0 flex-1 pr-1">
                                          <span
                                            className="font-extrabold text-[var(--ink)] truncate block"
                                            style={{ fontSize: customCollabNameSize ? `${customCollabNameSize}px` : defaultNameSize }}
                                          >
                                            {displayName}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-[var(--muted)] font-bold">
                    Nenhuma tarefa dimensionada para o turno atual.
                  </div>
                )
              ) : (
                /* MEAL SLOTS MODE */
                activeMealSlots.length > 0 ? (
                  <div className={`grid ${mealGridCols} gap-2.5 items-stretch h-full min-h-0 overflow-hidden`}>
                    {activeMealSlots.map(({ slot, membersInSlot }) => (
                      <div
                        key={slot.id}
                        className={`bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary-border)] rounded-2xl ${slotCardPadding} flex flex-col justify-start shadow-2xs h-full min-h-0 overflow-hidden transition-colors`}
                      >
                        <div className="flex items-center justify-between border-b border-[var(--line)] pb-1.5 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-[var(--primary)] text-white font-black rounded-lg text-xs flex items-center gap-1 shadow-2xs">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="text-xs">{slot.time}</span>
                            </span>
                            <span className="font-black text-xs uppercase text-[var(--ink)]">
                              Horário de {mealTypeLabel === 'almoco' ? 'Almoço' : 'Janta'}
                            </span>
                          </div>
                          <span className="text-xs font-black bg-[var(--primary-soft)] text-[var(--primary)] px-2.5 py-0.5 rounded-full border border-[var(--primary-border)]">
                            {membersInSlot.length}
                          </span>
                        </div>

                        <div className={`flex-1 min-h-0 overflow-hidden my-1 pr-0.5 ${membersInSlot.length >= 6 ? 'grid grid-cols-2 gap-1' : 'space-y-1'}`}>
                          {membersInSlot.map((person) => {
                            const assignedTask = state.tasks.find((t) => t.members.includes(person.id));
                            const displayName = abbreviateNames
                              ? abbreviateName(person.name, false)
                              : person.name;

                            return (
                              <div
                                key={person.id}
                                className={`${slotMemberPadding} bg-[var(--paper)] border border-[var(--line)] rounded-xl flex items-center justify-between shadow-2xs min-w-0`}
                              >
                                <span className={`font-black ${slotNameSize} text-[var(--ink)] truncate pr-1 flex-1`}>
                                  {displayName}
                                </span>
                                <span className="text-[9.5px] font-black px-1.5 py-0.5 bg-[var(--primary-soft)] text-[var(--primary)] rounded-md border border-[var(--primary-border)] truncate max-w-[100px] shrink-0">
                                  {assignedTask ? assignedTask.name : 'Sem Tarefa'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-[var(--muted)] font-bold">
                    Nenhum colaborador alocado nos horários de refeição registrados.
                  </div>
                )
              )}
              </div>
            </RegionBox>

            {/* Footer */}
            <RegionBox slideId="scale" regionId="footer" def={SLIDE_REGION_DEFS.scale.footer} fillMode="flex-row" className="z-10">
              <div className="w-full h-full flex items-center justify-between border-t border-[var(--line)] pt-2 px-1">
                <span>{formatDateLongBR(activeDate)}</span>
                <span className="text-[10px] font-black uppercase text-[var(--primary)]" style={(sFooter || scaleFooterSize) ? { fontSize: sFooter || `${scaleFooterSize}px` } : undefined}>
                  Slide {slideNumberDisplay} de {totalSlidesDisplay} • {scaleFooterText.trim() || 'Escala e Dimensionamento'}
                </span>
              </div>
            </RegionBox>
          </div>
        );
      }

      case 'qa': {
        // SLIDE 5: SEÇÃO DE PERGUNTAS, DÚVIDAS & ALINHAMENTOS DO TURNO (FULLY CONFIGURABLE WITH CUSTOM BG IMAGE)
        const activeQaBg = qaDirectImageUrl || qaBgUrl;

        return (
          <div
            className="relative aspect-video rounded-3xl overflow-hidden border border-slate-800 shadow-xl bg-slate-950 text-white my-auto mx-auto shrink-0 select-none"
            style={{
              aspectRatio: '16 / 9',
              width: 'min(100cqw, calc(100cqh * 16 / 9))',
              height: 'min(100cqh, calc(100cqw * 9 / 16))',
              fontFamily,
            }}
          >
            {/* Optional Full Background Image */}
            {activeQaBg ? (
              <>
                <img
                  src={activeQaBg}
                  alt="Q&A Background"
                  className="absolute inset-0 w-full h-full object-cover z-0"
                />
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] z-0" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-purple-950/90 z-0" />
            )}

            <RegionBox slideId="qa" regionId="header" def={SLIDE_REGION_DEFS.qa.header} fillMode="flex-row" className="z-10">
              <div className="w-full h-full flex items-center justify-between border-b border-slate-800/80 pb-3 px-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md" style={{ backgroundColor: getSlideAccent('qa') || undefined }}>
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide" style={sTitle ? { fontSize: sTitle } : undefined}>
                      {qaTitle}
                    </h3>
                    <p className="text-xs font-bold text-slate-300">
                      {state.teamName} • {qaSubtitle}
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 bg-purple-500/20 text-purple-200 border border-purple-500/40 rounded-xl font-black text-xs flex items-center gap-1.5 backdrop-blur-md">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  <span>Espaço Aberto ao Time</span>
                </span>
              </div>
            </RegionBox>

            {/* Main Content Grid */}
            <RegionBox slideId="qa" regionId="content" def={SLIDE_REGION_DEFS.qa.content} fillMode="flex-col" className="z-10">
              <div className="w-full h-full min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch overflow-y-auto pr-1">
                {/* Left Column: Questions List */}
                <div className="md:col-span-7 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h4 className="font-black text-xs uppercase tracking-wider text-purple-200">
                      Tópicos de Discussão & Dúvidas do Turno
                    </h4>
                  </div>

                  {qaDescription && (
                    <p className="text-xs text-slate-300 font-medium leading-relaxed bg-purple-950/40 p-2.5 rounded-xl border border-purple-500/20" style={sBody ? { fontSize: sBody } : undefined}>
                      {qaDescription}
                    </p>
                  )}

                  <div className="space-y-2 flex-1">
                    {qaQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-start gap-3 hover:border-purple-400/80 transition-colors shadow-2xs"
                      >
                        <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <p className="text-xs font-bold text-slate-100 leading-snug pt-0.5" style={sBody ? { fontSize: sBody } : undefined}>
                          {q}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Operational Safety, Quality & Leadership Support Cards */}
                <div className="md:col-span-5 flex flex-col gap-3">
                  {qaSafetyText && (
                    <div className="p-3.5 bg-emerald-950/50 backdrop-blur-md border border-emerald-500/30 rounded-2xl space-y-1.5">
                      <div className="flex items-center gap-2 text-emerald-300 font-black text-xs uppercase tracking-wide">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Segurança do Trabalho & EPIs</span>
                      </div>
                      <p className="text-xs font-medium text-emerald-100 leading-relaxed">
                        {qaSafetyText}
                      </p>
                    </div>
                  )}

                  {qaQualityText && (
                    <div className="p-3.5 bg-blue-950/50 backdrop-blur-md border border-blue-500/30 rounded-2xl space-y-1.5">
                      <div className="flex items-center gap-2 text-blue-300 font-black text-xs uppercase tracking-wide">
                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                        <span>Foco em Qualidade & Erro Zero</span>
                      </div>
                      <p className="text-xs font-medium text-blue-100 leading-relaxed">
                        {qaQualityText}
                      </p>
                    </div>
                  )}

                  {qaSupportText && (
                    <div className="p-3.5 bg-purple-950/50 backdrop-blur-md border border-purple-500/30 rounded-2xl space-y-1.5 flex-1 flex flex-col justify-center">
                      <div className="flex items-center gap-2 text-purple-300 font-black text-xs uppercase tracking-wide">
                        <Users className="w-4 h-4 text-purple-400" />
                        <span>Suporte da Liderança</span>
                      </div>
                      <p className="text-xs font-medium text-purple-100 leading-relaxed">
                        {qaSupportText}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </RegionBox>

            {/* Footer */}
            <RegionBox slideId="qa" regionId="footer" def={SLIDE_REGION_DEFS.qa.footer} fillMode="flex-row" className="z-10">
              <div className="w-full h-full flex items-center justify-between border-t border-slate-800/80 pt-2.5 px-1" style={sFooter ? { fontSize: sFooter } : undefined}>
                <span>{formatDateLongBR(activeDate)}</span>
                <span className="text-[10px] font-black uppercase text-purple-400">
                  Slide {slideNumberDisplay} de {totalSlidesDisplay} • Perguntas e Respostas
                </span>
              </div>
            </RegionBox>
          </div>
        );
      }

      case 'avisos': {
        // SLIDE: AVISOS & ALINHAMENTOS DO TURNO
        const cfg = getSimpleSlide('avisos') || DEFAULT_SIMPLE_SLIDES.avisos;
        const accent = cfg.accent || '#f59e0b';
        return (
          <div
            className="relative aspect-video rounded-3xl overflow-hidden border border-slate-800 shadow-xl bg-slate-950 text-white my-auto mx-auto shrink-0 select-none"
            style={{
              aspectRatio: '16 / 9',
              width: 'min(100cqw, calc(100cqh * 16 / 9))',
              height: 'min(100cqh, calc(100cqw * 9 / 16))',
              fontFamily,
              backgroundColor: cfg.bgColor || '#1c1917',
            }}
          >
            {cfg.bgUrl ? (
              <>
                <img src={cfg.bgUrl} alt="" className="absolute inset-0 w-full h-full object-cover z-0" />
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] z-0" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/60 z-0" />
            )}

            <RegionBox slideId="avisos" regionId="header" def={SLIDE_REGION_DEFS.avisos.header} fillMode="flex-row" className="z-10">
              <div className="w-full h-full flex items-center justify-between border-b border-slate-800/80 pb-3 px-1">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl text-white flex items-center justify-center font-black shadow-md shrink-0" style={{ backgroundColor: accent }}>
                    <Megaphone className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide truncate" style={sTitle ? { fontSize: sTitle } : undefined}>
                      {cfg.title}
                    </h3>
                    <p className="text-xs font-bold text-slate-300 truncate" style={sBody ? { fontSize: sBody } : undefined}>
                      {state.teamName} • {cfg.subtitle}
                    </p>
                  </div>
                </div>

                <span
                  className="px-3 py-1 rounded-xl font-black text-xs flex items-center gap-1.5 backdrop-blur-md border shrink-0"
                  style={{ backgroundColor: `${accent}26`, color: accent, borderColor: `${accent}55` }}
                >
                  <Megaphone className="w-4 h-4" />
                  <span>Avisos do Dia</span>
                </span>
              </div>
            </RegionBox>

            {/* Main Content: announcement list */}
            <RegionBox slideId="avisos" regionId="content" def={SLIDE_REGION_DEFS.avisos.content} fillMode="flex-col" className="z-10">
              <div className="w-full h-full min-h-0 space-y-2.5 overflow-y-auto pr-1">
                {cfg.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 bg-slate-900/75 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 shadow-xs"
                  >
                    <span
                      className="w-6 h-6 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0"
                      style={{ backgroundColor: accent }}
                    >
                      {idx + 1}
                    </span>
                    <div className="text-xs font-bold text-slate-100 leading-snug pt-0.5 min-w-0" style={sBody ? { fontSize: sBody } : undefined}>
                      <MarkdownContent content={item} onColored />
                    </div>
                  </div>
                ))}
                {cfg.items.length === 0 && (
                  <div className="text-center text-xs text-slate-400 font-bold py-8">
                    Nenhum aviso cadastrado. Adicione avisos no painel lateral.
                  </div>
                )}
              </div>
            </RegionBox>

            {/* Footer */}
            <RegionBox slideId="avisos" regionId="footer" def={SLIDE_REGION_DEFS.avisos.footer} fillMode="flex-row" className="z-10">
              <div className="w-full h-full flex items-center justify-between border-t border-slate-800/80 pt-2.5 px-1">
                <span style={sFooter ? { fontSize: sFooter } : undefined}>{formatDateLongBR(activeDate)}</span>
                <span className="text-[10px] font-black uppercase" style={{ color: accent, fontSize: sFooter || undefined }}>
                  Slide {slideNumberDisplay} de {totalSlidesDisplay} • Avisos & Alinhamentos
                </span>
              </div>
            </RegionBox>
          </div>
        );
      }

      case 'dicas': {
        // SLIDE: DICAS RÁPIDAS PARA A OPERAÇÃO
        const cfg = getSimpleSlide('dicas') || DEFAULT_SIMPLE_SLIDES.dicas;
        const accent = cfg.accent || '#a78bfa';
        return (
          <div
            className="relative aspect-video rounded-3xl overflow-hidden border border-slate-800 shadow-xl bg-slate-950 text-white my-auto mx-auto shrink-0 select-none"
            style={{
              aspectRatio: '16 / 9',
              width: 'min(100cqw, calc(100cqh * 16 / 9))',
              height: 'min(100cqh, calc(100cqw * 9 / 16))',
              fontFamily,
              backgroundColor: cfg.bgColor || '#2e1065',
            }}
          >
            {cfg.bgUrl ? (
              <>
                <img src={cfg.bgUrl} alt="" className="absolute inset-0 w-full h-full object-cover z-0" />
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] z-0" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-violet-950/70 z-0" />
            )}

            <RegionBox slideId="dicas" regionId="header" def={SLIDE_REGION_DEFS.dicas.header} fillMode="flex-row" className="z-10">
              <div className="w-full h-full flex items-center justify-between border-b border-slate-800/80 pb-3 px-1">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl text-white flex items-center justify-center font-black shadow-md shrink-0" style={{ backgroundColor: accent }}>
                    <Lightbulb className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide truncate" style={sTitle ? { fontSize: sTitle } : undefined}>
                      {cfg.title}
                    </h3>
                    <p className="text-xs font-bold text-slate-300 truncate" style={sBody ? { fontSize: sBody } : undefined}>
                      {state.teamName} • {cfg.subtitle}
                    </p>
                  </div>
                </div>

                <span
                  className="px-3 py-1 rounded-xl font-black text-xs flex items-center gap-1.5 backdrop-blur-md border shrink-0"
                  style={{ backgroundColor: `${accent}26`, color: accent, borderColor: `${accent}55` }}
                >
                  <Lightbulb className="w-4 h-4" />
                  <span>Dica do Dia</span>
                </span>
              </div>
            </RegionBox>

            {/* Main Content: tips cards grid */}
            <RegionBox slideId="dicas" regionId="content" def={SLIDE_REGION_DEFS.dicas.content} fillMode="flex-col" className="z-10">
              <div className="w-full h-full min-h-0 grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch overflow-y-auto pr-1">
                {cfg.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-900/75 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3.5 flex items-start gap-3 shadow-xs"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}2b`, color: accent }}>
                      <Lightbulb className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider block mb-1" style={{ color: accent }}>
                        Dica {idx + 1}
                      </span>
                      <p className="text-xs font-bold text-slate-100 leading-snug" style={sBody ? { fontSize: sBody } : undefined}>
                        {item}
                      </p>
                    </div>
                  </div>
                ))}
                {cfg.items.length === 0 && (
                  <div className="text-center text-xs text-slate-400 font-bold py-8 col-span-2">
                    Nenhuma dica cadastrada. Adicione dicas no painel lateral.
                  </div>
                )}
              </div>
            </RegionBox>

            {/* Footer */}
            <RegionBox slideId="dicas" regionId="footer" def={SLIDE_REGION_DEFS.dicas.footer} fillMode="flex-row" className="z-10">
              <div className="w-full h-full flex items-center justify-between border-t border-slate-800/80 pt-2.5 px-1">
                <span style={sFooter ? { fontSize: sFooter } : undefined}>{formatDateLongBR(activeDate)}</span>
                <span className="text-[10px] font-black uppercase" style={{ color: accent, fontSize: sFooter || undefined }}>
                  Slide {slideNumberDisplay} de {totalSlidesDisplay} • Dicas Rápidas
                </span>
              </div>
            </RegionBox>
          </div>
        );
      }

      default: {
        const freeSlide = getFreeSlide(slideId);
        if (!freeSlide) return null;
        // SLIDE LIVRE: blank canvas with background + flexible text/image layers
        return (
          <div
            className="relative aspect-video rounded-3xl overflow-hidden border border-[var(--line)] shadow-xl text-white my-auto mx-auto shrink-0 select-none"
            style={{
              aspectRatio: '16 / 9',
              width: 'min(100cqw, calc(100cqh * 16 / 9))',
              height: 'min(100cqh, calc(100cqw * 9 / 16))',
              backgroundColor: freeSlide.bgColor || slideBgColorMap[slideId] || '#0f172a',
              fontFamily,
            }}
          >
            {freeSlide.bgUrl && (
              <>
                <img src={freeSlide.bgUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/45" />
              </>
            )}
          </div>
        );
      }
    }
  };

  const slideTabIcons = {
    cover: Sparkles,
    operational_pdf: FileText,
    process: GraduationCap,
    scale: LayoutGrid,
    qa: HelpCircle,
    avisos: Megaphone,
    dicas: Lightbulb,
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* HEADER & SLIDE SELECTION NAVIGATION */}
      <PageHeader
        icon={LayoutTemplate}
        title="Montador de Slides do Briefing"
        subtitle={`Briefing operacional diário • ${formatDateLongBR(activeDate)} • ${state.teamName || 'Equipe'}`}
        actions={
          <>
            <Button variant="outline" size="sm" icon={Settings2} onClick={() => setIsSlideOrderModalOpen(true)} title="Organizar Slides">
              Organizar Slides
            </Button>
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()} title="Gerar / Imprimir PDF da Escala / Briefing">
              Gerar PDF
            </Button>
            <Button size="sm" icon={Save} disabled={isSavingSlides} onClick={handleManualSaveBriefing} title="Gravar e Salvar manualmente as alterações nos slides">
              {isSavingSlides ? 'Salvando...' : 'Salvar alterações'}
            </Button>
            <Button size="sm" icon={Maximize2} onClick={startPresentation} title="Abrir a apresentação em tela cheia">
              Apresentar em Tela Cheia
            </Button>
          </>
        }
      />

      <div className="print:hidden">
        <Tabs
          className="flex-wrap max-w-full"
          items={slideOrder.map((slide, idx) => ({
            value: slide.id,
            icon: slideTabIcons[slide.id] || FilePlus2,
            label: (
              <span className="inline-flex items-center gap-1.5">
                <span>
                  {idx + 1}. {slide.title || SLIDE_METADATA[slide.id]?.defaultTitle || 'Slide Livre'}
                </span>
                {slide.id === 'operational_pdf' && pdfUrl && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </span>
            ),
            badge:
              slide.id === 'process' && processList.length > 0 ? processList.length : undefined,
          }))}
          value={activeTab}
          onChange={(v) => setActiveTab(v as SlideId)}
        />
      </div>

      <div className="print:hidden lg:grid lg:grid-cols-12 lg:gap-4 lg:items-start">
        {/* LEFT COLUMN: LIVE SLIDE PREVIEW (STICKY) */}
        <div className="lg:col-span-7 space-y-4 lg:sticky lg:top-4">
          {/* ACTIVE SINGLE SLIDE PREVIEW IN CANVAS */}
          <Card padded={false} className="overflow-hidden">
            <div className="p-4 sm:p-5">
              <SectionHeader
                title="Pré-visualização do Slide"
                icon={<Eye className="w-4 h-4" />}
                right={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      size="xs"
                      variant={!isRealSizePreview ? 'primary' : 'outline'}
                      icon={Focus}
                      onClick={() => setIsRealSizePreview(false)}
                      title="Ajustar o slide proporcionalmente à tela"
                    >
                      Fit Proporcional
                    </Button>
                    <Button
                      size="xs"
                      variant={isRealSizePreview ? 'primary' : 'outline'}
                      icon={Maximize2}
                      onClick={() => setIsRealSizePreview(true)}
                      title="Visualizar em tamanho real HD (100% / 1920x1080) para conferência de layout real"
                    >
                      Tamanho Real 1:1
                    </Button>
                    {isRealSizePreview && (
                      <div className="w-36">
                        <Select
                          value={realSizeZoom}
                          onChange={(e) => setRealSizeZoom(Number(e.target.value))}
                          className="text-[11px]"
                        >
                          <option value={50}>Zoom 50%</option>
                          <option value={75}>Zoom 75%</option>
                          <option value={100}>Zoom 100% (Real HD)</option>
                          <option value={125}>Zoom 125%</option>
                        </Select>
                      </div>
                    )}
                    <Button
                      size="xs"
                      variant={editTarget === 'camadas' ? 'primary' : 'outline'}
                      icon={Layers}
                      onClick={() => setEditTarget('camadas')}
                    >
                      Camadas
                    </Button>
                    <Button
                      size="xs"
                      variant={editTarget === 'elementos' ? 'primary' : 'outline'}
                      icon={LayoutTemplate}
                      onClick={() => setEditTarget('elementos')}
                    >
                      Elementos
                    </Button>
                  </div>
                }
              />
            </div>

            <div className="px-4 sm:px-5 pb-5 pt-1 space-y-3">

            {/* PREVIEW CONTAINER: FIT MODE OR REAL SIZE 1:1 STAGE */}
            {isRealSizePreview ? (
              <div className="w-full overflow-auto max-h-[750px] p-4 bg-[var(--surface-2)] rounded-xl border border-[var(--line)] flex justify-center shadow-[var(--shadow-card)]">
                <div
                  className="shrink-0 transition-transform origin-top"
                  style={{
                    width: '1920px',
                    height: '1080px',
                    transform: `scale(${realSizeZoom / 100})`,
                    transformOrigin: 'top center',
                    marginBottom: realSizeZoom > 100 ? `${(realSizeZoom - 100) * 10.8}px` : 0,
                  }}
                >
                  <div className="w-full h-full relative @container">
                    {renderSlideContent(activeTab as SlideId)}
                    <SlideRegionEditor
                      regions={SLIDE_REGION_DEFS[activeTab as SlideId] || {}}
                      layout={getRegionLayout(activeTab as SlideId)}
                      editMode={editTarget === 'elementos'}
                      onChange={(layout) => setRegionLayout(activeTab as SlideId, layout)}
                      selectedId={editRegionId}
                      onSelectRegion={setEditRegionId}
                    />
                    <SlideItemOverlay
                      items={getSlideItems(activeTab as SlideId)}
                      editMode={editTarget === 'camadas'}
                      onChange={(items) => setSlideItems(activeTab as SlideId, items)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative group rounded-xl flex items-center justify-center bg-[var(--surface-2)] border border-[var(--line)] p-1 shadow-[var(--shadow-card)] w-full @container">
                <div className="w-full h-full flex items-center justify-center @container relative">
                  {renderSlideContent(activeTab as SlideId)}
                  <SlideRegionEditor
                    regions={SLIDE_REGION_DEFS[activeTab as SlideId] || {}}
                    layout={getRegionLayout(activeTab as SlideId)}
                    editMode={editTarget === 'elementos'}
                    onChange={(layout) => setRegionLayout(activeTab as SlideId, layout)}
                    selectedId={editRegionId}
                    onSelectRegion={setEditRegionId}
                  />
                  <SlideItemOverlay
                    items={getSlideItems(activeTab as SlideId)}
                    editMode={editTarget === 'camadas'}
                    onChange={(items) => setSlideItems(activeTab as SlideId, items)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ELEMENT INSPECTOR TOOLBARS (outside the slide frame) */}
          {editTarget === 'elementos' && (
            <div className="w-full space-y-2">
              <div className="flex flex-wrap items-center gap-2.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl px-3 py-2.5">
                <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">
                  Elementos
                </span>
                <label className="flex items-center gap-1.5 text-[10px] font-black text-[var(--ink)] uppercase tracking-wider">
                  <PaintBucket className="w-3.5 h-3.5 text-sky-500" />
                  Fundo
                  <input
                    type="color"
                    value={slideBgColorMap[activeTab as SlideId] ?? '#0f172a'}
                    onChange={(e) => setSlideBgColor(activeTab as SlideId, e.target.value)}
                    className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border border-[var(--line)]"
                  />
                </label>
                {(Object.keys(getRegionLayout(activeTab as SlideId)).length > 0 || !!slideBgColorMap[activeTab as SlideId]) && (
                  <Button
                    size="xs"
                    variant="danger"
                    icon={RotateCcw}
                    onClick={() => {
                      setRegionLayout(activeTab as SlideId, {});
                      setSlideBgColor(activeTab as SlideId, undefined);
                    }}
                    title="Redefinir posições, tamanhos e cor de fundo para o padrão do slide"
                  >
                    Redefinir Padrão
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl px-3 py-2.5">
                {editRegionId ? (
                  <>
                    <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">
                      Elemento: <span className="text-sky-500">{(SLIDE_REGION_DEFS[activeTab as SlideId]?.[editRegionId] as { label?: string } | undefined)?.label || editRegionId}</span>
                    </span>
                    <Button
                      size="xs"
                      variant="outline"
                      icon={RotateCcw}
                      onClick={() => {
                        const layout = getRegionLayout(activeTab as SlideId);
                        const rest = { ...layout };
                        delete rest[editRegionId];
                        setRegionLayout(activeTab as SlideId, rest);
                      }}
                    >
                      Padrão
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      icon={Eye}
                      onClick={() => {
                        const layout = getRegionLayout(activeTab as SlideId);
                        setRegionLayout(activeTab as SlideId, { ...layout, [editRegionId]: { ...(layout[editRegionId] || {}), hidden: false } });
                      }}
                    >
                      Mostrar
                    </Button>
                  </>
                ) : (
                  <span className="text-[10px] font-black text-[var(--muted)]">
                    Clique ou arraste um elemento no slide para editar posição/tamanho.
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>

          {/* FREE SLIDE SETTINGS PANEL (only for free slides) */}
          {freeSlideActive && (
            <Card>
              <CardHeader
                icon={<Pencil className="w-4 h-4 text-sky-500" />}
                title="Configurar Slide Livre"
              />
              <CardBody className="mt-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Título do Slide">
                    <Input
                      value={freeSlideActive.title}
                      onChange={(e) => updateFreeSlide(freeSlideActive.id, { title: e.target.value })}
                      placeholder="Título do slide livre"
                    />
                  </Field>
                  <Field label="Cor de Fundo">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={freeSlideActive.bgColor || '#111827'}
                        onChange={(e) => updateFreeSlide(freeSlideActive.id, { bgColor: e.target.value })}
                        className="w-10 h-9 rounded-lg border border-[var(--line)] bg-transparent cursor-pointer"
                      />
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['#111827', '#1e293b', '#7c2d12', '#14532d', '#1e3a8a', '#4c1d95'].map((c) => (
                          <button
                            key={c}
                            onClick={() => updateFreeSlide(freeSlideActive.id, { bgColor: c })}
                            className="w-6 h-6 rounded-lg border border-white/20 cursor-pointer transition-transform hover:scale-110"
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  </Field>
                </div>

                <Field label="Imagem de Fundo">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFreeSlideBgUpload(f);
                        e.target.value = '';
                      }}
                      className="hidden"
                      id="free-slide-bg-upload"
                    />
                    <label
                      htmlFor="free-slide-bg-upload"
                      className="px-3 py-2 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Enviar Imagem
                    </label>
                    <div className="flex-1 min-w-0">
                      <Input
                        value={freeSlideActive.bgUrl?.startsWith('data:') ? '' : freeSlideActive.bgUrl || ''}
                        onChange={(e) => updateFreeSlide(freeSlideActive.id, { bgUrl: e.target.value })}
                        placeholder="ou cole a URL de uma imagem de fundo..."
                      />
                    </div>
                    {freeSlideActive.bgUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Trash2}
                        onClick={() => updateFreeSlide(freeSlideActive.id, { bgUrl: '' })}
                        title="Remover imagem de fundo"
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_FREE_SLIDE_IMAGES.map((preset) => (
                      <button
                        key={preset.url}
                        onClick={() => updateFreeSlide(freeSlideActive.id, { bgUrl: preset.url })}
                        className={`relative w-20 h-12 rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:scale-105 ${
                          freeSlideActive.bgUrl === preset.url ? 'border-sky-500' : 'border-transparent'
                        }`}
                        title={preset.name}
                      >
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[8px] font-bold px-1 py-0.5 text-center leading-tight">
                          {preset.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>

                <SlideTypographyControls
                  value={getSlideTypo(freeSlideActive.id as SlideId)}
                  onChange={(p) => updateSlideTypo(freeSlideActive.id as SlideId, p)}
                />
              </CardBody>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: ACTIVE TAB CONTROLS */}
        <div className="lg:col-span-5 space-y-4">
          {/* ACTIVE TAB CONFIGURATION & CONTROLS PANEL */}

      {/* TAB 1: COVER CONTROLS */}
      {activeTab === 'cover' && (
        <Card>
          <CardHeader
            icon={<Sparkles className="w-4 h-4 text-emerald-500" />}
            title="Personalizar Slide 1: Capa da Apresentação"
            subtitle="Visualização ao Vivo"
          />
          <CardBody className="mt-4 space-y-4">
            {/* Visibility Toggles for All Elements */}
            <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-xl p-3 space-y-2.5">
              <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-emerald-500" />
                Visibilidade dos Elementos (Todos Opcionais)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Toggle checked={!briefingCfg.coverHideHeader} onChange={(v) => updateBriefingConfig({ coverHideHeader: !v })} label="Cabeçalho Topo" />
                <Toggle checked={!briefingCfg.coverHideLogo} onChange={(v) => updateBriefingConfig({ coverHideLogo: !v })} label="Ícone/Logo" />
                <Toggle checked={!briefingCfg.coverHideTeamName} onChange={(v) => updateBriefingConfig({ coverHideTeamName: !v })} label="Nome da Equipe" />
                <Toggle checked={!briefingCfg.coverHideSectorShift} onChange={(v) => updateBriefingConfig({ coverHideSectorShift: !v })} label="Setor / Turno" />
                <Toggle checked={!briefingCfg.coverHideDateBadge} onChange={(v) => updateBriefingConfig({ coverHideDateBadge: !v })} label="Selo de Data" />
                <Toggle checked={!briefingCfg.coverHideCategoryBadge} onChange={(v) => updateBriefingConfig({ coverHideCategoryBadge: !v })} label="Tag Categoria" />
                <Toggle checked={!briefingCfg.coverHideMainTitle} onChange={(v) => updateBriefingConfig({ coverHideMainTitle: !v })} label="Título Principal" />
                <Toggle checked={showQuote} onChange={(v) => updateBriefingConfig({ showQuote: v, coverHideQuote: !v })} label="Frase Motivacional" />
                <Toggle checked={!briefingCfg.coverHideFooter} onChange={(v) => updateBriefingConfig({ coverHideFooter: !v })} label="Barra do Rodapé" />
                <Toggle checked={!briefingCfg.coverHidePresentStats} onChange={(v) => updateBriefingConfig({ coverHidePresentStats: !v })} label="Total Presentes" />
                <Toggle checked={!briefingCfg.coverHideManagerStat} onChange={(v) => updateBriefingConfig({ coverHideManagerStat: !v })} label="Nome do Gestor" />
              </div>
            </div>

            {/* Background & Overlay */}
            <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-xl p-3 space-y-3">
              <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                Imagem & Escurecimento de Fundo
              </span>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-[var(--muted)]">Cor:</span>
                  <input
                    type="color"
                    value={coverBgColor || '#0f172a'}
                    onChange={(e) => updateBriefingConfig({ coverBgColor: e.target.value })}
                    className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border border-[var(--line)]"
                  />
                </div>

                <div className="flex-1 min-w-[200px] flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-[var(--muted)] whitespace-nowrap">
                    Filtro Escuro: {Math.round(coverBgOverlayOpacity * 100)}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={coverBgOverlayOpacity}
                    onChange={(e) => updateBriefingConfig({ coverBgOverlayOpacity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-[var(--line)] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {PRESET_COVER_IMAGES.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => updateBriefingConfig({ coverBgUrl: preset.url })}
                    className={`relative rounded-lg overflow-hidden h-14 border-2 transition-all cursor-pointer ${
                      coverBgUrl === preset.url
                        ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                        : 'border-[var(--line)] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[8px] font-bold p-0.5 truncate text-center">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 bg-[var(--paper)] hover:bg-[var(--surface-3)] border border-[var(--line)] rounded-lg text-[11px] font-bold text-[var(--ink)] flex items-center gap-1.5 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{isUploadingCover ? 'Carregando...' : 'Fazer Upload de Foto'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Cover Text Inputs */}
            <Field label="Tag Categoria / Eyebrow">
              <Input
                type="text"
                value={coverTitle}
                onChange={(e) => updateBriefingConfig({ coverTitle: e.target.value })}
                placeholder="Briefing Diário Operacional"
              />
            </Field>

            <Field label="Título Principal / Manchete">
              <Input
                type="text"
                value={coverSubtitle}
                onChange={(e) => updateBriefingConfig({ coverSubtitle: e.target.value })}
                placeholder="Alinhamento de Turno & Informativo Diário"
              />
            </Field>

            <Field label="Nome da Equipe na Capa">
              <Input
                type="text"
                value={coverTeamName}
                onChange={(e) => updateBriefingConfig({ coverTeamName: e.target.value })}
                placeholder={state.teamName || 'OPERAÇÃO LOGÍSTICA'}
              />
            </Field>

            {/* Motivational Quote Config */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                  Frase Motivacional do Dia
                </span>
                <Button size="xs" variant="secondary" icon={RefreshCw} onClick={handleRandomQuote}>
                  Gerar Outra Frase
                </Button>
              </div>

              <Textarea
                rows={2}
                value={motivationalQuote}
                onChange={(e) => updateBriefingConfig({ motivationalQuote: e.target.value })}
                placeholder="Digite a mensagem ou orientação para o time hoje..."
              />
            </div>
          </CardBody>

          <CardFooter>
            <SlideTemplatePicker
              templates={SLIDE_TEMPLATES.cover}
              activeUrl={coverBgUrl}
              activeColor={undefined}
              onApply={(tpl) => applySlideTemplate('cover', tpl)}
            />
            <div className="mt-4">
              <SlideTypographyControls value={getSlideTypo('cover')} onChange={(p) => updateSlideTypo('cover', p)} />
            </div>
          </CardFooter>
        </Card>
      )}

      {/* TAB 2: OPERATIONAL PDF CONTROLS */}
      {activeTab === 'operational_pdf' && (
        <Card>
          <CardHeader
            icon={<FileText className="w-4 h-4 text-blue-500" />}
            title={`Configurar Slide ${getSlideNumber('operational_pdf')}: Link do Informativo Operacional (PDF Online)`}
            actions={
              <Button size="xs" variant="outline" icon={HelpCircle} onClick={() => setShowHelpGuide(!showHelpGuide)}>
                {showHelpGuide ? 'Ocultar Ajuda' : 'Como usar links do Google Drive?'}
              </Button>
            }
          />

          {showHelpGuide && (
            <div className="mx-4 mt-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 p-3 rounded-lg text-xs text-blue-950 dark:text-blue-100 space-y-1.5 animate-in fade-in">
              <p className="font-extrabold flex items-center gap-1">
                <Info className="w-4 h-4 text-blue-600" />
                <span>Instruções de Integração de PDFs & Apresentações Google:</span>
              </p>
              <ol className="list-decimal list-inside space-y-1 font-medium text-[11px]">
                <li>
                  No Google Drive, clique com o botão direito no PDF do Informativo e selecione <strong>Compartilhar -&gt; Copiar Link</strong>.
                </li>
                <li>
                  Certifique-se que a permissão de acesso está configurada como <strong>"Qualquer pessoa com o link"</strong>.
                </li>
                <li>
                  Cole o link gerado no campo abaixo. Nossa aplicação converterá o visualizador automaticamente e permitirá navegar entre as páginas!
                </li>
              </ol>
            </div>
          )}

          <CardBody className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
              {/* Input URL */}
              <div className="md:col-span-8 space-y-1.5">
                <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                  <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
                  Link / URL do PDF ou Apresentação Online
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="url"
                    value={pdfUrl}
                    onChange={(e) => updateBriefingConfig({ pdfUrl: e.target.value })}
                    placeholder="Ex: https://drive.google.com/file/d/1ABC123xyz/view?usp=sharing"
                  />
                  {pdfUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      onClick={() => updateBriefingConfig({ pdfUrl: '' })}
                      title="Limpar URL"
                    />
                  )}
                </div>
              </div>

              {/* Page Number Controls */}
              <div className="md:col-span-4 space-y-1.5">
                <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                  Selecionar Página do Dia
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateBriefingConfig({ pdfPageNumber: Math.max(1, pdfPageNumber - 1) })}
                  >
                    -
                  </Button>
                  <div className="w-24">
                    <Input
                      type="number"
                      min={1}
                      max={pdfTotalPages > 0 ? pdfTotalPages : undefined}
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      onBlur={commitPdfPage}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitPdfPage();
                      }}
                      title="Digite o número da página e pressione Enter"
                      className="border-blue-600 text-blue-600 font-black text-center focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <span className="text-[11px] font-black text-[var(--muted)]">
                    {pdfTotalPages > 0 ? `/ ${pdfTotalPages}` : ''}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateBriefingConfig({ pdfPageNumber: pdfPageNumber + 1 })}
                  >
                    +
                  </Button>

                  {/* Quick Page Jump Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {Array.from(
                      { length: Math.min(pdfTotalPages > 0 ? pdfTotalPages : 5, 8) },
                      (_, i) => i + 1
                    ).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => updateBriefingConfig({ pdfPageNumber: pageNum })}
                        className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer border ${
                          pdfPageNumber === pageNum
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-[var(--paper)] text-[var(--muted)] border-[var(--line)]'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Page Framing / Enquadramento no Slide */}
            <div className="pt-2 border-t border-[var(--line)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Focus className="w-3.5 h-3.5 text-blue-500" />
                  Enquadramento da Página no Slide
                </span>
                <Button size="xs" variant="outline" icon={RotateCcw} onClick={resetPdfFraming}>
                  Restaurar Padrão (Conter / Centralizado)
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">
                    Modo de Ajuste
                  </span>
                  <div className="flex items-center gap-1 bg-[var(--paper)] border border-[var(--line)] rounded-lg p-1">
                    {(
                      [
                        { id: 'contain' as const, label: 'Conter' },
                        { id: 'width' as const, label: 'Largura' },
                        { id: 'cover' as const, label: 'Preencher' },
                      ]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => updateBriefingConfig({ pdfFitMode: opt.id })}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-black transition-colors cursor-pointer ${
                          pdfFitMode === opt.id
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-[var(--muted)] hover:bg-[var(--line)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--muted)] font-medium">
                    Conter: página inteira visível • Largura: ocupa a largura • Preencher: cobre todo o slide.
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center justify-between">
                    <span>Zoom</span>
                    <span className="text-blue-600 font-black">{Math.round(pdfZoom * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.05}
                    value={pdfZoom}
                    onChange={(e) => updateBriefingConfig({ pdfZoom: Number(e.target.value) })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <p className="text-[10px] text-[var(--muted)] font-medium">
                    Aproxima a página sem perder qualidade no slide.
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center justify-between">
                    <span>Ajuste Automático</span>
                    <span className="text-emerald-600 font-black">Sempre ativo</span>
                  </span>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2 text-[10px] text-emerald-900 dark:text-emerald-200 font-semibold leading-relaxed">
                    Ao trocar de página, o conteúdo é enquadrado automaticamente no slide. O ajuste escolhido aqui é mantido no Modo Apresentação.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <MoveVertical className="w-3 h-3 text-blue-500" />
                      Posição Vertical
                    </span>
                    <span className="text-blue-600 font-black">{Math.round(pdfPanY * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(pdfPanY * 100)}
                    onChange={(e) => updateBriefingConfig({ pdfPanY: Number(e.target.value) / 100 })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <MoveHorizontal className="w-3 h-3 text-blue-500" />
                      Posição Horizontal
                    </span>
                    <span className="text-blue-600 font-black">{Math.round(pdfPanX * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(pdfPanX * 100)}
                    onChange={(e) => updateBriefingConfig({ pdfPanX: Number(e.target.value) / 100 })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Direct Slide Image Fallback */}
            <div className="pt-2 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold text-[var(--muted)]">
                Alternativa: Prefere enviar uma foto/imagem da folha do informativo direto do computador?
              </span>
              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 bg-[var(--paper)] hover:bg-[var(--surface-3)] border border-[var(--line)] rounded-lg text-[11px] font-bold text-[var(--ink)] flex items-center gap-1.5 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-blue-500" />
                  <span>{isUploadingSlideImage ? 'Carregando...' : 'Upload da Imagem do Slide'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSlideImageUpload}
                    className="hidden"
                  />
                </label>

                {pdfDirectImageUrl && (
                  <Button size="xs" variant="danger" icon={Trash2} onClick={() => updateBriefingConfig({ pdfDirectImageUrl: '' })}>
                    Remover Imagem
                  </Button>
                )}
              </div>
            </div>
          </CardBody>

          <CardFooter>
            <SlideTypographyControls value={getSlideTypo('operational_pdf')} onChange={(p) => updateSlideTypo('operational_pdf', p)} />
          </CardFooter>
        </Card>
      )}

      {/* TAB 3: PROCESS KNOWLEDGE CONTROLS */}
      {activeTab === 'process' && (
        <Card>
          <CardHeader
            icon={<Tag className="w-4 h-4 text-purple-500" />}
            title={`Slide ${getSlideNumber('process')}: Card de Conhecimento do Processo`}
            actions={
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" icon={Plus} onClick={handleOpenAddProcessModal}>
                  Novo Card de Processo
                </Button>
                {currentProcess && (
                  <Button size="sm" variant="outline" icon={Edit3} onClick={() => handleOpenEditProcessModal(currentProcess)}>
                    Editar Card Atual
                  </Button>
                )}
              </div>
            }
          />
          <CardBody className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button size="sm" variant="outline" icon={ChevronLeft} onClick={handlePrevProcess} title="Processo Anterior" />
              <Badge tone="purple" dot>
                Card {activeProcessIndex + 1} de {filteredProcessList.length}
              </Badge>
              <Button size="sm" variant="outline" icon={ChevronRight} onClick={handleNextProcess} title="Próximo Processo" />
              <Button size="sm" variant="outline" icon={Shuffle} onClick={handleRandomProcess}>
                Aleatório
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MultiSelectFilter
                label="Filtrar Categoria do Processo"
                options={processCategoryOptions}
                selectedValues={selectedProcessCategories}
                onChange={setSelectedProcessCategories}
                placeholder="Todas as categorias"
                allLabel="Todas as Categorias"
                icon={<Tag className="w-3 h-3 text-purple-500" />}
              />
              <MultiSelectFilter
                label="Filtrar Tipo do Processo"
                options={processTypeOptions}
                selectedValues={selectedProcessTypes}
                onChange={setSelectedProcessTypes}
                placeholder="Todos os tipos"
                allLabel="Todos os Tipos"
                icon={<Sparkles className="w-3 h-3 text-purple-500" />}
              />
            </div>
          </CardBody>

          <CardFooter>
            <SlideTypographyControls value={getSlideTypo('process')} onChange={(p) => updateSlideTypo('process', p)} />
          </CardFooter>
        </Card>
      )}

      {/* TAB AVISOS: AVISOS & ALINHAMENTOS CONTROLS */}
      {activeTab === 'avisos' && (
        <SimpleSlideControls
          config={getSimpleSlide('avisos') || DEFAULT_SIMPLE_SLIDES.avisos}
          templates={SLIDE_TEMPLATES.avisos}
          icon="megaphone"
          colorClass="text-amber-500"
          accentLabel="Avisos"
          onChange={(p) => updateSimpleSlide('avisos', p)}
          typography={getSlideTypo('avisos')}
          onTypographyChange={(p) => updateSlideTypo('avisos', p)}
        />
      )}

      {/* TAB DICAS: DICAS RÁPIDAS CONTROLS */}
      {activeTab === 'dicas' && (
        <SimpleSlideControls
          config={getSimpleSlide('dicas') || DEFAULT_SIMPLE_SLIDES.dicas}
          templates={SLIDE_TEMPLATES.dicas}
          icon="lightbulb"
          colorClass="text-sky-500"
          accentLabel="Dicas"
          onChange={(p) => updateSimpleSlide('dicas', p)}
          typography={getSlideTypo('dicas')}
          onTypographyChange={(p) => updateSlideTypo('dicas', p)}
        />
      )}

      {/* TAB 4: SCALE SLIDE CONTROLS (MONTADOR DO SLIDE DE ESCALA E DIMENSIONAMENTO) */}
      {activeTab === 'scale' && (
        <Card>
          <CardHeader
            icon={<LayoutGrid className="w-4 h-4 text-[var(--primary)]" />}
            title={`Configurações da Montagem do Slide de Escala (Slide ${getSlideNumber('scale')})`}
            actions={
              <Badge tone="success">
                Alocados: {totalDimensioned} / Presentes: {presentCollaborators.length}
              </Badge>
            }
          />
          <CardBody className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Grouping Mode Toggle */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-extrabold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                  <LayoutGrid className="w-3 h-3 text-[var(--primary)]" />
                  Modo de Agrupamento
                </span>
                <div className="grid grid-cols-2 gap-1 bg-[var(--paper)] border border-[var(--line)] p-1 rounded-lg font-bold">
                  <button
                    onClick={() => setDimensioningViewMode('task_grid')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      dimensioningViewMode === 'task_grid'
                        ? 'bg-[var(--primary)] text-white shadow-xs'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Por Tarefa
                  </button>
                  <button
                    onClick={() => setDimensioningViewMode('meal_slots')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      dimensioningViewMode === 'meal_slots'
                        ? 'bg-[var(--primary)] text-white shadow-xs'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Por {mealTypeLabel === 'almoco' ? 'Almoço' : 'Janta'}
                  </button>
                </div>
              </div>

              {/* Abbreviation Toggle */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-extrabold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                  <Edit3 className="w-3 h-3 text-[var(--primary)]" />
                  Formato dos Nomes
                </span>
                <button
                  onClick={() => setAbbreviateNames(!abbreviateNames)}
                  className={`w-full py-2 px-3 rounded-lg font-black text-xs border cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                    abbreviateNames
                      ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary-border)]'
                      : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)]'
                  }`}
                >
                  <span>{abbreviateNames ? 'Nomes Abreviados' : 'Nomes Completos'}</span>
                </button>
              </div>

              {/* Meal Interval Visibility */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-extrabold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[var(--primary)]" />
                  Exibição de Refeição
                </span>
                <button
                  onClick={() => setShowIntervals(!showIntervals)}
                  className={`w-full py-2 px-3 rounded-lg font-bold text-xs border cursor-pointer transition-colors ${
                    showIntervals
                      ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary-border)] font-black'
                      : 'bg-[var(--paper)] text-[var(--muted)] border-[var(--line)]'
                  }`}
                >
                  {showIntervals ? 'Horários Visíveis' : 'Horários Ocultos'}
                </button>
              </div>

              {/* Daily Report Data Option in PDF */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-extrabold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3 h-3 text-[var(--primary)]" />
                  Relatório do Dia no PDF
                </span>
                <button
                  onClick={() => updateBriefingConfig({ scaleIncludeDailyReport: briefingCfg.scaleIncludeDailyReport === false ? true : false })}
                  className={`w-full py-2 px-3 rounded-lg font-bold text-xs border cursor-pointer transition-colors ${
                    briefingCfg.scaleIncludeDailyReport !== false
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 font-black'
                      : 'bg-[var(--paper)] text-[var(--muted)] border-[var(--line)]'
                  }`}
                >
                  {briefingCfg.scaleIncludeDailyReport !== false ? 'Com Relatório do Dia' : 'Apenas Slide da Escala'}
                </button>
              </div>

              {/* Role Filter */}
              <MultiSelectFilter
                label="Cargo"
                options={roleOptions}
                selectedValues={selectedRoles}
                onChange={setSelectedRoles}
                placeholder="Todos os cargos"
                allLabel="Todos os Cargos"
                icon={<Briefcase className="w-3 h-3 text-[var(--primary)]" />}
              />

              {/* Category Filter */}
              <MultiSelectFilter
                label="Categoria"
                options={categoryOptions}
                selectedValues={selectedCategories}
                onChange={setSelectedCategories}
                placeholder="Todas as categorias"
                allLabel="Todas as Categorias"
                icon={<Tag className="w-3 h-3 text-[var(--primary)]" />}
              />

              {/* Team Filter */}
              <MultiSelectFilter
                label="Time / TL"
                options={tlOptions}
                selectedValues={selectedTLs}
                onChange={setSelectedTLs}
                placeholder="Todos os times"
                allLabel="Todos os Times"
                icon={<Users className="w-3 h-3 text-[var(--primary)]" />}
              />
            </div>

            {/* Export PDF Button Section */}
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-3 gap-2">
              <p className="text-[11px] font-bold text-[var(--muted)]">
                Gere um arquivo PDF de alta definição com o slide de escala e os dados do relatório operacional.
              </p>
              <Button variant="secondary" icon={Printer} onClick={() => window.print()} className="shrink-0">
                Gerar PDF da Escala
              </Button>
            </div>

            {/* Text & Font customization for Scale slide header/footer */}
            <div className="border-t border-[var(--line)] pt-3 space-y-3">
              <h5 className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-[var(--primary)]" />
                Texto e Fontes do Cabeçalho / Rodapé
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <Field label="Título do Cabeçalho">
                  <Input
                    type="text"
                    value={scaleTitle}
                    onChange={(e) => updateBriefingConfig({ scaleTitle: e.target.value })}
                    placeholder="4. Escala e Dimensionamento de Tarefas"
                  />
                </Field>
                <Field label="Subtítulo do Cabeçalho">
                  <Input
                    type="text"
                    value={scaleSubtitle}
                    onChange={(e) => updateBriefingConfig({ scaleSubtitle: e.target.value })}
                    placeholder="Auto (Time • Data • Alocados)"
                  />
                </Field>
                <Field label="Rodapé (label à direita)">
                  <Input
                    type="text"
                    value={scaleFooterText}
                    onChange={(e) => updateBriefingConfig({ scaleFooterText: e.target.value })}
                    placeholder="Escala e Dimensionamento"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center justify-between mb-1">
                    <span>Tamanho do Título</span>
                    <span className="text-[var(--primary)]">{scaleTitleSize ?? 18}px</span>
                  </span>
                  <input type="range" min={14} max={34} value={scaleTitleSize ?? 18} onChange={(e) => updateBriefingConfig({ scaleTitleSize: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center justify-between mb-1">
                    <span>Tamanho do Subtítulo</span>
                    <span className="text-[var(--primary)]">{scaleSubtitleSize ?? 12}px</span>
                  </span>
                  <input type="range" min={10} max={22} value={scaleSubtitleSize ?? 12} onChange={(e) => updateBriefingConfig({ scaleSubtitleSize: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center justify-between mb-1">
                    <span>Tamanho do Rodapé</span>
                    <span className="text-[var(--primary)]">{scaleFooterSize ?? 10}px</span>
                  </span>
                  <input type="range" min={9} max={20} value={scaleFooterSize ?? 10} onChange={(e) => updateBriefingConfig({ scaleFooterSize: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
                </div>
              </div>
            </div>

            {/* Blocks: name sizes, task header style, card padding, grid columns */}
            <div className="border-t border-[var(--line)] pt-3 space-y-3">
              <h5 className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5 text-[var(--primary)]" />
                Blocos, Nomes e Cards de Tarefa
              </h5>

              {/* Configurable name text sizes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1">
                      <Type className="w-3 h-3 text-[var(--primary)]" /> Tamanho do Nome da Tarefa
                    </span>
                    <span className="text-[var(--primary)]">{briefingCfg.scaleTaskNameSize ?? 10}px</span>
                  </span>
                  <input
                    type="range"
                    min={7}
                    max={22}
                    step={0.5}
                    value={briefingCfg.scaleTaskNameSize ?? 10}
                    onChange={(e) => updateBriefingConfig({ scaleTaskNameSize: Number(e.target.value) })}
                    className="w-full accent-[var(--primary)]"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1">
                      <Type className="w-3 h-3 text-[var(--primary)]" /> Tamanho do Nome do Colaborador
                    </span>
                    <span className="text-[var(--primary)]">{briefingCfg.scaleCollaboratorNameSize ?? 9}px</span>
                  </span>
                  <input
                    type="range"
                    min={6}
                    max={18}
                    step={0.5}
                    value={briefingCfg.scaleCollaboratorNameSize ?? 9}
                    onChange={(e) => updateBriefingConfig({ scaleCollaboratorNameSize: Number(e.target.value) })}
                    className="w-full accent-[var(--primary)]"
                  />
                </div>
              </div>

              {/* Task header style (banner/subtle/minimal) */}
              <div>
                <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <LayoutGrid className="w-3 h-3 text-[var(--primary)]" />
                  Cabeçalho do Bloco (fundo dos nomes de tarefa)
                </span>
                <div className="grid grid-cols-3 gap-1 bg-[var(--paper)] border border-[var(--line)] p-1 rounded-lg font-bold">
                  {(['banner', 'subtle', 'minimal'] as const).map((s) => {
                    const active = (briefingCfg.scaleHeaderStyle || 'banner') === s;
                    return (
                      <button
                        key={s}
                        onClick={() => updateBriefingConfig({ scaleHeaderStyle: s })}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                          active ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {s === 'banner' ? 'Banner' : s === 'subtle' ? 'Suave' : 'Minimalista'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Header background color (banner) */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                  <Palette className="w-3 h-3 text-[var(--primary)]" />
                  Cor de Fundo do Banner
                </span>
                <input
                  type="color"
                  value={briefingCfg.scaleHeaderBgColor || '#334155'}
                  onChange={(e) => updateBriefingConfig({ scaleHeaderBgColor: e.target.value })}
                  className="w-9 h-8 rounded-lg border border-[var(--line)] cursor-pointer bg-transparent p-0.5"
                  title="Cor de fundo do cabeçalho em destaque"
                />
                {briefingCfg.scaleHeaderBgColor && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => updateBriefingConfig({ scaleHeaderBgColor: undefined })}
                  >
                    Auto (cor do tema)
                  </Button>
                )}
              </div>

              {/* Card padding */}
              <div>
                <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <MoveVertical className="w-3 h-3 text-[var(--primary)]" />
                  Preenchimento dos Cards
                </span>
                <div className="grid grid-cols-3 gap-1 bg-[var(--paper)] border border-[var(--line)] p-1 rounded-lg font-bold">
                  {(['compact', 'normal', 'spacious'] as const).map((p) => {
                    const active = (briefingCfg.scaleCardPadding || 'normal') === p;
                    return (
                      <button
                        key={p}
                        onClick={() => updateBriefingConfig({ scaleCardPadding: p })}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                          active ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {p === 'compact' ? 'Compacto' : p === 'normal' ? 'Normal' : 'Espaçoso'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grid columns */}
              <div>
                <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <LayoutGrid className="w-3 h-3 text-[var(--primary)]" />
                  Colunas da Grade
                </span>
                <div className="grid grid-cols-5 gap-1 bg-[var(--paper)] border border-[var(--line)] p-1 rounded-lg font-bold">
                  {(['auto', 2, 3, 4, 5] as const).map((g) => {
                    const active = (briefingCfg.scaleGridCols || 'auto') === g;
                    return (
                      <button
                        key={String(g)}
                        onClick={() => updateBriefingConfig({ scaleGridCols: g })}
                        className={`py-1.5 px-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                          active ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {g === 'auto' ? 'Auto' : g}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card ordering (move task cards in the slide) */}
            <div className="border-t border-[var(--line)] pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                  <MoveVertical className="w-3.5 h-3.5 text-[var(--primary)]" />
                  Mover os Cards (ordem no slide)
                </h5>
                <Button size="xs" variant="outline" icon={RotateCcw} onClick={handleResetTaskOrder} title="Restaurar a ordem padrão das tarefas">
                  Restaurar ordem
                </Button>
              </div>
              <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                {orderedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg px-2.5 py-1.5"
                  >
                    <GripVertical className="w-3.5 h-3.5 text-[var(--muted)] shrink-0 cursor-grab" />
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-extrabold text-[var(--ink)] truncate">{t.name}</span>
                      <span className="block text-[9.5px] font-semibold text-[var(--muted)]">{t.taskMembers.length} alocado(s)</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleMoveTaskOrder(t.id, 'up')}
                        disabled={t.id === orderedTasks[0]?.id}
                        className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="Mover para cima"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveTaskOrder(t.id, 'down')}
                        disabled={t.id === orderedTasks[orderedTasks.length - 1]?.id}
                        className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="Mover para baixo"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {orderedTasks.length === 0 && (
                  <p className="text-[11px] font-semibold text-[var(--muted)] italic">
                    Nenhuma tarefa dimensionada para reordenar.
                  </p>
                )}
              </div>
            </div>
          </CardBody>

          <CardFooter>
            <SlideTypographyControls value={getSlideTypo('scale')} onChange={(p) => updateSlideTypo('scale', p)} />
          </CardFooter>
        </Card>
      )}

      {/* TAB 5: Q&A / PERGUNTAS & SLIDE 5 FULL CONFIGURATION */}
      {activeTab === 'qa' && (
        <Card>
          <CardHeader
            icon={<HelpCircle className="w-4 h-4 text-purple-600" />}
            title={`Configuração Total do Slide ${getSlideNumber('qa')} (Dúvidas & Alinhamentos)`}
            actions={<Badge tone="purple">{qaQuestions.length} perguntas ativas</Badge>}
          />
          <CardBody className="mt-4 space-y-4">
            {/* Title, Subtitle, Description Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Field label="Título do Slide">
                <Input
                  type="text"
                  value={qaTitle}
                  onChange={(e) => updateBriefingConfig({ qaTitle: e.target.value })}
                  placeholder="Ex: 5. Seção de Perguntas, Dúvidas e Alinhamentos"
                />
              </Field>
              <Field label="Subtítulo do Slide">
                <Input
                  type="text"
                  value={qaSubtitle}
                  onChange={(e) => updateBriefingConfig({ qaSubtitle: e.target.value })}
                  placeholder="Ex: Espaço aberto para dúvidas da equipe e avisos da liderança"
                />
              </Field>
            </div>

            <Field label="Orientação / Texto Introdutório">
              <Textarea
                rows={2}
                value={qaDescription}
                onChange={(e) => updateBriefingConfig({ qaDescription: e.target.value })}
                placeholder="Ex: Aproveite este momento para alinhar prioridades do turno, esclarecer procedimentos..."
              />
            </Field>

            {/* Background Image Selection for Slide 5 */}
            <div className="space-y-2 border-t border-b border-[var(--line)] py-3">
              <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider block flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-purple-600">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Imagem de Fundo do Slide 5
                </span>
                {(qaBgUrl || qaDirectImageUrl) && (
                  <button
                    onClick={() => updateBriefingConfig({ qaBgUrl: '', qaDirectImageUrl: '' })}
                    className="text-rose-500 hover:underline cursor-pointer text-[10px] font-extrabold"
                  >
                    Remover Imagem de Fundo
                  </button>
                )}
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PRESET_QA_IMAGES.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => updateBriefingConfig({ qaBgUrl: preset.url, qaDirectImageUrl: '' })}
                    className={`relative rounded-lg overflow-hidden h-14 border-2 cursor-pointer transition-all ${
                      qaBgUrl === preset.url && !qaDirectImageUrl
                        ? 'border-purple-600 ring-2 ring-purple-400/40 scale-[1.02]'
                        : 'border-[var(--line)] hover:border-purple-300'
                    }`}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-1 text-center">
                      <span className="text-[9px] font-black text-white leading-tight drop-shadow-md">
                        {preset.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom URL or Upload File for Slide 5 */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <div className="relative flex-1 w-full">
                  <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--muted)]" />
                  <input
                    type="url"
                    value={qaDirectImageUrl}
                    onChange={(e) => updateBriefingConfig({ qaDirectImageUrl: e.target.value })}
                    placeholder="Ou cole o link direto de uma imagem de fundo (https://...)"
                    className="w-full pl-8 pr-3 py-1.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs font-bold text-[var(--ink)] focus:border-purple-600"
                  />
                </div>

                <label className="w-full sm:w-auto px-3 py-1.5 bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200 hover:bg-purple-200 border border-purple-300 dark:border-purple-800 rounded-lg font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingQaBg ? 'Enviando...' : 'Carregar do PC'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setIsUploadingQaBg(true);
                        const compressed = await compressImageFile(file, 1600);
                        updateBriefingConfig({ qaDirectImageUrl: compressed, qaBgUrl: '' });
                        showNotice('Imagem de fundo do Slide 5 atualizada com sucesso!');
                      } catch (err) {
                        showNotice('Erro ao processar imagem.');
                      } finally {
                        setIsUploadingQaBg(false);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Safety, Quality & Support Text Customization */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <Field label="Card de Segurança">
                <Textarea
                  rows={2}
                  value={qaSafetyText}
                  onChange={(e) => updateBriefingConfig({ qaSafetyText: e.target.value })}
                  placeholder="Texto de segurança..."
                />
              </Field>
              <Field label="Card de Qualidade">
                <Textarea
                  rows={2}
                  value={qaQualityText}
                  onChange={(e) => updateBriefingConfig({ qaQualityText: e.target.value })}
                  placeholder="Texto de qualidade..."
                />
              </Field>
              <Field label="Card de Suporte Liderança">
                <Textarea
                  rows={2}
                  value={qaSupportText}
                  onChange={(e) => updateBriefingConfig({ qaSupportText: e.target.value })}
                  placeholder="Texto de suporte..."
                />
              </Field>
            </div>

            {/* Q&A Questions Manager */}
            <div className="space-y-3 border-t border-[var(--line)] pt-3">
              <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider block flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Gerenciar Perguntas do Slide 5
              </span>

              {/* Add New Question Input */}
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={newQaInput}
                  onChange={(e) => setNewQaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newQaInput.trim()) {
                      const updated = [...qaQuestions, newQaInput.trim()];
                      setQaQuestions(updated);
                      updateBriefingConfig({ qaQuestions: updated });
                      setNewQaInput('');
                      showNotice('Nova pergunta adicionada ao Slide 5!');
                    }
                  }}
                  placeholder="Digite uma nova pergunta para a equipe (pressione Enter ou clique em Adicionar)..."
                />
                <Button
                  variant="secondary"
                  icon={Plus}
                  className="shrink-0"
                  onClick={() => {
                    if (!newQaInput.trim()) return;
                    const updated = [...qaQuestions, newQaInput.trim()];
                    setQaQuestions(updated);
                    updateBriefingConfig({ qaQuestions: updated });
                    setNewQaInput('');
                    showNotice('Nova pergunta adicionada ao Slide 5!');
                  }}
                >
                  Adicionar
                </Button>
              </div>

              {/* List of active Q&A Questions */}
              <div className="space-y-1.5">
                {qaQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs font-bold text-[var(--ink)]"
                  >
                    <span className="flex items-center gap-2 truncate pr-2">
                      <span className="w-5 h-5 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 font-black text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{q}</span>
                    </span>
                    <button
                      onClick={() => {
                        const updated = qaQuestions.filter((_, i) => i !== idx);
                        setQaQuestions(updated);
                        updateBriefingConfig({ qaQuestions: updated });
                        showNotice('Pergunta removida.');
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
                      title="Excluir Pergunta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>

          <CardFooter>
            <SlideTemplatePicker
              templates={SLIDE_TEMPLATES.qa}
              activeUrl={qaBgUrl}
              activeColor={undefined}
              onApply={(tpl) => applySlideTemplate('qa', tpl)}
            />
            <div className="mt-4">
              <SlideTypographyControls value={getSlideTypo('qa')} onChange={(p) => updateSlideTypo('qa', p)} />
            </div>
          </CardFooter>
        </Card>
      )}

        </div>
      </div>

      {/* FULL PRESENTATION INTERACTIVE MODAL (MODO TV / APRESENTAÇÃO PURO SLIDE) */}
      <AnimatePresence>
        {isPresentationMode && (
          <motion.div
            ref={presentationContainerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950 text-white w-screen h-screen overflow-hidden select-none"
          >
            {/* Slide Stage Container - True 100% Screen Presentation Mode */}
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden">
              <div
                onClick={toggleFullscreen}
                className="cursor-pointer relative w-full h-full flex items-center justify-center bg-slate-950"
                style={{ containerType: 'size' }}
                title="Clique no slide para alternar Modo Tela Cheia"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={presentationSlideId}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-full flex items-center justify-center relative"
                    style={{ containerType: 'size' }}
                  >
                    {renderSlideContent(presentationSlideId)}
                    <SlideItemOverlay items={getSlideItems(presentationSlideId)} />
                  </motion.div>
                </AnimatePresence>

                {/* Hover Prompt Badge */}
                <div
                  className={`absolute top-16 right-4 z-20 transition-opacity bg-slate-900/90 backdrop-blur-md text-emerald-400 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg pointer-events-none ${
                    presentationControlsVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Clique para Alternar Tela Cheia</span>
                </div>
              </div>
            </div>

            {/* Top Bar Navigation Controls (Floating Overlay - Auto-fading in pure slide mode) */}
            <div
              className={`absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 bg-gradient-to-b from-slate-950/95 via-slate-950/70 to-transparent flex items-center justify-between transition-all duration-300 ${
                presentationControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md">
                  <Play className="w-4 h-4 fill-slate-950" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider drop-shadow-sm">
                    Modo Apresentação de Slides
                  </h3>
                  <p className="text-[10px] text-slate-300 font-bold drop-shadow-sm">
                    Use as setas (← / →) do teclado para navegar • Tecla F para Tela Cheia • Esc para Sair
                  </p>
                </div>
              </div>

              {/* Slide Indicator Tabs & Pure Projector Toggle */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-md scrollbar-none shadow-lg">
                  {effectiveActiveSlides.map((slide, idx) => {
                    const meta = SLIDE_METADATA[slide.id];
                    const isActive = presentationSlideId === slide.id;
                    return (
                      <button
                        key={slide.id}
                        onClick={() => setPresentationSlideId(slide.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer whitespace-nowrap transition-colors ${
                          isActive ? 'bg-emerald-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {idx + 1}. {slide.title || meta?.defaultTitle || 'Slide Livre'}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={toggleFullscreen}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer border border-emerald-400/40 transition-colors shadow-lg"
                  title={isFullscreen ? 'Sair da Tela Cheia' : 'Entrar em Tela Cheia'}
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{isFullscreen ? 'Sair da Tela Cheia' : 'Apresentar em Tela Cheia'}</span>
                </button>

                <button
                  onClick={exitPresentation}
                  className="px-3 py-1.5 bg-rose-950/90 hover:bg-rose-900 text-rose-200 border border-rose-800/80 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-colors shadow-lg"
                >
                  <X className="w-4 h-4" />
                  <span>Sair (Esc)</span>
                </button>
              </div>
            </div>

            {/* Bottom Navigation Buttons (Floating Overlay - Auto-fading in pure slide mode) */}
            <div
              className={`absolute bottom-0 left-0 right-0 z-30 p-3 sm:p-4 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent flex items-center justify-between transition-all duration-300 ${
                presentationControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              <button
                disabled={currentPresentationIndex <= 0}
                onClick={handlePrevSlide}
                className="px-5 py-2 bg-slate-900/90 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-colors shadow-lg"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Slide Anterior</span>
              </button>

              <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800 shadow-lg">
                {effectiveActiveSlides.map((slide) => (
                  <button
                    key={slide.id}
                    onClick={() => setPresentationSlideId(slide.id)}
                    title={slide.title || SLIDE_METADATA[slide.id]?.defaultTitle || 'Slide Livre'}
                    className={`w-3 h-3 rounded-full transition-all cursor-pointer ${
                      presentationSlideId === slide.id ? 'bg-emerald-400 scale-125' : 'bg-slate-700 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>

              <button
                disabled={currentPresentationIndex >= effectiveActiveSlides.length - 1}
                onClick={handleNextSlide}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-colors shadow-lg"
              >
                <span>Próximo Slide</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OFFSCREEN CONTAINER FOR HIGH-RES 1080P PDF EXPORT */}
      <div
        id="briefing-pdf-export-container"
        className="fixed top-[-9999px] left-[-9999px] w-[1920px] h-auto pointer-events-none opacity-100 z-[-1] space-y-10"
        style={{
          backgroundColor: 'var(--bg)',
          color: 'var(--ink)',
        }}
      >
        {effectiveActiveSlides.map((slide) => (
          <div
            key={slide.id}
            className="pdf-slide-export w-[1920px] h-[1080px] relative @container"
            style={{
              backgroundColor: 'var(--bg)',
              color: 'var(--ink)',
            }}
          >
            {renderSlideContent(slide.id)}
            <SlideItemOverlay items={getSlideItems(slide.id)} />
          </div>
        ))}
      </div>

      {/* PROCESS KNOWLEDGE MANAGEMENT MODAL */}
      <Modal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        size="lg"
        icon={<GraduationCap className="w-5 h-5 text-purple-600" />}
        title={editingProcessId ? 'Editar Card de Processo' : 'Cadastrar Novo Card de Processo'}
        footer={
          <>
            {editingProcessId && (
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => {
                  if (confirm('Deseja excluir este card de processo?')) {
                    deleteProcessKnowledge(editingProcessId);
                    setIsManageModalOpen(false);
                  }
                }}
              >
                Excluir Card
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsManageModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="secondary" icon={Save} onClick={handleSaveProcess}>
              Salvar Card
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <Field label="Título do Processo / Procedimento">
            <Input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Ex: Padrão de Bipagem & Conferência de Volumes"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Tipo de Conteúdo">
              <Select
                value={typeInput}
                onChange={(e) => setTypeInput(e.target.value as ProcessType)}
              >
                <option value="explicacao">Explicação do Processo</option>
                <option value="procedimento">Procedimento Padrão (SOP)</option>
                <option value="seguranca">Segurança do Trabalho</option>
                <option value="qualidade">Conformidade & Qualidade</option>
                <option value="caracteristica">Característica do Processo</option>
                <option value="curiosidade">Curiosidade Operacional</option>
              </Select>
            </Field>

            <Field label="Setor / Categoria">
              <Input
                type="text"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                placeholder="Ex: Recebimento, Expedição, ICQA"
              />
            </Field>
          </div>

          <Field label="Descrição Detalhada do Processo">
            <Textarea
              rows={3}
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              placeholder="Explique detalhadamente a regra do processo, orientação ou instrução operacional..."
            />
          </Field>

          <Field label="Pontos-Chave / Regras de Ouro (Um por linha)">
            <Textarea
              rows={3}
              value={keyTakeawaysInput}
              onChange={(e) => setKeyTakeawaysInput(e.target.value)}
              placeholder="Sempre valide a etiqueta antes de fechar a caixa&#10;Mantenha a postura ereta na paletização&#10;Comunique o time em caso de divergência"
            />
          </Field>

          <Field label="URL da Imagem Ilustrativa (Opcional)">
            <Input
              type="url"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              placeholder="https://..."
            />
          </Field>
        </div>
      </Modal>

      {/* MODAL PARA ORGANIZAR E HABILITAR/DESATIVAR SLIDES */}
      <Modal
        isOpen={isSlideOrderModalOpen}
        onClose={() => setIsSlideOrderModalOpen(false)}
        icon={<Settings2 className="w-5 h-5" />}
        title="Organizar & Ativar/Desativar Slides"
        subtitle="Defina a ordem e escolha quais slides serão exibidos."
        footer={
          <>
            <Button variant="outline" icon={RotateCcw} onClick={handleResetSlideOrder}>
              Restaurar Padrão
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleManualSaveBriefing}
                disabled={isSavingSlides}
                title="Gravar e sincronizar as alterações nos slides"
              >
                <Save className={`w-4 h-4 ${isSavingSlides ? 'animate-spin' : ''}`} />
                {isSavingSlides ? 'Salvando...' : 'Salvar alterações'}
              </Button>
              <Button variant="primary" icon={Check} onClick={() => setIsSlideOrderModalOpen(false)}>
                Concluir
              </Button>
            </div>
          </>
        }
      >
        {/* List of Slides */}
        <div className="space-y-2.5">
          {slideOrder.map((slide, idx) => {
            const meta = SLIDE_METADATA[slide.id];
            const coreSlideIds = new Set(['cover', 'operational_pdf', 'scale']);
            const isCore = coreSlideIds.has(slide.id);
            return (
              <div
                key={slide.id}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  slide.enabled
                    ? 'bg-[var(--surface-2)] border-[var(--line)] shadow-xs'
                    : 'bg-[var(--surface-2)]/50 border-[var(--line)] opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-black text-xs flex items-center justify-center shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-[var(--ink)] truncate">
                      {slide.title || meta?.defaultTitle || 'Slide Livre'}
                    </p>
                    <span className={`text-[10px] font-bold block truncate ${slide.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                      {slide.enabled ? '● Ativo na apresentação' : '○ Ocultado na apresentação'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {/* Remove slide button (only for optional slides) */}
                  {!isCore && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      onClick={() => handleRemoveSlide(slide.id)}
                      title="Remover slide da apresentação"
                    />
                  )}

                  {/* Move Up / Down Buttons */}
                  <div className="flex items-center gap-1 bg-[var(--paper)] p-1 rounded-lg border border-[var(--line)]">
                    <button
                      disabled={idx === 0}
                      onClick={() => handleMoveSlide(idx, 'up')}
                      className="p-1 text-[var(--ink)] hover:bg-[var(--line)] disabled:opacity-20 rounded-lg cursor-pointer"
                      title="Mover para Cima"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={idx === slideOrder.length - 1}
                      onClick={() => handleMoveSlide(idx, 'down')}
                      className="p-1 text-[var(--ink)] hover:bg-[var(--line)] disabled:opacity-20 rounded-lg cursor-pointer"
                      title="Mover para Baixo"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Enable/Disable Toggle */}
                  <button
                    onClick={() => handleToggleSlideEnabled(slide.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer border transition-all ${
                      slide.enabled
                        ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-200'
                    }`}
                  >
                    {slide.enabled ? 'Ativo' : 'Ativar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Adicionar Slide Button */}
        <div className="pt-3 border-t border-[var(--line)] mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-[var(--muted)] uppercase tracking-wider">
              Adicionar Novo Slide
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {OPTIONAL_ADDITIONAL_SLIDES.map((opt) => {
              const alreadyAdded = slideOrder.some((s) => s.id === opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => handleAddSlide(opt.id)}
                  disabled={alreadyAdded}
                  className={`px-3.5 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    alreadyAdded
                      ? 'bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--line)] opacity-50 cursor-not-allowed'
                      : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{opt.title}</span>
                </button>
              );
            })}
            {/* Create a blank/free slide */}
            <button
              onClick={handleCreateFreeSlide}
              className="px-3.5 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>Slide Livre (em branco)</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* PRINT-ONLY CONTAINER FOR PDF GENERATION */}
      <div className="hidden print:block print-container p-4 space-y-6 text-slate-900 bg-white font-sans">
        {/* PAGE 1: SLIDE DE ESCALA & DIMENSIONAMENTO */}
        <div className="w-full aspect-video border border-slate-300 rounded-2xl p-4 bg-white mb-6 page-break-inside-avoid shadow-none @container">
          {renderSlideContent('scale')}
        </div>

        {/* PAGE 2: RELATÓRIO DO DIA (SE CONFIGURADO) */}
        {briefingCfg.scaleIncludeDailyReport !== false && (
          <div className="w-full border border-slate-300 rounded-2xl p-6 bg-white space-y-4 page-break-before-always shadow-none">
            <div className="flex items-center justify-between border-b border-slate-300 pb-3">
              <div>
                <h2 className="text-xl font-black uppercase text-slate-900 tracking-wide">
                  Relatório Operacional do Dia
                </h2>
                <p className="text-xs font-bold text-slate-600">
                  {state.teamName} • {formatDateBR(activeDate)} • Turno {state.teamShift || 'Geral'}
                </p>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 bg-slate-100 border border-slate-300 rounded-lg text-xs font-black text-slate-800">
                  {presentCollaborators.length} Presentes / {totalDimensioned} Dimensionados
                </span>
              </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-lg font-black text-slate-900">{state.collaborators.length}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">Total Equipe</div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="text-lg font-black text-emerald-700">{presentCollaborators.length}</div>
                <div className="text-[10px] font-bold text-emerald-700 uppercase">Presentes</div>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <div className="text-lg font-black text-rose-700">
                  {state.collaborators.length - presentCollaborators.length}
                </div>
                <div className="text-[10px] font-bold text-rose-700 uppercase">Ausentes</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-lg font-black text-slate-900">
                  {totalDimensioned}
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">Dimensionados</div>
              </div>
            </div>

            {/* Table of Non-Present Collaborators */}
            {(() => {
              const absents = state.collaborators
                .filter((c) => {
                  const statusInfo = getCollaboratorStatus(c, activeDate, state);
                  return statusInfo.status !== 'presente';
                })
                .map((c) => {
                  const statusInfo = getCollaboratorStatus(c, activeDate, state);
                  const report = state.dailyReports?.[activeDate];
                  const reason = report?.absenceReasons?.[c.id] || statusInfo.absenceReason || statusInfo.status;
                  return {
                    id: c.id,
                    name: c.name,
                    role: c.role || 'Sem Cargo',
                    statusLabel: statusInfo.status,
                    reason,
                  };
                });

              if (absents.length === 0) {
                return (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 text-center">
                    Todos os colaboradores estão presentes no dia de hoje.
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  <h3 className="text-xs font-black uppercase text-slate-800 border-b border-slate-200 pb-1">
                    Colaboradores Ausentes & Justificativas ({absents.length})
                  </h3>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 text-slate-500 font-bold uppercase text-[10px]">
                        <th className="py-1">Colaborador</th>
                        <th className="py-1">Cargo</th>
                        <th className="py-1">Status</th>
                        <th className="py-1">Justificativa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {absents.map((c) => (
                        <tr key={c.id}>
                          <td className="py-1.5 font-bold text-slate-900">{c.name}</td>
                          <td className="py-1.5 text-slate-600">{c.role}</td>
                          <td className="py-1.5 font-bold uppercase text-[10px]">{c.statusLabel}</td>
                          <td className="py-1.5 text-slate-800">{c.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* General Notes */}
            {(() => {
              const report = state.dailyReports?.[activeDate];
              if (!report?.generalNotes) return null;
              return (
                <div className="space-y-1 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  <h4 className="text-xs font-black uppercase text-slate-800">Observações Operacionais do Dia:</h4>
                  <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap">{report.generalNotes}</p>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
