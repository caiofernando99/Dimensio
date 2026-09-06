import { SupportTypeField } from '../types';

// Separadores de entrada aceitos por padrão na digitação
const DEFAULT_INPUT_SEPARATORS = [' ', '-', '.', '/', '_', ','];

function escapeRegExp(chars: string): string {
  return chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Descobre o separador usado no exemplo (ex: "PS-1-104-136-02-01" -> "-")
function inferSeparator(example: string): string {
  const matches = example.match(/[^A-Za-z0-9]/g);
  if (!matches || matches.length === 0) return '-';
  const counts: Record<string, number> = {};
  for (const m of matches) counts[m] = (counts[m] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// Normaliza um segmento do valor conforme o segmento de exemplo
function normalizeSegment(part: string, seg: string, field: SupportTypeField): string {
  let v = part.trim();
  const segIsNumeric = /^\d+$/.test(seg);
  const segIsUpper = /[A-Z]/.test(seg) && seg === seg.toUpperCase();
  const segIsLower = /[a-z]/.test(seg) && seg === seg.toLowerCase();

  if (segIsNumeric) {
    v = v.replace(/\D/g, '');
    const width = seg.length;
    if (v.length < width) v = v.padStart(width, '0');
    return v;
  }

  // Segmento alfanumérico: mantém letras/dígitos e aplica o case do exemplo
  v = v.replace(/[^A-Za-z0-9]/g, '');
  if (field.uppercase || segIsUpper) v = v.toUpperCase();
  else if (segIsLower) v = v.toLowerCase();
  return v;
}

// Formata o valor digitado conforme a configuração do campo.
// Ex: "ps 1 104 136 2 1" -> "PS-1-104-136-02-01"
export function formatSupportFieldValue(value: string, field: SupportTypeField | undefined): string {
  const raw = (value ?? '').trim();
  const fmt = field?.format;
  if (!fmt?.example?.trim()) {
    // Sem formatação configurada: aplica apenas caixa alta quando o campo exigir
    return field?.uppercase ? raw.toUpperCase() : raw;
  }

  const example = fmt.example.trim();
  const outputSep = fmt.outputSeparator?.trim() || inferSeparator(example) || '-';
  const segs = example.split(outputSep).map((s) => s.trim()).filter(Boolean);

  if (segs.length <= 1) {
    // Exemplo sem separador (ex: "ABC123"): só normaliza o case e espaços
    let r = raw.replace(/\s+/g, '');
    if (field?.uppercase || /[A-Z]/.test(example)) r = r.toUpperCase();
    return r;
  }

  // Separadores de entrada aceitos
  const inputSeps = fmt.inputSeparators
    ? fmt.inputSeparators.split('').filter((c) => c.trim())
    : DEFAULT_INPUT_SEPARATORS;

  // Tenta dividir a entrada pelo separador de saída; se não casar a quantidade
  // de segmentos, divide por qualquer separador aceito.
  let parts = raw.split(outputSep).map((s) => s.trim()).filter(Boolean);
  if (parts.length !== segs.length) {
    const regex = new RegExp(`[${escapeRegExp(inputSeps.join(''))}]+`);
    parts = raw.split(regex).filter(Boolean);
  }

  const formatted = parts
    .map((part, i) => {
      const seg = segs[i];
      if (!seg) return part;
      return normalizeSegment(part, seg, field);
    })
    .join(outputSep);

  return formatted;
}

// Versão "ao digitar": formata apenas case e espaços em separador, sem
// aplicar preenchimento com zeros (evita conflito de cursor durante a digitação).
export function formatSupportFieldValueLive(value: string, field: SupportTypeField | undefined): string {
  const fmt = field?.format;
  if (!fmt?.example?.trim()) {
    return field?.uppercase ? value.toUpperCase() : value;
  }
  const example = fmt.example.trim();
  const outputSep = fmt.outputSeparator?.trim() || inferSeparator(example) || '-';
  const segs = example.split(outputSep).map((s) => s.trim()).filter(Boolean);
  if (segs.length <= 1) {
    let r = value.replace(/\s+/g, '');
    if (field?.uppercase || /[A-Z]/.test(example)) r = r.toUpperCase();
    return r;
  }
  let r = value.replace(/\s+/g, outputSep);
  if (field?.uppercase) r = r.toUpperCase();
  return r;
}