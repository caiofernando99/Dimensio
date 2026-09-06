import React from 'react';
import { useApp } from '../context/AppContext';
import { Clock, Check, Shield, Layers, Globe } from 'lucide-react';

interface SessionShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SessionShiftModal: React.FC<SessionShiftModalProps> = ({ isOpen, onClose }) => {
  const { state, updateTeamShift, setSelectedGlobalFilters, identifiedUser, showNotice } = useApp();

  if (!isOpen) return null;

  const availableShifts = (state.shifts && state.shifts.length > 0 ? state.shifts : ['T1', 'T2', 'T3', 'T4', 'T5'])
    .filter((s) => s && s.toLowerCase() !== 'geral' && s.toLowerCase() !== 'todos');
  const currentShift = state.teamShift || 'T1';

  const handleSelectShift = (shift: string) => {
    // 1. Update active shift in state
    updateTeamShift(shift);

    // 2. Store session shift in sessionStorage
    try {
      sessionStorage.setItem('escalapro_session_shift', shift);
    } catch {
      // Fallback
    }

    // 3. Auto-configure global filters for this shift
    if (shift === 'ALL' || shift === 'Geral' || shift === 'Todos') {
      setSelectedGlobalFilters({
        shift: '',
        teamLeader: state.selectedTLFilter || undefined,
      });
      showNotice('✅ Visão Geral ativada: exibindo dados do Setor Completo (Todos os Turnos)!');
    } else {
      setSelectedGlobalFilters({
        shift: shift,
        teamLeader: state.selectedTLFilter || undefined,
      });
      showNotice(`✅ Turno da sessão configurado para Turno ${shift}!`);
    }

    // 4. Update identified user's shift if active
    if (identifiedUser) {
      try {
        const updatedUser = { ...identifiedUser, shift };
        localStorage.setItem('escalapro_identified_user_v1', JSON.stringify(updatedUser));
      } catch {
        // Fallback
      }
    }

    onClose();
  };

  const isGeneralSelected = currentShift === 'ALL' || currentShift === 'Geral' || currentShift === 'Todos';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && sessionStorage.getItem('escalapro_session_shift')) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center mx-auto border border-[var(--primary-border)] shadow-xs">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-[var(--ink)] tracking-tight">
            Em qual Turno você irá trabalhar hoje?
          </h2>
          <p className="text-xs font-semibold text-[var(--muted)] leading-relaxed">
            Selecione o turno de atuação para filtrar automaticamente seus quadros, informações, pedidos e intervalos.
          </p>
        </div>

        {/* Option for Setor Completo (Visão Geral) for Managers / Full Sector View */}
        <button
          type="button"
          onClick={() => handleSelectShift('ALL')}
          className={`w-full p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between group ${
            isGeneralSelected
              ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30 text-[var(--ink)] font-black shadow-xs'
              : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-emerald-500 hover:bg-[var(--line)]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-extrabold flex items-center gap-1.5 text-[var(--ink)]">
                <span>Visão Geral (Setor Completo)</span>
                <span className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                  Gestão
                </span>
              </div>
              <span className="text-[10px] text-[var(--muted)] font-semibold block mt-0.5">
                Exibe todos os turnos, times, avisos e atalhos do setor
              </span>
            </div>
          </div>
          {isGeneralSelected && (
            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}
        </button>

        <div className="text-[11px] font-black text-[var(--muted)] tracking-wider uppercase px-0.5">
          OU SELECIONE UM TURNO ESPECÍFICO:
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {availableShifts.map((s) => {
            const isSelected = !isGeneralSelected && currentShift === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleSelectShift(s)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between group ${
                  isSelected
                    ? 'bg-[var(--primary-soft)] border-[var(--primary)] ring-2 ring-[var(--primary)]/30 text-[var(--ink)] font-black shadow-xs'
                    : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)] hover:bg-[var(--line)]'
                }`}
              >
                <div>
                  <div className="text-xs font-black flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Turno {s}</span>
                  </div>
                  <span className="text-[9.5px] text-[var(--muted)] font-extrabold block mt-0.5">
                    {isSelected ? 'Turno Ativo' : 'Clique para Escolher'}
                  </span>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[11px] font-bold text-[var(--muted)] flex items-center gap-2">
          <Shield className="w-4 h-4 text-[var(--primary)] shrink-0" />
          <span>Você poderá alterar a qualquer momento no indicador de turno do topo.</span>
        </div>
      </div>
    </div>
  );
};
