import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { BriefSlide } from './types';
import { getCollaboratorStatus, formatDateLongBR } from '../utils/helpers';
import { formatEmbedUrl, detectEmbedProvider, providerLabel } from './embed';
import { MarkdownContent } from '../components/MarkdownContent';

function visible(slide: BriefSlide, section: string): boolean {
  return !slide.hiddenSections.includes(section);
}

/* ------------------------------- CAPA ------------------------------- */

const CoverContent: React.FC<{ slide: BriefSlide }> = ({ slide }) => {
  const { state } = useApp();
  const d = slide.data;
  const dateStr = state.selectedDate;
  const present = useMemo(
    () =>
      state.collaborators.filter((c) => {
        const st = getCollaboratorStatus(c, dateStr, state).status;
        return st === 'presente' || st === 'atraso';
      }).length,
    [state, dateStr]
  );
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center px-[6%] py-[4%] text-white">
      {visible(slide, 'header') && (
        <div className="flex flex-col items-center gap-[0.6cqw]">
          <span
            className="text-[1.1cqw] font-black uppercase tracking-[0.25em] px-[1.2cqw] py-[0.4cqw] rounded-full"
            style={{ backgroundColor: `${slide.theme.accent}33`, color: '#fff', border: `1px solid ${slide.theme.accent}` }}
          >
            {d.kicker || 'Briefing operacional'}
          </span>
          <span className="text-[1.3cqw] font-bold text-white/80">
            {d.team || state.teamName || 'Equipe'} • {d.sectorShift || `${state.sector || 'Operação'} • ${state.teamShift || ''}`} •{' '}
            {formatDateLongBR(dateStr)}
          </span>
        </div>
      )}
      {visible(slide, 'title') && (
        <h1 className="text-[4.2cqw] font-black leading-tight mt-[1cqw] max-w-[90%]">
          {d.title || `Turno de ${state.teamShift || 'hoje'}`}
        </h1>
      )}
      {visible(slide, 'quote') && d.showQuote !== false && d.quote && (
        <div className="mt-[1.2cqw] max-w-[80%] px-[2cqw] py-[1cqw] rounded-2xl bg-white/10 border border-white/20">
          <p className="text-[1.6cqw] font-semibold italic text-white/95">“{d.quote}”</p>
        </div>
      )}
      {visible(slide, 'footer') && (
        <div className="mt-[1.4cqw] flex items-center gap-[2cqw] text-[1.2cqw] font-bold text-white/75">
          {d.showStats !== false && <span>👥 {present} presentes</span>}
          {d.showManager !== false && (state.manager || d.footerNote) && (
            <span>🧑‍💼 {state.manager || d.footerNote}</span>
          )}
          {d.footerNote && state.manager && <span>{d.footerNote}</span>}
        </div>
      )}
    </div>
  );
};

/* ------------------------------ ESCALA ------------------------------ */

const ScaleContent: React.FC<{ slide: BriefSlide }> = ({ slide }) => {
  const { state } = useApp();
  const d = slide.data;
  const dateStr = state.selectedDate;
  const compact = d.density === 'compact';

  const cards = useMemo(() => {
    const shiftF = state.selectedShiftFilter;
    const tasks = (state.tasks || []).filter((t) => {
      if (t.active === false) return false;
      if (shiftF && shiftF !== 'ALL' && shiftF !== 'todos' && t.shift && t.shift !== shiftF) return false;
      return true;
    });
    return tasks.map((t) => {
      const members = (t.members || [])
        .map((id) => state.collaborators.find((c) => c.id === id))
        .filter(Boolean)
        .map((c) => {
          const st = getCollaboratorStatus(c!, dateStr, state).status;
          const present = st === 'presente' || st === 'atraso';
          let interval = '';
          const dayInt = state.intervals?.[dateStr] || {};
          for (const [bid, ids] of Object.entries(dayInt)) {
            if ((ids || []).includes(c!.id)) {
              interval = state.breaks.find((b) => b.id === bid)?.time || '';
              break;
            }
          }
          return { id: c!.id, name: c!.name, present, interval };
        });
      const presentCount = members.filter((m) => m.present).length;
      return { task: t, members, presentCount };
    });
  }, [state, dateStr]);

  return (
    <div className="w-full h-full flex flex-col px-[3%] py-[2.5%] text-white">
      {visible(slide, 'header') && (
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[1cqw] font-black uppercase tracking-[0.2em]" style={{ color: slide.theme.accent }}>
              Escala do turno
            </div>
            <h2 className="text-[2.2cqw] font-black leading-tight">{d.title || 'Dimensionamento'}</h2>
            {d.subtitle && <p className="text-[1.1cqw] text-white/70 font-semibold">{d.subtitle}</p>}
          </div>
          <div className="text-[1.1cqw] font-bold text-white/70 text-right">
            {formatDateLongBR(dateStr)}
            <br />
            {cards.reduce((a, c) => a + c.presentCount, 0)} direcionados
          </div>
        </div>
      )}
      {visible(slide, 'grid') && (
        <div className={`flex-1 min-h-0 mt-[1cqw] grid gap-[0.8cqw] ${compact ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {cards.slice(0, compact ? 9 : 6).map(({ task, members, presentCount }) => (
            <div key={task.id} className="rounded-xl bg-white/8 border border-white/15 p-[0.8cqw] overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className={`${compact ? 'text-[1.05cqw]' : 'text-[1.25cqw]'} font-black truncate`}>{task.name}</span>
                <span
                  className="text-[0.95cqw] font-black px-[0.6cqw] py-[0.15cqw] rounded-full shrink-0"
                  style={{ backgroundColor: `${slide.theme.accent}44` }}
                >
                  {presentCount}
                </span>
              </div>
              <div className={`${compact ? 'text-[0.95cqw]' : 'text-[1.05cqw]'} text-white/85 font-semibold mt-[0.3cqw] leading-snug line-clamp-3`}>
                {members
                  .filter((m) => m.present)
                  .slice(0, compact ? 4 : 5)
                  .map((m) => `${m.name.split(' ')[0]}${m.interval ? ` (${m.interval})` : ''}`)
                  .join(' • ') || <span className="text-white/40 italic">sem alocação</span>}
              </div>
            </div>
          ))}
          {cards.length === 0 && (
            <div className="col-span-full flex items-center justify-center text-white/50 text-[1.2cqw] font-semibold">
              Nenhum posto montado — monte a escala na tela Dimensionamento.
            </div>
          )}
        </div>
      )}
      {visible(slide, 'footer') && d.footer && (
        <p className="mt-[0.8cqw] text-[1.05cqw] text-white/65 font-semibold truncate">{d.footer}</p>
      )}
    </div>
  );
};

/* --------------------------- EMBED / DOC ---------------------------- */

const EmbedContent: React.FC<{ slide: BriefSlide }> = ({ slide }) => {
  const d = slide.data;
  const url = (d.url || '').trim();
  if (!url) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center px-[6%] text-white">
        <div className="text-[2cqw]">🔗</div>
        <h2 className="text-[2cqw] font-black mt-[0.5cqw]">{d.label || 'Documento / apresentação'}</h2>
        <p className="text-[1.15cqw] text-white/65 font-semibold mt-[0.5cqw] max-w-[70%]">
          Cole o link de um PDF, Google Drive ou Google Apresentações nas configurações do slide.
          Aqui só fica salvo o link — o conteúdo continua no Google.
        </p>
      </div>
    );
  }
  const provider = detectEmbedProvider(url);
  const src = formatEmbedUrl(url, d.page || 1);
  return (
    <div className="w-full h-full flex flex-col px-[2.5%] py-[2%] text-white">
      {visible(slide, 'header') && (
        <div className="flex items-center justify-between gap-3 pb-[0.8cqw]">
          <h2 className="text-[1.8cqw] font-black truncate">{d.label || providerLabel(provider)}</h2>
          <span
            className="text-[0.95cqw] font-black px-[0.8cqw] py-[0.3cqw] rounded-full shrink-0"
            style={{ backgroundColor: `${slide.theme.accent}44` }}
          >
            {providerLabel(provider)}
          </span>
        </div>
      )}
      {visible(slide, 'viewer') && (
        <div className="flex-1 min-h-0 rounded-xl overflow-hidden bg-white border border-white/20">
          <iframe src={src} title={d.label || 'Documento'} className="w-full h-full border-0" allowFullScreen />
        </div>
      )}
    </div>
  );
};

/* ----------------------------- PROCESSO ----------------------------- */

const ProcessContent: React.FC<{ slide: BriefSlide }> = ({ slide }) => {
  const { state } = useApp();
  const list = state.processKnowledgeList || [];
  const card = list.find((c) => c.id === slide.data.cardId) || list[0];
  if (!card) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center px-[6%] text-white">
        <div className="text-[2cqw]">📋</div>
        <h2 className="text-[2cqw] font-black mt-[0.5cqw]">Reforço do processo</h2>
        <p className="text-[1.15cqw] text-white/65 font-semibold mt-[0.5cqw]">
          Cadastre cartões de processo para destacar um aqui.
        </p>
      </div>
    );
  }
  return (
    <div className="w-full h-full flex flex-col px-[4%] py-[3%] text-white">
      {visible(slide, 'header') && (
        <div className="text-[1cqw] font-black uppercase tracking-[0.2em]" style={{ color: slide.theme.accent }}>
          Reforço do processo
        </div>
      )}
      {visible(slide, 'card') && (
        <div className="flex-1 min-h-0 flex items-center gap-[2cqw] mt-[0.5cqw]">
          {card.imageUrl && (
            <img src={card.imageUrl} alt="" className="h-full max-h-full w-[38%] object-cover rounded-2xl border border-white/20" />
          )}
          <div className="flex-1 min-w-0">
            <span
              className="inline-block text-[1cqw] font-black uppercase tracking-wider px-[0.8cqw] py-[0.3cqw] rounded-full"
              style={{ backgroundColor: `${slide.theme.accent}44` }}
            >
              {card.type} • {card.category}
            </span>
            <h2 className="text-[2.6cqw] font-black leading-tight mt-[0.6cqw]">{card.title}</h2>
            <p className="text-[1.25cqw] text-white/80 font-medium mt-[0.6cqw] leading-snug line-clamp-4">{card.description}</p>
            {(card.keyTakeaways || []).length > 0 && (
              <ul className="mt-[0.8cqw] space-y-[0.3cqw]">
                {(card.keyTakeaways || []).slice(0, 3).map((k, i) => (
                  <li key={i} className="text-[1.15cqw] font-bold text-white/90">
                    ✅ {k}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------- QA -------------------------------- */

const QAContent: React.FC<{ slide: BriefSlide }> = ({ slide }) => {
  const d = slide.data;
  const questions = d.questions || [];
  return (
    <div className="w-full h-full flex flex-col px-[4%] py-[3%] text-white">
      {visible(slide, 'header') && (
        <div>
          <div className="text-[1cqw] font-black uppercase tracking-[0.2em]" style={{ color: slide.theme.accent }}>
            Para fechar
          </div>
          <h2 className="text-[2.6cqw] font-black leading-tight">{d.title || 'Perguntas & dúvidas'}</h2>
          {d.subtitle && <p className="text-[1.2cqw] text-white/70 font-semibold">{d.subtitle}</p>}
          {d.description && <p className="text-[1.1cqw] text-white/70 mt-[0.3cqw]">{d.description}</p>}
        </div>
      )}
      {visible(slide, 'questions') && (
        <ol className="mt-[1cqw] space-y-[0.6cqw]">
          {questions.slice(0, 5).map((q, i) => (
            <li key={i} className="flex items-start gap-[0.8cqw] bg-white/8 border border-white/15 rounded-xl px-[1.2cqw] py-[0.7cqw]" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
              <span
                className="text-[1.1cqw] font-black w-[2cqw] h-[2cqw] rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: slide.theme.accent }}
              >
                {i + 1}
              </span>
              <span className="text-[1.35cqw] font-bold">{q}</span>
            </li>
          ))}
          {questions.length === 0 && (
            <li className="text-[1.2cqw] text-white/50 font-semibold italic">Adicione perguntas nas configurações do slide.</li>
          )}
        </ol>
      )}
      {visible(slide, 'closing') && d.closing && (
        <p className="mt-auto pt-[0.8cqw] text-[1.25cqw] font-black text-center" style={{ color: slide.theme.accent }}>
          {d.closing}
        </p>
      )}
    </div>
  );
};

/* ------------------------------ AVISOS ------------------------------ */

const NoticeContent: React.FC<{ slide: BriefSlide }> = ({ slide }) => {
  const d = slide.data;
  const items = d.items || [];
  return (
    <div className="w-full h-full flex flex-col px-[4%] py-[3%] text-white">
      {visible(slide, 'header') && (
        <h2 className="text-[2.4cqw] font-black leading-tight flex items-center gap-[0.8cqw]">
          <span
            className="w-[2.6cqw] h-[2.6cqw] rounded-xl flex items-center justify-center text-[1.5cqw]"
            style={{ backgroundColor: slide.theme.accent }}
          >
            📢
          </span>
          {d.title || 'Avisos do turno'}
        </h2>
      )}
      {visible(slide, 'items') && (
        <ul className="mt-[1cqw] space-y-[0.7cqw]">
          {items.slice(0, 6).map((item, i) => (
            <li
              key={i}
              className="rounded-xl border border-white/15 px-[1.4cqw] py-[0.8cqw] text-[1.35cqw] font-semibold"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderLeft: `0.4cqw solid ${slide.theme.accent}` }}
            >
              <MarkdownContent content={item} onColored sizeClass="text-[1.35cqw]" />
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-[1.2cqw] text-white/50 font-semibold italic list-none">
              Adicione os recados do turno nas configurações do slide.
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

/* ------------------------------- ROOT ------------------------------- */

export const SlideContent: React.FC<{ slide: BriefSlide }> = ({ slide }) => {
  switch (slide.kind) {
    case 'cover':
      return <CoverContent slide={slide} />;
    case 'scale':
      return <ScaleContent slide={slide} />;
    case 'embed':
      return <EmbedContent slide={slide} />;
    case 'process':
      return <ProcessContent slide={slide} />;
    case 'qa':
      return <QAContent slide={slide} />;
    case 'notice':
      return <NoticeContent slide={slide} />;
    case 'blank':
      return null;
  }
};
