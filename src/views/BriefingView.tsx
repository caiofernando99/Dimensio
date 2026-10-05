import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Play, Printer, Check } from 'lucide-react';
import { PageHeader, Card, Button } from '../components/ui';
import type { BriefKind } from '../briefing/types';
import { defaultDeck, createSlide } from '../briefing/deck';
import { Organizer, kindLabel } from '../briefing/Organizer';
import { SlideSettings } from '../briefing/SlideSettings';
import { SlideFrame } from '../briefing/SlideFrame';
import { SlideCanvas } from '../briefing/SlideCanvas';
import { PresentMode } from '../briefing/PresentMode';
import { formatDateLongBR } from '../utils/helpers';

/**
 * Montador de slides v2 — refeito do zero.
 *
 * Um conceito só (slide com tipo + camadas), três passos visíveis:
 * 1. organizar (lista à esquerda), 2. ajustar (prévia + painel),
 * 3. apresentar. Tudo salva automaticamente — sem botão "salvar",
 * sem modos Camadas x Elementos, sem atalhos de teclado conflitantes.
 */
export const BriefingView: React.FC = () => {
  const {
    state,
    showNotice,
    createAutoBackup,
    setBriefDeck,
    briefingUpdateSlide,
    briefingPatchSlideData,
    briefingMoveSlide,
    briefingToggleSlide,
    briefingDuplicateSlide,
    briefingRemoveSlide,
    briefingSetLayers,
  } = useApp();

  const deck = useMemo(() => state.briefDeck || defaultDeck(), [state.briefDeck]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);

  const active = deck.slides.find((s) => s.id === activeId) || deck.slides[0];
  const enabledSlides = useMemo(() => deck.slides.filter((s) => s.enabled), [deck.slides]);

  // Migração limpa (uma vez): arquiva a apresentação antiga em backup.
  useEffect(() => {
    try {
      if (localStorage.getItem('dimensio_brief_v2_seen')) return;
      localStorage.setItem('dimensio_brief_v2_seen', '1');
      const oldCount = ((state.briefingConfig as any)?.slideOrder || []).length;
      if (oldCount > 0) {
        createAutoBackup('Montador refeito — apresentação anterior arquivada');
        showNotice(
          'Montador refeito do zero! Sua apresentação anterior foi guardada num backup automático. Monte a nova em 3 passos: organizar, ajustar e apresentar.'
        );
      }
    } catch {
      // storage indisponível
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = (kind: BriefKind) => {
    const slide = createSlide(kind);
    setBriefDeck({ ...deck, slides: [...deck.slides, slide], updatedAt: new Date().toISOString() });
    setActiveId(slide.id);
    showNotice(`Slide "${slide.title}" adicionado!`);
  };

  const handleRemove = (id: string) => {
    if (deck.slides.length <= 1) {
      showNotice('A apresentação precisa de ao menos um slide. Oculte em vez de excluir.');
      return;
    }
    const target = deck.slides.find((s) => s.id === id);
    if (!window.confirm(`Excluir o slide "${target?.title || ''}"? As camadas dele serão perdidas.`)) return;
    const idx = deck.slides.findIndex((s) => s.id === id);
    const neighbor = deck.slides[idx + 1] || deck.slides[idx - 1];
    briefingRemoveSlide(id);
    if (active?.id === id && neighbor) setActiveId(neighbor.id);
  };

  const toggleSection = (sectionId: string) => {
    if (!active) return;
    const hidden = active.hiddenSections.includes(sectionId)
      ? active.hiddenSections.filter((s) => s !== sectionId)
      : [...active.hiddenSections, sectionId];
    briefingUpdateSlide(active.id, { hiddenSections: hidden });
  };

  const startPresenting = (fromId?: string) => {
    const idx = fromId ? enabledSlides.findIndex((s) => s.id === fromId) : 0;
    setPresentIndex(Math.max(0, idx));
    setPresenting(true);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <PageHeader
        icon={Play}
        title="Montador de slides"
        subtitle={`Briefing de ${formatDateLongBR(state.selectedDate)} • ${state.teamName || 'Equipe'} • salvo automaticamente`}
        actions={
          <>
            <Button size="sm" variant="outline" icon={Printer} onClick={() => window.print()} title="Imprime todos os slides ativos">
              Imprimir
            </Button>
            <Button size="sm" icon={Play} onClick={() => startPresenting(active?.id)} title="Apresentar em tela cheia">
              Apresentar
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start print:hidden">
        {/* 1. ORGANIZAR */}
        <Card className="lg:col-span-3 p-3">
          <Organizer
            deck={deck}
            activeId={active?.id || ''}
            onSelect={setActiveId}
            onToggle={briefingToggleSlide}
            onMove={briefingMoveSlide}
            onDuplicate={(id) => {
              briefingDuplicateSlide(id);
              showNotice('Slide duplicado!');
            }}
            onRemove={handleRemove}
            onAdd={handleAdd}
          />
        </Card>

        {/* 2. PRÉVIA + CAMADAS */}
        <Card className="lg:col-span-6 p-3 space-y-2">
          {active ? (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--line)] text-[var(--muted)]">
                    {kindLabel(active.kind)}
                  </span>
                  <span className="text-xs font-black text-[var(--ink)] truncate">{active.title}</span>
                </div>
                <Button size="sm" variant="ghost" icon={Play} onClick={() => startPresenting(active.id)} title="Apresentar a partir deste slide">
                  Daqui
                </Button>
              </div>
              <SlideCanvas slide={active} onLayers={(layers) => briefingSetLayers(active.id, layers)} />
              <p className="text-[10px] text-[var(--muted)] font-semibold flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-500" /> Tudo aqui salva sozinho — clique no slide para selecionar, arraste para mover.
              </p>
            </>
          ) : (
            <p className="text-xs text-[var(--muted)] italic">Nenhum slide — adicione o primeiro na lista.</p>
          )}
        </Card>

        {/* 3. AJUSTAR */}
        <Card className="lg:col-span-3 p-3">
          {active ? (
            <SlideSettings
              slide={active}
              onTitle={(title) => briefingUpdateSlide(active.id, { title })}
              onData={(data) => briefingPatchSlideData(active.id, data)}
              onTheme={(theme) => briefingUpdateSlide(active.id, { theme: { ...active.theme, ...theme } })}
              onToggleSection={toggleSection}
            />
          ) : (
            <p className="text-xs text-[var(--muted)] italic">Selecione um slide para ajustar.</p>
          )}
        </Card>
      </div>

      {/* IMPRESSÃO: todos os slides ativos, um por página */}
      <div className="hidden print:block space-y-6">
        {enabledSlides.map((s) => (
          <div key={s.id} style={{ breakInside: 'avoid' }}>
            <SlideFrame slide={s} />
          </div>
        ))}
      </div>

      {presenting && enabledSlides.length > 0 && (
        <PresentMode slides={enabledSlides} startIndex={presentIndex} onExit={() => setPresenting(false)} />
      )}
    </div>
  );
};
