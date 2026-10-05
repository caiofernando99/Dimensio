import React, { useState } from 'react';
import {
  Sparkles,
  Users,
  UserCheck,
  Calendar,
  FileText,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  Trash2,
  Play,
  SlidersHorizontal
} from 'lucide-react';

interface OnboardingTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectCloudData?: () => void;
}

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({
  isOpen,
  onClose,
  onConnectCloudData,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const slides = [
    {
      title: 'Bem-vindo ao Dimensio Operacional!',
      subtitle: 'Plataforma Integrada de Gestão de Escala, Turnos e Alocação',
      icon: Sparkles,
      iconBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--muted)]">
          <p>
            O <strong>Dimensio Operacional</strong> foi desenvolvido para facilitar o dia a dia de gestores e líderes de equipe em operações com turnos e escalas.
          </p>
          <div className="bg-[var(--bg)] p-3 rounded-xl border border-[var(--line)] space-y-2">
            <div className="font-bold text-[var(--ink)] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>O que você poderá fazer:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Controlar presença diária e folgas das turmas da sua operação.</li>
              <li>Filtrar dados rapidamente por <strong>Turno (T1 a T5)</strong> e por <strong>Team Leader (TL)</strong>.</li>
              <li>Gerenciar matriz de habilidades (**Expert, HV, OP.Maquina**) e cargos (**REP, PS, TL**).</li>
              <li>Dimensionar postos de trabalho e gerar o relatório diário do turno.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: 'Identificação por Turno, TL e Comando Secreto',
      subtitle: 'Controle de identificação simplificado e perfil gestor protegido',
      icon: SlidersHorizontal,
      iconBg: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--muted)]">
          <p>
            No modal de identificação, escolha seu nome com facilidade utilizando os filtros de <strong>Turno (T1 a T5)</strong> e <strong>Líder de Time (TL)</strong>.
          </p>
          <div className="bg-[var(--bg)] p-3 rounded-xl border border-[var(--line)] space-y-2">
            <div className="font-bold text-[var(--ink)] text-xs flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[10px] font-black uppercase">
                Comando Gestor Secreto
              </span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Para acessar como <strong>Administrador Geral (Master)</strong>, basta digitar <code className="bg-[var(--paper)] font-bold px-1.5 py-0.5 rounded border border-[var(--line)]">.</code> (ponto final) no campo de busca. O perfil master ficará visível para casos de recomposição de senha ou supervisão avançada.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Equipe, Cadastros & Lixeira de 60 Dias',
      subtitle: 'Cadastro padronizado e segurança contra exclusões acidentais',
      icon: Users,
      iconBg: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--muted)]">
          <p>
            Em <strong>Equipe e Cadastros</strong>, gerencie a lista oficial de colaboradores com dados específicos da sua operação:
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <li className="bg-[var(--bg)] p-2 rounded-lg border border-[var(--line)]">
              <strong className="block text-[var(--ink)] font-bold text-[11px]">Cargos</strong>
              <span>REP, PS, TL</span>
            </li>
            <li className="bg-[var(--bg)] p-2 rounded-lg border border-[var(--line)]">
              <strong className="block text-[var(--ink)] font-bold text-[11px]">Categorias</strong>
              <span>Inventario, Qualidade, Picking, Packing, Put-Away</span>
            </li>
            <li className="bg-[var(--bg)] p-2 rounded-lg border border-[var(--line)]">
              <strong className="block text-[var(--ink)] font-bold text-[11px]">Skills</strong>
              <span>Expert, HV, OP.Maquina</span>
            </li>
          </ul>
          <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <Trash2 className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>Lixeira de Segurança:</strong> Ao excluir um colaborador, o cadastro fica protegido na aba Lixeira por <strong>60 dias</strong>, com opção de restauração instantânea.
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Dimensionamento e Refeições',
      subtitle: 'Alocação por qualificações e escala das turmas sem estouro',
      icon: Calendar,
      iconBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--muted)]">
          <p>
            Com o módulo de <strong>Dimensionamento de Tarefas</strong> e <strong>Horários de Intervalo</strong>:
          </p>
          <div className="bg-[var(--bg)] p-3 rounded-xl border border-[var(--line)] space-y-2">
            <ul className="list-disc list-inside space-y-1">
              <li>Aloque pessoas de acordo com o cargo e a categoria permitidos.</li>
              <li>Ajuste horários de refeição para garantir cobertura do setor durante todo o turno.</li>
              <li>O sistema identifica automaticamente quem está de folga pela escala das turmas.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: 'Planilha Online & Relatório do Turno',
      subtitle: 'Sincronização transparente e geração de PDF',
      icon: FileText,
      iconBg: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-[var(--muted)]">
          <p>
            Mantenha o controle da operação com ferramentas de transparência:
          </p>
          <div className="bg-[var(--bg)] p-3 rounded-xl border border-[var(--line)] space-y-2">
            <p>
              <strong>Planilha Compartilhada:</strong> Conecte com a planilha oficial no Google Sheets para que outros gestores do mesmo turno também atualizem as informações em tempo real.
            </p>
            <p>
              <strong>Relatório Diário:</strong> No final do turno, gere o relatório consolidado com presença, ausências e observações do gestor para envio por e-mail ou impressão em PDF.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Tudo Pronto! Como deseja começar?',
      subtitle: 'Configure a sua operação',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
      content: (
        <div className="space-y-4 text-xs text-[var(--muted)]">
          <p className="text-sm font-semibold text-[var(--ink)]">
            A plataforma não inclui mais dados de exemplo: o cadastro começa vazio e você configura apenas com a sua equipe real, sem riscos de sincronização.
          </p>
          <div className="p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2">
            <span className="font-extrabold text-[var(--ink)] block">O que você gostaria de fazer agora?</span>
            <p>
              Você pode conectar a dados da nuvem (planilha compartilhada), importar um backup existente ou simplesmente começar a configurar a operação agora.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            {onConnectCloudData && (
              <button
                onClick={() => {
                  onClose();
                  onConnectCloudData();
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Conectar a Dados na Nuvem</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--bg)] text-[var(--ink)] text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Começar do zero
            </button>
          </div>
        </div>
      ),
    },
  ];

  const currentSlide = slides[currentStep];
  const IconComponent = currentSlide.icon;
  const isLastSlide = currentStep === slides.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-[var(--line)] flex items-center justify-between gap-3 bg-[var(--bg)]">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl font-bold ${currentSlide.iconBg}`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-[var(--primary)] tracking-wider">
                Passo {currentStep + 1} de {slides.length}
              </span>
              <h3 className="text-base font-extrabold text-[var(--ink)] leading-snug">
                {currentSlide.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--paper)] rounded-lg transition-colors cursor-pointer"
            title="Pular Tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <p className="text-xs font-semibold text-[var(--ink)]">
            {currentSlide.subtitle}
          </p>
          {currentSlide.content}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--bg)] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-xs font-extrabold text-[var(--muted)] hover:text-[var(--ink)] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Pular Tutorial
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentStep
                    ? 'w-6 bg-[var(--primary)]'
                    : 'bg-[var(--line)] hover:bg-[var(--muted)]'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-3 py-2 bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--bg)] text-[var(--ink)] text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
            )}

            {!isLastSlide ? (
              <button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="px-4 py-2 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] text-xs font-black rounded-xl shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Próximo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-black rounded-xl shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Concluir</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
