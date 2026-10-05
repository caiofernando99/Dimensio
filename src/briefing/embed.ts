/**
 * Normaliza links de documentos/apresentações para incorporação (iframe).
 * Suporta Google Drive, Google Apresentações, Canva, PDF direto e URL genérica.
 *
 * É o ponto de encaixe da futura integração com o Google Apresentações:
 * o slide `embed` guarda só link + estado, então o picker futuro só precisa
 * preencher `url` (+ `title`).
 */

export type EmbedProvider = 'slides' | 'drive' | 'canva' | 'pdf' | 'web';

export function detectEmbedProvider(rawUrl: string): EmbedProvider {
  const url = (rawUrl || '').trim();
  if (/docs\.google\.com\/presentation\/d\//.test(url)) return 'slides';
  if (/drive\.google\.com\/file\/d\//.test(url) || /[?&]id=[a-zA-Z0-9_-]+/.test(url)) return 'drive';
  if (url.includes('canva.com/design/')) return 'canva';
  const lower = url.toLowerCase();
  if (lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('.pdf#')) return 'pdf';
  return 'web';
}

export function providerLabel(p: EmbedProvider): string {
  switch (p) {
    case 'slides':
      return 'Google Apresentações';
    case 'drive':
      return 'Google Drive';
    case 'canva':
      return 'Canva';
    case 'pdf':
      return 'PDF';
    default:
      return 'Página web';
  }
}

export function formatEmbedUrl(rawUrl: string, page = 1): string {
  if (!rawUrl) return '';
  const url = rawUrl.trim();

  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview#page=${page}`;
  }

  const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slidesMatch) {
    return `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed?start=false&loop=false&delayms=3000#slide=id.p${page}`;
  }

  if (url.includes('canva.com/design/')) {
    return url.includes('view?embed') ? url : `${url}?embed`;
  }

  const lower = url.toLowerCase();
  if (lower.endsWith('.pdf') || lower.includes('.pdf?')) {
    return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}#page=${page}`;
  }

  return url;
}
