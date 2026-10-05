import { AppState, Collaborator, ScheduledAbsence, BreakRotationInfo } from '../types';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/**
 * Shuffles an array randomly using Fisher-Yates algorithm without mutating original array.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Capitalizes a person's name into "Aaaa Aaaa Aaaa" / Title Case format.
 * E.g., "carlos eduardo santos" -> "Carlos Eduardo Santos"
 * "MARIA DA SILVA" -> "Maria da Silva"
 */
export function formatPersonName(name: string): string {
  if (!name) return '';
  if (!name.trim()) return name;
  const lowercasePrepositions = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'del', 'di']);
  
  // Capture trailing whitespace so typing space doesn't get immediately swallowed
  const trailingSpacesMatch = name.match(/\s+$/);
  const trailingSpaces = trailingSpacesMatch ? trailingSpacesMatch[0] : '';

  const words = name.trim().split(/\s+/);
  
  const formatted = words
    .map((word, idx) => {
      if (!word) return '';
      const lower = word.toLowerCase();
      if (idx > 0 && lowercasePrepositions.has(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  return formatted + trailingSpaces;
}

/**
 * Abbreviates a full name e.g., "Ana Paula Silva" -> "ANA S." or "Ana S."
 * Handles prepositions like "da", "de", "do".
 */
export function abbreviateName(fullName: string, uppercase = true): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  if (!trimmed) return '';
  const lowercasePrepositions = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'del', 'di']);
  const words = trimmed.split(/\s+/).filter(w => !lowercasePrepositions.has(w.toLowerCase()));
  if (words.length <= 1) {
    return uppercase ? words[0].toUpperCase() : formatPersonName(words[0]);
  }
  const firstName = uppercase ? words[0].toUpperCase() : (words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase());
  const lastWord = words[words.length - 1];
  const lastInitial = lastWord.charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

/**
 * Abreviação "inteligente" para layouts com espaço limitado.
 * - 'full':   nome completo "João da Silva Santos"
 * - 'medium': primeiro nome + último nome "João Santos"
 * - 'short':  primeiro nome + inicial do último "João S."
 * - 'auto':   escolhe automaticamente conforme o espaço disponível (maxWidth em caracteres)
 */
export function abbreviateNameFlexible(
  fullName: string,
  mode: 'full' | 'medium' | 'short' | 'auto' = 'auto',
  maxChars = 14,
  uppercase = false
): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  if (!trimmed) return '';
  const lowercasePrepositions = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'del', 'di']);
  const rawWords = trimmed.split(/\s+/);
  const words = rawWords.filter((w) => !lowercasePrepositions.has(w.toLowerCase()));

  const titleCase = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const apply = (s: string) => (uppercase ? s.toUpperCase() : s);

  if (mode === 'full') return apply(formatPersonName(trimmed));

  if (mode === 'medium' && words.length > 1) {
    return apply(`${titleCase(words[0])} ${titleCase(words[words.length - 1])}`);
  }

  if (mode === 'short' && words.length > 1) {
    return apply(`${titleCase(words[0])} ${words[words.length - 1].charAt(0).toUpperCase()}.`);
  }

  // 'auto': tenta o formato mais completo que cabe no espaço
  const full = formatPersonName(trimmed);
  if (full.length <= maxChars) return apply(full);

  if (words.length > 1) {
    const medium = `${titleCase(words[0])} ${titleCase(words[words.length - 1])}`;
    if (medium.length <= maxChars) return apply(medium);
    return apply(`${titleCase(words[0])} ${words[words.length - 1].charAt(0).toUpperCase()}.`);
  }

  return apply(titleCase(words[0]));
}

export function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getAdjacentDate(dateStr: string, offsetDays: number): string {
  if (!dateStr) return getTodayISO();
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d + offsetDays, 12, 0, 0);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

export function formatDateLongBR(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Checks if a role is operational (counts towards Headcount / HC).
 * Administrative roles ("administrativo") do NOT count as HC.
 */
export function isOperationalRole(roleName: string, state: AppState): boolean {
  if (!roleName) return true;
  if (roleName === 'TL') return false;
  const type = state.roleTypes?.[roleName];
  if (type === 'administrativo') return false;
  return true;
}

/**
 * Normaliza qualquer formato de dia do calendário (legado string, array ou
 * objeto CalendarDay) para CalendarDay canônico.
 */
export function normalizeCalendarDay(raw: unknown): import('../types').CalendarDay {
  if (!raw) return { offGroups: [] };
  if (typeof raw === 'string') {
    return raw ? { offGroups: [raw] } : { offGroups: [] };
  }
  if (Array.isArray(raw)) {
    return { offGroups: (raw as unknown[]).map(String).filter(Boolean) };
  }
  if (typeof raw === 'object') {
    const o = raw as Partial<import('../types').CalendarDay> & { group?: unknown; offGroup?: unknown };
    const fromOff = Array.isArray((o as any).offGroups)
      ? (o as any).offGroups.map(String).filter(Boolean)
      : [];
    const legacySingle = typeof o.group === 'string' && o.group
      ? [o.group]
      : typeof o.offGroup === 'string' && (o as any).offGroup
        ? [(o as any).offGroup as string]
        : [];
    return {
      offGroups: [...fromOff, ...legacySingle],
      holidayTitle: typeof o.holidayTitle === 'string' ? o.holidayTitle : undefined,
      isHoliday: Boolean(o.isHoliday || (typeof o.holidayTitle === 'string' && o.holidayTitle.trim())),
      allowWorkOnHoliday: o.allowWorkOnHoliday !== false,
      notes: typeof o.notes === 'string' ? o.notes : undefined,
    };
  }
  return { offGroups: [] };
}

/** Retorna as turmas em folga num dia (suporta 0..N turmas). */
export function getDayOffGroups(
  calendar: Record<string, string | string[] | import('../types').CalendarDay>,
  dateStr: string
): string[] {
  return normalizeCalendarDay((calendar || {})[dateStr]).offGroups;
}

/** Retorna info de feriado do dia, se houver (título + permissão de trabalho). */
export function getDayHoliday(
  calendar: Record<string, string | string[] | import('../types').CalendarDay>,
  dateStr: string
): { title?: string; isHoliday: boolean; allowWork: boolean } {
  const day = normalizeCalendarDay((calendar || {})[dateStr]);
  return {
    title: day.holidayTitle,
    isHoliday: Boolean(day.isHoliday),
    allowWork: day.allowWorkOnHoliday !== false,
  };
}

/**
 * Checks if a collaborator is on scale off (Folga) for a given date.
 * Suporta multi-folga: retorna true se a escala do colaborador estiver
 * entre as turmas em folga do dia. Feriado com allowWork NÃO altera a folga —
 * apenas carrega a informação para exibição.
 */
export function isScaleOff(
  calendar: Record<string, string | string[] | import('../types').CalendarDay>,
  dateStr: string,
  scale: string
): boolean {
  if (!scale) return false;
  return getDayOffGroups(calendar, dateStr).includes(scale);
}

/**
 * Legacy example/demo-data detector. Example-data detection was REMOVED in v4.5:
 * it could block legitimate syncing (an imported backup whose roster still
 * matched the old demo ids/names was refused, so `__DB_STATE__` was never
 * mounted and the spreadsheet showed "banco não acessível"). Every roster is
 * now treated as real user data, so this always returns `false`.
 */
export function isLikelyExampleRoster(
  _state: Pick<AppState, 'collaborators'> | Collaborator[] | null | undefined
): boolean {
  return false;
}

/**
 * Legacy example-data detector. Always returns `false` — see
 * isLikelyExampleRoster for why the demo-data detection was removed.
 */
export function isSampleDataState(
  _state: Pick<AppState, 'collaborators' | 'isSampleData'> | Collaborator[]
): boolean {
  return false;
}

/**
 * Returns the active scheduled absence (Férias, Licença, Treinamento) for a collaborator on a given date, if any.
 */
export function getActiveAbsence(collaborator: Collaborator, dateStr: string): ScheduledAbsence | null {
  if (!collaborator.absences || collaborator.absences.length === 0) return null;
  return (
    collaborator.absences.find(
      (a) => dateStr >= a.startDate && dateStr <= a.endDate
    ) || null
  );
}

export type StatusType = 'presente' | 'atraso' | 'ausente' | 'folga' | 'ferias' | 'licenca' | 'treinamento' | 'atestado' | 'banco_horas' | 'falta_injustificada';

export interface CollaboratorDayStatus {
  status: StatusType;
  absenceDetail?: ScheduledAbsence | null;
  isOffScale: boolean;
  isManualOverride: boolean;
  isExtraPresence: boolean;
  absenceReason?: string;
}

/**
 * Calculates the exact status of a collaborator on a specific date.
 */
export function getCollaboratorStatus(
  collaborator: Collaborator,
  dateStr: string,
  state: AppState
): CollaboratorDayStatus {
  const scheduledAbsence = getActiveAbsence(collaborator, dateStr);
  const offScale = isScaleOff(state.calendar, dateStr, collaborator.scale);
  const manual = state.attendance[dateStr]?.[collaborator.id];

  // Manual presence override explicitly set by manager
  if (manual !== undefined) {
    // Present (true)
    if (manual === true) {
      const isExtra = offScale || Boolean(scheduledAbsence);
      return {
        status: 'presente',
        absenceDetail: scheduledAbsence,
        isOffScale: offScale,
        isManualOverride: true,
        isExtraPresence: isExtra,
        absenceReason: state.dailyReports[dateStr]?.absenceReasons?.[collaborator.id] || '',
      };
    }
    
    // Absent with reason object
    if (typeof manual === 'object' && manual.absent && manual.reason) {
      const reason = manual.reason as StatusType;
      return {
        status: reason,
        absenceDetail: scheduledAbsence,
        isOffScale: offScale,
        isManualOverride: true,
        isExtraPresence: false,
        absenceReason: state.dailyReports[dateStr]?.absenceReasons?.[collaborator.id] || '',
      };
    }
    
    // Legacy absent (false)
    return {
      status: 'ausente',
      absenceDetail: scheduledAbsence,
      isOffScale: offScale,
      isManualOverride: true,
      isExtraPresence: false,
      absenceReason: state.dailyReports[dateStr]?.absenceReasons?.[collaborator.id] || '',
    };
  }

  // No manual override set
  if (scheduledAbsence) {
    return {
      status: scheduledAbsence.type,
      absenceDetail: scheduledAbsence,
      isOffScale: offScale,
      isManualOverride: false,
      isExtraPresence: false,
      absenceReason: '',
    };
  }

  if (offScale) {
    return {
      status: 'folga',
      absenceDetail: null,
      isOffScale: true,
      isManualOverride: false,
      isExtraPresence: false,
      absenceReason: '',
    };
  }

  return {
    status: 'presente',
    absenceDetail: null,
    isOffScale: false,
    isManualOverride: false,
    isExtraPresence: false,
    absenceReason: '',
  };
}

/**
 * Returns the ISO (YYYY-MM-DD) strings for the last `windowDays` days ending at
 * `endDate` (inclusive), oldest first.
 */
export function getLastDaysISO(endDate: string, windowDays: number): string[] {
  const [y, m, d] = endDate.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  const dates: string[] = [];
  for (let i = 0; i < windowDays; i++) {
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    dates.unshift(iso);
    date.setDate(date.getDate() - 1);
  }
  return dates;
}

/**
 * Returns true if a collaborator status counts as absenteeism (only unjustified absence 'falta_injustificada' and medical leave 'atestado').
 * Note: Scheduled days off ('folga'), bank hours ('banco_horas'), holidays/vacation do NOT count as absenteeism.
 */
export function isAbsenteeismStatus(status: string): boolean {
  return ['falta_injustificada', 'atestado'].includes(status);
}

/**
 * Computes the team absenteeism rate (%) for a given date, consistent with the
 * daily report sync formula: collaborators with absenteeism statuses / total * 100.
 */
export function getTeamAbsenteeismRate(state: AppState, dateStr: string): number {
  if (state.collaborators.length === 0) return 0;
  let absentCount = 0;
  state.collaborators.forEach((c) => {
    if (isAbsenteeismStatus(getCollaboratorStatus(c, dateStr, state).status)) absentCount++;
  });
  return (absentCount / state.collaborators.length) * 100;
}

/**
 * Computes a collaborator's absenteeism rate (%) over the last `windowDays`
 * (default 30), counting days with absenteeism statuses.
 */
export function getCollaboratorAbsenteeismRate(
  state: AppState,
  collaborator: Collaborator,
  endDate: string,
  windowDays = 30
): number {
  const days = getLastDaysISO(endDate, windowDays);
  if (days.length === 0) return 0;
  let absentDays = 0;
  days.forEach((dateStr) => {
    if (isAbsenteeismStatus(getCollaboratorStatus(collaborator, dateStr, state).status)) absentDays++;
  });
  return (absentDays / days.length) * 100;
}

export function escapeSearchTerm(term: string): string {
  if (!term) return '';
  return term
    .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/g, ' ')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes text for search indexing by stripping accents, symbols, and extra spaces.
 */
export function normalizeSearchText(term: string): string {
  if (!term) return '';
  return term
    .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/g, ' ')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\-–—/\\()\[\]{}:;'"!?*#@&|+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compresses a data URL image (JPEG/PNG) into a smaller JPEG data URL so it
 * fits inside the cloud state blob payload (which is stored in Google Sheets
 * cells of ~45K chars each). Returns the original string when the input is not
 * an image, or when compression fails.
 */
export function compressImageDataUrl(
  dataUrl: string,
  maxDimension = 640,
  quality = 0.55
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const ratio = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        // Safety: if compression is somehow larger (rare), keep the original.
        resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Canonicalizes Brazilian/Portuguese name spelling variations for phonetic/fuzzy search.
 * Handles common variants:
 * - 'th' -> 't' (Matheus <-> Mateus, Thiago <-> Tiago, Arthur <-> Artur)
 * - 'ph' -> 'f' (Raphael <-> Rafael, Philippe <-> Filipe)
 * - 'y' -> 'i' (Antony <-> Antoni, Yasmin <-> Iasmin, Gabryel <-> Gabriel)
 * - 'w' -> 'v' (Walter <-> Valter, Wellington <-> Vellington)
 * - 'z' (at word end or between vowels) -> 's' (Luiz <-> Luis, Queiroz <-> Queiros)
 * - 'ck' / 'k' -> 'c' (Erick <-> Eric, Lucas <-> Lukas)
 * - Collapses repeated consonants (tt->t, ll->l, nn->n, ss->s, mm->m, pp->p, ff->f, cc->c, rr->r)
 * - Removes silent 'h' (unless after c, l, n) (Deborah <-> Debora, Sarah <-> Sara)
 */
export function canonicalizeNameForSearch(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/g, ' ')
    .replace(/[.,\-–—/\\()\[\]{}:;'"!?*#@&|+]/g, ' ')
    .replace(/th/g, 't')
    .replace(/ph/g, 'f')
    .replace(/y/g, 'i')
    .replace(/w/g, 'v')
    .replace(/ck/g, 'c')
    .replace(/k/g, 'c')
    .replace(/z\b/g, 's')
    .replace(/(?<![cln])h/g, '')
    .replace(/(.)\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a string matches a search query.
 * Accepts multi-word queries (tokens), exact substrings, phonetic name variants (e.g. Matheus <-> Mateus),
 * and pasted lists separated by newlines or commas/semicolons.
 */
export function matchesSearch(text: string | undefined | null, search: unknown): boolean {
  if (typeof search !== 'string' || !search.trim()) return true;
  if (!text) return false;

  // Split search into terms if user pasted multiple lines or comma/semicolon separated list
  const rawTerms = search
    .split(/[\n\r,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (rawTerms.length === 0) return true;

  const normalizedTarget = normalizeSearchText(text);
  const escapedTarget = escapeSearchTerm(text);
  const canonicalTarget = canonicalizeNameForSearch(text);

  return rawTerms.some((term) => {
    const escTerm = escapeSearchTerm(term);
    if (!escTerm) return false;

    // 1. Direct contiguous match (fastest)
    if (escapedTarget.includes(escTerm)) return true;

    // 2. Normalized match
    const normTerm = normalizeSearchText(term);
    if (normalizedTarget.includes(normTerm)) return true;

    // 3. Phonetic / Canonical match (e.g. Matheus <-> Mateus, Thiago <-> Tiago)
    const canonTerm = canonicalizeNameForSearch(term);
    if (canonTerm && canonicalTarget.includes(canonTerm)) return true;

    // 4. Tokenized multi-word matching (e.g. "Carlos Costa" matches "Carlos Eduardo da Silva Costa")
    const tokens = normTerm.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      const allTokensMatch = tokens.every((token) => normalizedTarget.includes(token));
      if (allTokensMatch) return true;
    }

    // 5. Canonical multi-word tokens
    const canonTokens = canonTerm.split(/\s+/).filter(Boolean);
    if (canonTokens.length > 1) {
      const allCanonTokensMatch = canonTokens.every((token) => canonicalTarget.includes(token));
      if (allCanonTokensMatch) return true;
    }

    return false;
  });
}

/**
 * Robust search matcher for collaborator profiles in Identification, Operators, Presence, and Team views.
 * Evaluates full names, first/last names, roles (TL, PS, etc.), shifts (T1..T5), team leaders,
 * logins/LDAPs, registrations (matrículas), categories, scales, and skills,
 * with complete phonetic invariance (Matheus / Mateus, Thiago / Tiago, etc.).
 */
export function matchesCollaboratorSearch(
  collaborator: Collaborator | undefined | null,
  query: string | undefined | null,
  extra?: { defaultTeamLeader?: string }
): boolean {
  if (!collaborator) return false;
  if (!query || !query.trim()) return true;

  // Strip master trigger dot if present
  const cleanQuery = query.replace(/^\./, '').trim();
  if (!cleanQuery) return true;

  // Check if query is a pasted list (multiple lines or commas)
  const listItems = cleanQuery.split(/[\n\r,;]+/).map((s) => s.trim()).filter(Boolean);
  if (listItems.length > 1) {
    return listItems.some((item) => matchesCollaboratorSearch(collaborator, item, extra));
  }

  const queryTokens = normalizeSearchText(cleanQuery).split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0) return true;

  const colName = collaborator.name || '';
  const colTL = collaborator.teamLeader || extra?.defaultTeamLeader || '';
  const shiftText = collaborator.shift ? `${collaborator.shift} Turno ${collaborator.shift} Turno${collaborator.shift} T${collaborator.shift}` : '';
  const roleRaw = collaborator.role || '';
  const isTL = roleRaw === 'TL' || roleRaw.toLowerCase().includes('líder') || roleRaw.toLowerCase().includes('lider') || roleRaw.toLowerCase().includes('leader');
  const roleText = `${roleRaw} ${isTL ? 'TL Líder Lider Team Leader TeamLeader Supervisor Coordenação' : ''} ${roleRaw === 'PS' ? 'PS Especialista Process Specialist' : ''} ${roleRaw === 'REP' ? 'REP Operador Representante' : ''}`;
  const scaleText = collaborator.scale ? `Grupo ${collaborator.scale} ${collaborator.scale} Turma ${collaborator.scale} Escala ${collaborator.scale}` : '';
  const skillsText = Array.isArray(collaborator.skills)
    ? collaborator.skills.join(' ')
    : typeof collaborator.skills === 'object' && collaborator.skills !== null
    ? Object.keys(collaborator.skills).join(' ')
    : '';

  const nameAbbrev = colName ? abbreviateName(colName, false) : '';
  const nameParts = colName.split(/\s+/).filter(Boolean);

  // Full composite searchable bundle for the collaborator
  const rawBundle = `
    ${colName}
    ${nameAbbrev}
    ${nameParts.join(' ')}
    ${roleText}
    ${shiftText}
    ${colTL}
    ${collaborator.id || ''}
    ${collaborator.login || ''}
    ${collaborator.registration || ''}
    ${collaborator.category || ''}
    ${scaleText}
    ${skillsText}
  `;

  const fullSearchBundle = normalizeSearchText(rawBundle);
  const canonicalSearchBundle = canonicalizeNameForSearch(rawBundle);
  const normalizedNameOnly = normalizeSearchText(colName);
  const canonicalNameOnly = canonicalizeNameForSearch(colName);

  // Every token entered by the user must match either standard normalized bundle or canonical phonetic bundle
  return queryTokens.every((token) => {
    if (!token) return true;
    if (fullSearchBundle.includes(token)) return true;
    if (normalizedNameOnly.includes(token)) return true;

    const canonToken = canonicalizeNameForSearch(token);
    if (canonToken) {
      if (canonicalSearchBundle.includes(canonToken)) return true;
      if (canonicalNameOnly.includes(canonToken)) return true;
    }

    return false;
  });
}

/**
 * Relevância de um colaborador para a busca (0 = não casa).
 *
 * Por que existe: o matcher acima casa o nome no time/líder com o MESMO peso
 * do nome próprio — buscar "matheus" retornava 69 de 72 (66 liderados por um
 * Matheus) e os 3 Matheus reais se afogavam no fim da lista. Com o score, as
 * UIs ordenam correspondência direta primeiro.
 *
 * Tiers: 100 nome (substring) > 90 prefixo de palavra do nome > 80 nome
 * fonético (Matheus↔Mateus) > 70 login/matrícula > 50 cargo > 40 turno >
 * 30 time/líder > 20 categoria/skills > 10 resto do pacote.
 */
export function scoreCollaboratorSearch(
  collaborator: Collaborator | undefined | null,
  query: string | undefined | null,
  extra?: { defaultTeamLeader?: string }
): number {
  if (!collaborator) return 0;
  if (!query || !query.trim()) return 0;
  const cleanQuery = query.replace(/^\./, '').trim();
  if (!cleanQuery) return 0;

  const normQ = normalizeSearchText(cleanQuery);
  const canonQ = canonicalizeNameForSearch(cleanQuery);
  const tokens = normQ.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  const colName = collaborator.name || '';
  const normName = normalizeSearchText(colName);
  const canonName = canonicalizeNameForSearch(colName);
  const nameWords = normName.split(/\s+/).filter(Boolean);

  const startsWithWords = tokens.every((t) => nameWords.some((w) => w.startsWith(t)));
  if (normName && normQ && normName.includes(normQ)) return 100;
  if (startsWithWords) return 90;
  if (canonName && canonQ && canonName.includes(canonQ)) return 80;

  const login = normalizeSearchText(collaborator.login || '');
  const reg = normalizeSearchText(collaborator.registration || '');
  if ((login && normQ && login.includes(normQ)) || (reg && normQ && reg.includes(normQ))) return 70;

  const roleText = normalizeSearchText(collaborator.role || '');
  if (roleText && tokens.every((t) => roleText.includes(t))) return 50;

  const shiftText = normalizeSearchText(collaborator.shift || '');
  if (shiftText && tokens.every((t) => shiftText.includes(t))) return 40;

  const tlText = normalizeSearchText(collaborator.teamLeader || extra?.defaultTeamLeader || '');
  if (tlText && tokens.every((t) => tlText.includes(t))) return 30;

  const catSkills = normalizeSearchText(
    `${collaborator.category || ''} ${
      Array.isArray(collaborator.skills)
        ? collaborator.skills.join(' ')
        : typeof collaborator.skills === 'object' && collaborator.skills !== null
        ? Object.keys(collaborator.skills).join(' ')
        : ''
    }`
  );
  if (catSkills.trim() && tokens.every((t) => catSkills.includes(t))) return 20;

  return matchesCollaboratorSearch(collaborator, query, extra) ? 10 : 0;
}

/** Ordena perfis por relevância (maior score primeiro, estável). */
export function sortBySearchScore<T extends Collaborator>(
  items: T[],
  query: string | undefined | null,
  extra?: { defaultTeamLeader?: string }
): T[] {
  if (!query || !query.trim()) return items;
  return items
    .map((item, idx) => ({ item, idx, score: scoreCollaboratorSearch(item, query, extra) }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .map((e) => e.item);
}

/**
 * Locale-aware string comparator for Portuguese (pt-BR)
 */
export function compareStringsBR(a: string | undefined | null, b: string | undefined | null): number {
  return (a || '').trim().localeCompare((b || '').trim(), 'pt-BR', { sensitivity: 'base', numeric: true });
}

/**
 * Sorts an array of items by name alphabetically (A-Z by default) using pt-BR collation.
 * Supports Collaborator objects or objects containing a `collaborator` or `collab` property.
 */
export function sortCollaboratorsAlphabetical<T extends { name?: string } | { collaborator?: { name?: string } } | { collab?: { name?: string } }>(
  items: T[],
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  return [...items].sort((a, b) => {
    const nameA = ('collaborator' in a && a.collaborator?.name)
      ? a.collaborator.name
      : ('collab' in a && a.collab?.name)
      ? a.collab.name
      : (a as any).name || '';
    const nameB = ('collaborator' in b && b.collaborator?.name)
      ? b.collaborator.name
      : ('collab' in b && b.collab?.name)
      ? b.collab.name
      : (b as any).name || '';
    const cmp = compareStringsBR(nameA, nameB);
    return direction === 'asc' ? cmp : -cmp;
  });
}

/**
 * Serializes daily operational state into a compact URL-safe Base64 string
 */
export function encodeSharedState(state: AppState): string {
  try {
    const selDate = state.selectedDate || new Date().toISOString().split('T')[0];
    const snapshot = {
      selectedDate: selDate,
      date: selDate,
      teamName: state.teamName,
      sector: state.sector,
      manager: state.manager,
      teamShift: state.teamShift,
      defaultTeamLeader: state.defaultTeamLeader,
      teamLeaders: state.teamLeaders,
      collaborators: state.collaborators,
      tasks: state.tasks,
      breaks: state.breaks,
      intervals: state.intervals || {},
      attendance: state.attendance || {},
      calendar: state.calendar,
    };
    const jsonStr = JSON.stringify(snapshot);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const base64 = btoa(binary);
    return encodeURIComponent(base64);
  } catch (err) {
    console.error('Failed to encode shared state:', err);
    return '';
  }
}

/**
 * Decodes compressed Base64 string from URL parameter back into state snapshot
 */
export function decodeSharedState(encoded: string): any | null {
  if (!encoded) return null;
  try {
    const base64 = decodeURIComponent(encoded);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(jsonStr);

    if (!parsed || typeof parsed !== 'object') return null;

    const activeDate = parsed.selectedDate || parsed.date || new Date().toISOString().split('T')[0];

    // Normalize intervals structure so state.intervals[activeDate] is always available
    const rawIntervals = parsed.intervals || {};
    let normalizedIntervals: Record<string, Record<string, string[]>> = {};

    if (rawIntervals[activeDate]) {
      normalizedIntervals = rawIntervals;
    } else {
      // Check if rawIntervals is flat { [breakId]: [collabIds] }
      const keys = Object.keys(rawIntervals);
      const isFlat = keys.some(k => k.startsWith('break-') || !k.includes('-'));
      if (isFlat) {
        normalizedIntervals = { [activeDate]: rawIntervals };
      } else {
        normalizedIntervals = rawIntervals;
      }
    }

    // Normalize attendance structure so state.attendance[activeDate] is always available
    const rawAttendance = parsed.attendance || {};
    let normalizedAttendance: Record<string, Record<string, boolean>> = {};

    if (rawAttendance[activeDate]) {
      normalizedAttendance = rawAttendance;
    } else {
      const keys = Object.keys(rawAttendance);
      const isFlat = keys.some(k => !k.match(/^\d{4}-\d{2}-\d{2}$/));
      if (isFlat) {
        normalizedAttendance = { [activeDate]: rawAttendance };
      } else {
        normalizedAttendance = rawAttendance;
      }
    }

    return {
      ...parsed,
      selectedDate: activeDate,
      intervals: normalizedIntervals,
      attendance: normalizedAttendance,
    };
  } catch (err) {
    console.error('Failed to decode shared state:', err);
    return null;
  }
}

/**
 * Finds the most recent date prior to `currentDate` that has break interval assignments recorded in `state.intervals`.
 */
export function getPreviousRecordedIntervalDate(state: AppState, currentDate: string): string | null {
  const directPrev = getAdjacentDate(currentDate, -1);
  if (state.intervals && state.intervals[directPrev] && Object.keys(state.intervals[directPrev]).length > 0) {
    const hasAssignments = Object.values(state.intervals[directPrev]).some((arr) => arr && arr.length > 0);
    if (hasAssignments) return directPrev;
  }

  if (!state.intervals) return null;
  const dates = Object.keys(state.intervals)
    .filter((d) => d < currentDate && Object.values(state.intervals[d] || {}).some((arr) => arr && arr.length > 0))
    .sort()
    .reverse();

  return dates.length > 0 ? dates[0] : null;
}

export interface BreakRotationExecutionResult {
  intervals: Record<string, string[]>;
  rotations: Record<string, BreakRotationInfo>;
  referenceDateUsed: string;
  totalRotated: number;
  totalNew: number;
}

/**
 * Generates break interval assignments following a strict cyclical rotation policy:
 * If a collaborator was in slot index `i` on the previous day, they will be assigned
 * to slot index `(i + 1) % TotalSlots` on the target day.
 * If they had no prior break recorded, they are assigned to maintain slot balance.
 */
export function calculateRotatingBreaks(
  state: AppState,
  options?: {
    referenceDate?: string;
    selectedShift?: string;
  }
): BreakRotationExecutionResult {
  const dateKey = state.selectedDate || getTodayISO();
  const breaks = [...state.breaks];
  const result: Record<string, string[]> = Object.fromEntries(breaks.map((b) => [b.id, []]));
  const rotations: Record<string, BreakRotationInfo> = {};

  if (breaks.length === 0) {
    return {
      intervals: result,
      rotations: {},
      referenceDateUsed: '',
      totalRotated: 0,
      totalNew: 0,
    };
  }

  // Determine reference date (yesterday or closest previous date with data)
  const referenceDate = options?.referenceDate || getPreviousRecordedIntervalDate(state, dateKey) || getAdjacentDate(dateKey, -1);
  const prevDayIntervals = state.intervals?.[referenceDate] || {};

  // Sort break slots chronologically (e.g. 11:00, 11:30, 12:00, 12:30)
  const sortedBreaks = [...breaks].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  // 1. Filter only active, present collaborators for target date
  const activePeople = state.collaborators.filter((c) => {
    const hasAbsence = (c.absences || []).some((a) => dateKey >= a.startDate && dateKey <= a.endDate);
    const off = isScaleOff(state.calendar, dateKey, c.scale);
    const manual = state.attendance[dateKey]?.[c.id];
    if (hasAbsence) return false;
    if (manual !== undefined) {
      if (typeof manual === 'boolean') return manual;
      if (typeof manual === 'object' && manual.absent) return false;
      return true;
    }
    return !off;
  });

  let totalRotated = 0;
  let totalNew = 0;

  // Build lookup of previous slot for each collaborator on referenceDate
  const prevSlotMap = new Map<string, { slotId: string; slotTime: string; index: number }>();
  Object.entries(prevDayIntervals).forEach(([slotId, collabIds]) => {
    const slotObj = breaks.find((b) => b.id === slotId);
    const slotTime = slotObj?.time || '';
    const idx = sortedBreaks.findIndex((b) => b.id === slotId);
    (collabIds || []).forEach((cId) => {
      prevSlotMap.set(cId, { slotId, slotTime, index: idx });
    });
  });

  // Track load count per slot
  const slotLoad: Record<string, number> = Object.fromEntries(breaks.map((b) => [b.id, 0]));

  activePeople.forEach((person, personIdx) => {
    // Filter breaks eligible for person's shift
    const eligibleBreaks = sortedBreaks.filter(
      (b) => !b.shift || b.shift === 'Geral' || b.shift === person.shift
    );
    const pool = eligibleBreaks.length > 0 ? eligibleBreaks : sortedBreaks;
    const poolLength = pool.length;

    const prevAssignment = prevSlotMap.get(person.id);

    let chosenSlot: typeof pool[0];
    let wasNew = false;
    let prevIdx = -1;
    let prevTime = '';
    let prevSlotId = '';

    if (prevAssignment && prevAssignment.index !== -1) {
      // Find current index in eligible pool
      const poolPrevIdx = pool.findIndex((b) => b.id === prevAssignment.slotId || b.time === prevAssignment.slotTime);
      const effectivePrevIdx = poolPrevIdx !== -1 ? poolPrevIdx : prevAssignment.index;

      // ROTATION FORMULA: next slot = (prev + 1) % poolLength
      const nextIdx = (effectivePrevIdx + 1) % poolLength;
      chosenSlot = pool[nextIdx];
      prevIdx = effectivePrevIdx;
      prevTime = prevAssignment.slotTime;
      prevSlotId = prevAssignment.slotId;
      totalRotated++;
    } else {
      // Not present yesterday: distribute deterministically or pick least-loaded slot in pool
      wasNew = true;
      totalNew++;

      // Pick slot with least load in pool, with offset tiebreak
      let minLoad = Infinity;
      let candidates: typeof pool = [];
      pool.forEach((slot) => {
        const load = slotLoad[slot.id] || 0;
        if (load < minLoad) {
          minLoad = load;
          candidates = [slot];
        } else if (load === minLoad) {
          candidates.push(slot);
        }
      });

      const offset = personIdx % Math.max(1, candidates.length);
      chosenSlot = candidates[offset] || pool[0];
    }

    if (chosenSlot) {
      result[chosenSlot.id].push(person.id);
      slotLoad[chosenSlot.id] = (slotLoad[chosenSlot.id] || 0) + 1;

      const currentIdx = pool.findIndex((b) => b.id === chosenSlot.id);
      rotations[person.id] = {
        collaboratorId: person.id,
        collaboratorName: person.name,
        prevDate: referenceDate,
        prevSlotId,
        prevSlotTime: prevTime,
        prevIndex: prevIdx,
        currentSlotId: chosenSlot.id,
        currentSlotTime: chosenSlot.time,
        currentIndex: currentIdx,
        rotationDelta: 1,
        wasNewOrAbsent: wasNew,
      };
    }
  });

  return {
    intervals: result,
    rotations,
    referenceDateUsed: referenceDate,
    totalRotated,
    totalNew,
  };
}

export interface ContextualSearchIntent {
  rawQuery: string;
  cleanQuery: string;
  detectedScale?: string; // 'A' | 'B' | 'C' | 'D'
  detectedShift?: string; // 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'Noite'
  detectedStatus?: string; // 'presente' | 'atraso' | 'folga' | 'ausente' | 'atestado' | 'ferias'
  detectedTL?: string;
  isPersonalScope?: boolean; // query involves "eu", "meu", "minha", "minhas", "meus"
  summaryLabel?: string;
  summaryDescription?: string;
}

/**
 * Analyzes search input to detect high-level semantic intents such as:
 * - "turma b", "grupo b", "escala b" -> Scale group B
 * - "t2", "turno 2", "turno noite" -> Shift T2
 * - "meu time", "minhas tarefas", "meu intervalo" -> Personal context
 * - "presentes", "atrasos", "folgas" -> Presence status
 */
export function parseSearchIntent(rawQuery: string, identifiedUser?: Collaborator | null): ContextualSearchIntent {
  const norm = normalizeSearchText(rawQuery);
  const result: ContextualSearchIntent = {
    rawQuery,
    cleanQuery: norm,
  };

  if (!norm) return result;

  // 1. Detect Scale / Turma
  const turmaMatch = norm.match(/\b(?:turma|grupo|escala|turmas|grupos)\s*([abcd])\b/i) || norm.match(/^([abcd])\s*(?:turma|escala|grupo)$/i);
  if (turmaMatch) {
    result.detectedScale = turmaMatch[1].toUpperCase();
    result.summaryLabel = `Turma ${result.detectedScale}`;
    result.summaryDescription = `Exibindo colaboradores e atribuições pertencentes à Turma ${result.detectedScale}.`;
  } else if (/^(turma\s*a|escala\s*a)$/i.test(norm)) {
    result.detectedScale = 'A';
    result.summaryLabel = 'Turma A';
    result.summaryDescription = 'Exibindo colaboradores e atribuições pertencentes à Turma A.';
  } else if (/^(turma\s*b|escala\s*b)$/i.test(norm)) {
    result.detectedScale = 'B';
    result.summaryLabel = 'Turma B';
    result.summaryDescription = 'Exibindo colaboradores e atribuições pertencentes à Turma B.';
  } else if (/^(turma\s*c|escala\s*c)$/i.test(norm)) {
    result.detectedScale = 'C';
    result.summaryLabel = 'Turma C';
    result.summaryDescription = 'Exibindo colaboradores e atribuições pertencentes à Turma C.';
  } else if (/^(turma\s*d|escala\s*d)$/i.test(norm)) {
    result.detectedScale = 'D';
    result.summaryLabel = 'Turma D';
    result.summaryDescription = 'Exibindo colaboradores e atribuições pertencentes à Turma D.';
  }

  // 2. Detect Shift / Turno
  const shiftMatch = norm.match(/\b(?:turno|turnos|shift)\s*(t?[1-5]|noite|manha|tarde|geral)\b/i) || norm.match(/\b(t[1-5])\b/i);
  if (shiftMatch) {
    let sVal = shiftMatch[1].toUpperCase();
    if (!sVal.startsWith('T') && /^[1-5]$/.test(sVal)) sVal = `T${sVal}`;
    result.detectedShift = sVal;
    result.summaryLabel = result.summaryLabel ? `${result.summaryLabel} • Turno ${sVal}` : `Turno ${sVal}`;
    result.summaryDescription = `Filtrando resultados do Turno ${sVal}.`;
  }

  // 3. Detect Status
  if (/\b(?:presentes?|presente)\b/i.test(norm)) {
    result.detectedStatus = 'presente';
    result.summaryLabel = result.summaryLabel ? `${result.summaryLabel} • Presentes` : 'Presentes';
    result.summaryDescription = 'Filtrando colaboradores com status de presença confirmado.';
  } else if (/\b(?:atrasos?|atrasados?)\b/i.test(norm)) {
    result.detectedStatus = 'atraso';
    result.summaryLabel = result.summaryLabel ? `${result.summaryLabel} • Atrasos` : 'Atrasos';
    result.summaryDescription = 'Filtrando colaboradores registrados em atraso.';
  } else if (/\b(?:folgas?|de folga)\b/i.test(norm)) {
    result.detectedStatus = 'folga';
    result.summaryLabel = result.summaryLabel ? `${result.summaryLabel} • Folgas` : 'Folgas';
    result.summaryDescription = 'Filtrando colaboradores em dia de folga pela escala.';
  } else if (/\b(?:ferias|férias)\b/i.test(norm)) {
    result.detectedStatus = 'ferias';
    result.summaryLabel = result.summaryLabel ? `${result.summaryLabel} • Férias` : 'Férias';
    result.summaryDescription = 'Filtrando colaboradores em período de férias.';
  } else if (/\b(?:atestados?)\b/i.test(norm)) {
    result.detectedStatus = 'atestado';
    result.summaryLabel = result.summaryLabel ? `${result.summaryLabel} • Atestados` : 'Atestados';
    result.summaryDescription = 'Filtrando colaboradores afastados por atestado médico.';
  } else if (/\b(?:ausentes?|faltas?)\b/i.test(norm)) {
    result.detectedStatus = 'ausente';
    result.summaryLabel = result.summaryLabel ? `${result.summaryLabel} • Ausências` : 'Ausências';
    result.summaryDescription = 'Filtrando colaboradores ausentes / faltas.';
  }

  // 4. Detect Personal Context (eu, meu, minha, minhas, meus)
  if (/\b(?:eu|meu|meus|minha|minhas|comigo|me|meu time|minha equipe|minha tarefa|meu intervalo|minha escala)\b/i.test(norm)) {
    result.isPersonalScope = true;
    if (identifiedUser) {
      result.summaryLabel = `👤 Seu Contexto: ${identifiedUser.name}`;
      result.summaryDescription = `Priorizando tarefas, equipe e intervalos vinculados a ${identifiedUser.name}.`;
    } else {
      result.summaryDescription = 'Buscando tarefas e itens vinculados ao seu perfil.';
    }
  }

  // 5. Detect Team Leader
  const tlMatch = norm.match(/\b(?:tl|lider|líder|time\s*do|time\s*da|equipe\s*do|equipe\s*da)\s+([a-z]+)\b/i);
  if (tlMatch) {
    result.detectedTL = tlMatch[1];
    result.summaryLabel = result.summaryLabel ? `${result.summaryLabel} • TL ${tlMatch[1]}` : `Líder / TL ${tlMatch[1]}`;
    result.summaryDescription = `Exibindo colaboradores e tarefas subordinados à liderança de ${tlMatch[1]}.`;
  }

  if (result.summaryLabel && !result.summaryDescription) {
    result.summaryDescription = `Resultados contextuais para ${result.summaryLabel}.`;
  }

  return result;
}

