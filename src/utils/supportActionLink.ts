import { ActionLinkVar } from '../types';

export interface SupportFieldValue {
  id: string;
  label: string;
  value: string;
  key?: string;
}

export interface ActionLinkContext {
  fields?: SupportFieldValue[];
  senderName?: string;
  senderShift?: string;
  senderCategory?: string;
  supportType?: string;
  codeText?: string;
}

// Fontes pré-definidas de valores disponíveis no link de ação
export const ACTION_LINK_SOURCES: Array<{
  value: 'field' | 'nome' | 'turno' | 'categoria' | 'tipo' | 'codigo';
  label: string;
}> = [
  { value: 'nome', label: 'Nome do solicitante' },
  { value: 'turno', label: 'Turno' },
  { value: 'categoria', label: 'Categoria' },
  { value: 'tipo', label: 'Tipo de pedido' },
  { value: 'codigo', label: 'Código / recado' },
];

// Busca o valor real de uma origem do link de ação
function resolveSourceValue(source: ActionLinkVar['source'], fieldKey: string | undefined, fieldId: string | undefined, ctx: ActionLinkContext): string {
  switch (source) {
    case 'nome':
      return ctx.senderName || '';
    case 'turno':
      return ctx.senderShift || '';
    case 'categoria':
      return ctx.senderCategory || '';
    case 'tipo':
      return ctx.supportType || '';
    case 'codigo':
      return ctx.codeText || '';
    case 'field': {
      const field = (ctx.fields || []).find((f) =>
        fieldKey ? f.key === fieldKey : f.id === fieldId
      ) || (ctx.fields || []).find((f) => f.id === fieldId);
      return field ? field.value : '';
    }
    default:
      return '';
  }
}

// Resolve um template de link trocando os tokens {token} pelos valores reais.
// Usa o mapeamento explícito (vars) quando disponível; caso contrário,
// tenta casar o token com a chave/id de um campo ou com as fontes pré-definidas.
export function resolveSupportActionLink(template: string, vars: ActionLinkVar[] | undefined, ctx: ActionLinkContext): string {
  if (!template) return '';

  let url = template;

  // 1) Substituição explícita via mapeamento
  if (vars && vars.length > 0) {
    for (const v of vars) {
      const val = resolveSourceValue(v.source, v.fieldKey, v.fieldId, ctx);
      url = url.split(`{${v.token}}`).join(encodeURIComponent(val));
    }
  }

  // 2) Fallback: qualquer token restante que case com chave/id de campo ou fonte pré-definida
  url = url.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, rawToken) => {
    const predefined = ACTION_LINK_SOURCES.find((s) => s.value === rawToken);
    if (predefined) {
      return encodeURIComponent(resolveSourceValue(predefined.value, undefined, undefined, ctx));
    }
    const byKey = (ctx.fields || []).find((f) => f.key === rawToken);
    if (byKey) return encodeURIComponent(byKey.value);
    const byId = (ctx.fields || []).find((f) => f.id === rawToken);
    if (byId) return encodeURIComponent(byId.value);
    return match;
  });

  return url;
}

// Formata os campos para a área de transferência ("Rótulo: valor" por linha)
export function formatSupportFieldsForClipboard(fields?: SupportFieldValue[]): string {
  if (!fields || fields.length === 0) return '';
  return fields.map((f) => `${f.label}: ${f.value}`).join('\n');
}

// Gera uma chave amigável a partir de um rótulo (ex: "Código da Impressora" -> "codigo_impressora")
export function slugifyActionLinkKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Encontra o token de um campo dentro do template (ex: token usado pelo campo)
export function findTokenForField(template: string, fieldKey: string | undefined, fieldId: string): string | undefined {
  const candidates = [fieldKey, fieldId].filter(Boolean) as string[];
  for (const c of candidates) {
    if (template.includes(`{${c}}`)) return c;
  }
  return undefined;
}

// Lista os tokens {token} presentes no template
export function extractActionLinkTokens(template: string): string[] {
  const tokens: string[] = [];
  const regex = /\{([a-zA-Z0-9_]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(template)) !== null) {
    if (!tokens.includes(m[1])) tokens.push(m[1]);
  }
  return tokens;
}