import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Shuffle,
  Sparkles,
  Scale,
  Shield,
  RotateCw,
  X,
  Check,
  Users,
  Layers,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { AutoAssignOptions, AutoAssignStrategy } from '../types';

interface AutoAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (options: AutoAssignOptions) => void;
  presentCount: number;
  activeTasksCount: number;
  tasksWithSkillsCount: number;
  highPriorityTasksCount: number;
}

export const AutoAssignModal: React.FC<AutoAssignModalProps> = ({
  isOpen,
  onClose,
  onExecute,
  presentCount,
  activeTasksCount,
  tasksWithSkillsCount,
  highPriorityTasksCount,
}) => {
  const [strategy, setStrategy] = useState<AutoAssignStrategy>('balanced');
  const [considerSkills, setConsiderSkills] = useState(true);
  const [considerRoles, setConsiderRoles] = useState(true);
  const [considerCategories, setConsiderCategories] = useState(true);
  const [considerPriorities, setConsiderPriorities] = useState(true);
  const [respectMinHeadcount, setRespectMinHeadcount] = useState(true);
  const [respectMaxHeadcount, setRespectMaxHeadcount] = useState(true);

  if (!isOpen) return null;

  const strategiesList: Array<{
    id: AutoAssignStrategy;
    title: string;
    description: string;
    icon: React.ReactNode;
    badge: string;
    badgeColor: string;
  }> = [
    {
      id: 'balanced',
      title: 'Balanceamento por Quantidade',
      description:
        'Distribui a equipe de forma homogênea e proporcional entre todas as tarefas ativas, evitando postos vazios ou sobrecarregados.',
      icon: <Scale className="w-5 h-5 text-blue-500" />,
      badge: 'Recomendado para o dia a dia',
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border-blue-300',
    },
    {
      id: 'skills',
      title: 'Distribuição Baseada em Habilidades',
      description:
        'Prioriza colocar os colaboradores com as skills e níveis exigidos diretamente nos postos especializados correspondentes.',
      icon: <Sparkles className="w-5 h-5 text-purple-500" />,
      badge: `${tasksWithSkillsCount} tarefas com skills`,
      badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200 border-purple-300',
    },
    {
      id: 'priority',
      title: 'Prioridade de Tarefas',
      description:
        'Garante o preenchimento primeiro dos postos de Alta Prioridade e metas mínimas antes de distribuir para tarefas secundárias.',
      icon: <Shield className="w-5 h-5 text-rose-500" />,
      badge: `${highPriorityTasksCount} alta prioridade`,
      badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300',
    },
    {
      id: 'rotation',
      title: 'Rotação de Colaboradores',
      description:
        'Alterna a ordem de alocação da equipe para promover o rodízio e variação de postos operacionais entre os colaboradores.',
      icon: <RotateCw className="w-5 h-5 text-emerald-500" />,
      badge: 'Rodízio Operacional',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300',
    },
  ];

  const handleRun = () => {
    onExecute({
      strategy,
      considerSkills,
      considerRoles,
      considerCategories,
      considerPriorities,
      respectMinHeadcount,
      respectMaxHeadcount,
      balanceDistribution: strategy === 'balanced',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--paper)] border border-[var(--line)] rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[var(--ink)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)] bg-[var(--bg)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center font-black shadow-md shrink-0">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Configurar Auto Dimensionamento</h3>
              <p className="text-xs text-[var(--muted)] font-medium">
                Escolha a estratégia inteligente de distribuição de tarefas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--line)] rounded-xl text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Operational Overview Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-6 py-3 bg-[var(--bg)] border-b border-[var(--line)] text-center shrink-0 text-xs">
          <div className="p-2 bg-[var(--paper)] rounded-xl border border-[var(--line)]">
            <span className="text-[10px] uppercase font-black text-[var(--muted)] block">Disponíveis</span>
            <span className="font-black text-sm text-[var(--ink)] flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5 text-emerald-500" />
              <span>{presentCount} presentes</span>
            </span>
          </div>
          <div className="p-2 bg-[var(--paper)] rounded-xl border border-[var(--line)]">
            <span className="text-[10px] uppercase font-black text-[var(--muted)] block">Postos Ativos</span>
            <span className="font-black text-sm text-[var(--ink)] flex items-center justify-center gap-1">
              <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>{activeTasksCount} tarefas</span>
            </span>
          </div>
          <div className="p-2 bg-[var(--paper)] rounded-xl border border-[var(--line)]">
            <span className="text-[10px] uppercase font-black text-[var(--muted)] block">Com Skills</span>
            <span className="font-black text-sm text-[var(--ink)] flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>{tasksWithSkillsCount} postos</span>
            </span>
          </div>
          <div className="p-2 bg-[var(--paper)] rounded-xl border border-[var(--line)]">
            <span className="text-[10px] uppercase font-black text-[var(--muted)] block">Média / Posto</span>
            <span className="font-black text-sm text-[var(--ink)] flex items-center justify-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{activeTasksCount > 0 ? (presentCount / activeTasksCount).toFixed(1) : '0'}</span>
            </span>
          </div>
        </div>

        {/* Strategies Options */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider">
              Estratégia de Distribuição
            </label>
            <div className="space-y-2.5">
              {strategiesList.map((st) => {
                const isSelected = strategy === st.id;
                return (
                  <div
                    key={st.id}
                    onClick={() => setStrategy(st.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                      isSelected
                        ? 'bg-[var(--primary-soft)] border-[var(--primary)] shadow-sm'
                        : 'bg-[var(--bg)] border-[var(--line)] hover:border-[var(--muted)]'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl border shrink-0 ${
                        isSelected ? 'bg-[var(--paper)] border-[var(--primary)] shadow-xs' : 'bg-[var(--paper)] border-[var(--line)]'
                      }`}
                    >
                      {st.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-black text-[var(--ink)]">{st.title}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${st.badgeColor}`}>
                          {st.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--muted)] mt-1 leading-snug">{st.description}</p>
                    </div>
                    <div className="shrink-0 pt-0.5">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--muted)]'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Refinement Options (Toggles) */}
          <div className="bg-[var(--bg)] p-4 rounded-2xl border border-[var(--line)] space-y-3">
            <span className="text-xs font-black text-[var(--ink)] uppercase tracking-wider block">
              Regras e Restrições de Alocação
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-[var(--paper)] border border-[var(--line)]">
                <input
                  type="checkbox"
                  checked={considerSkills}
                  onChange={(e) => setConsiderSkills(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--primary)] cursor-pointer"
                />
                <div>
                  <span className="font-bold text-[11px] text-[var(--ink)] block">Considerar Skills</span>
                  <span className="text-[10px] text-[var(--muted)]">Encaixar quem tem as skills exigidas</span>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-[var(--paper)] border border-[var(--line)]">
                <input
                  type="checkbox"
                  checked={considerRoles}
                  onChange={(e) => setConsiderRoles(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--primary)] cursor-pointer"
                />
                <div>
                  <span className="font-bold text-[11px] text-[var(--ink)] block">Respeitar Cargos</span>
                  <span className="text-[10px] text-[var(--muted)]">Filtrar cargos permitidos no posto</span>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-[var(--paper)] border border-[var(--line)]">
                <input
                  type="checkbox"
                  checked={respectMinHeadcount}
                  onChange={(e) => setRespectMinHeadcount(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--primary)] cursor-pointer"
                />
                <div>
                  <span className="font-bold text-[11px] text-[var(--ink)] block">Garantir Metas Mínimas</span>
                  <span className="text-[10px] text-[var(--muted)]">Priorizar tarefas com meta planejada</span>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-[var(--paper)] border border-[var(--line)]">
                <input
                  type="checkbox"
                  checked={considerPriorities}
                  onChange={(e) => setConsiderPriorities(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--primary)] cursor-pointer"
                />
                <div>
                  <span className="font-bold text-[11px] text-[var(--ink)] block">Prioridade Operacional</span>
                  <span className="text-[10px] text-[var(--muted)]">Preencher postos de alta prioridade</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--line)] bg-[var(--paper)] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[var(--bg)] hover:bg-[var(--line)] text-[var(--ink)] rounded-xl text-xs font-black cursor-pointer transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleRun}
            className="px-6 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs font-black cursor-pointer shadow-md transition-all flex items-center gap-2"
          >
            <Shuffle className="w-4 h-4" />
            <span>Executar Auto Dimensionamento</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
