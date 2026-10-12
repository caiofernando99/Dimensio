/**
 * Serviço de Integração de Feriados Nacionais e Regionais
 * Consulta a BrasilAPI com fallback para Nager.Date e cálculo astronômico/legal offline.
 */

export interface HolidayEntry {
  date: string; // YYYY-MM-DD
  name: string;
  type?: string;
  allowWork?: boolean;
}

/**
 * Calcula a data da Páscoa para um determinado ano (Algoritmo de Meeus/Jones/Butcher).
 */
function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Adiciona ou subtrai dias a partir de uma data ano-mês-dia.
 */
function offsetDate(year: number, month: number, day: number, offsetDays: number): string {
  const d = new Date(Date.UTC(year, month - 1, day + offsetDays));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}

/**
 * Feriados nacionais oficiais do Brasil calculados localmente (garante funcionamento offline 100%).
 */
export function getOfflineCalculatedBrazilianHolidays(year: number): HolidayEntry[] {
  const easter = getEasterSunday(year);

  // Datas móveis baseadas na Páscoa
  const carnavalTer = offsetDate(year, easter.month, easter.day, -47);
  const sextaFeiraSanta = offsetDate(year, easter.month, easter.day, -2);
  const pascoa = offsetDate(year, easter.month, easter.day, 0);
  const corpusChristi = offsetDate(year, easter.month, easter.day, 60);

  return [
    { date: `${year}-01-01`, name: 'Confraternização Universal (Ano Novo)', type: 'nacional' },
    { date: carnavalTer, name: 'Carnaval', type: 'facultativo' },
    { date: sextaFeiraSanta, name: 'Sexta-feira Santa (Paixão de Cristo)', type: 'nacional' },
    { date: pascoa, name: 'Páscoa', type: 'comemorativo' },
    { date: `${year}-04-21`, name: 'Tiradentes', type: 'nacional' },
    { date: `${year}-05-01`, name: 'Dia Mundial do Trabalho', type: 'nacional' },
    { date: corpusChristi, name: 'Corpus Christi', type: 'facultativo' },
    { date: `${year}-09-07`, name: 'Independência do Brasil', type: 'nacional' },
    { date: `${year}-10-12`, name: 'Nossa Senhora Aparecida (Padroeira do Brasil)', type: 'nacional' },
    { date: `${year}-11-02`, name: 'Finados', type: 'nacional' },
    { date: `${year}-11-15`, name: 'Proclamação da República', type: 'nacional' },
    { date: `${year}-11-20`, name: 'Dia Nacional de Zumbi e da Consciência Negra', type: 'nacional' },
    { date: `${year}-12-25`, name: 'Natal', type: 'nacional' },
  ].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Busca feriados oficiais brasileiros pela internet via BrasilAPI / Nager.Date com fallback resiliente.
 */
export async function fetchBrazilianHolidays(year: number): Promise<{ holidays: HolidayEntry[]; source: string }> {
  // 1. Tenta BrasilAPI (API pública gratuita de alta precisão no Brasil)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const holidays: HolidayEntry[] = data.map((item: any) => ({
          date: String(item.date),
          name: String(item.name || 'Feriado Nacional'),
          type: item.type ? String(item.type) : 'nacional',
          allowWork: false,
        }));
        return { holidays, source: 'BrasilAPI' };
      }
    }
  } catch {
    // Falha de rede da BrasilAPI — tenta fallback internacional
  }

  // 2. Tenta Nager.Date API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/BR`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const holidays: HolidayEntry[] = data.map((item: any) => ({
          date: String(item.date),
          name: String(item.localName || item.name || 'Feriado'),
          type: 'nacional',
          allowWork: false,
        }));
        return { holidays, source: 'Nager.Date API' };
      }
    }
  } catch {
    // Falha de rede externa
  }

  // 3. Fallback inteligente e completo calculado offline
  const offlineHolidays = getOfflineCalculatedBrazilianHolidays(year);
  return { holidays: offlineHolidays, source: 'Calendário Oficial Calculado' };
}
