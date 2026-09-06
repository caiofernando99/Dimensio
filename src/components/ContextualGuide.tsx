import React from 'react';
import {
  X,
  SlidersHorizontal,
  LayoutDashboard,
  Users,
  UserPlus,
  Search,
  CheckSquare,
  CalendarDays,
  Calendar,
  Clock,
  FileSpreadsheet,
  Share2,
  FileText,
  Settings,
  Palette,
  Briefcase,
  ListChecks,
  Layers,
  Presentation,
  Eye,
  Copy,
  Download,
  RefreshCw,
  Sparkles,
  Undo2,
  Trash2,
  Pencil,
  HelpCircle,
  Shield,
  Cloud,
  GripVertical,
  CheckCircle2,
  Wand2,
} from 'lucide-react';

type LucideIcon = React.ComponentType<{ className?: string }>;

interface GuideItem {
  icon: LucideIcon;
  label: string;
  description: string;
}

interface GuideContent {
  title: string;
  subtitle: string;
  items: GuideItem[];
}

const GUIDE_CONTENT: Record<string, GuideContent> = {
  home: {
    title: 'Visão Geral da Operação',
    subtitle: 'Painel principal para acompanhar a equipe no dia selecionado.',
    items: [
      {
        icon: SlidersHorizontal,
        label: 'Filtros de Turno e Time / TL',
        description: 'Use os seletores no topo da tela para visualizar apenas a equipe do seu turno e do seu Time / Team Leader.',
      },
      {
        icon: LayoutDashboard,
        label: 'Resumo Operacional do Dia',
        description: 'Cartões com Presentes, Férias, Licenças, Treinamento e Ausências resumem a situação da operação em um olhar.',
      },
      {
        icon: CheckCircle2,
        label: 'Atalhos para os módulos',
        description: 'Clique nos cartões ou atalhos para navegar rapidamente até Presença, Dimensionamento, Intervalos e demais telas.',
      },
    ],
  },
  calendar: {
    title: 'Calendário Anual da Escala 6x2',
    subtitle: 'Visualize o ciclo de trabalho e folga de cada colaborador.',
    items: [
      {
        icon: CalendarDays,
        label: 'Grade mensal',
        description: 'Navegue entre os meses e veja os dias de trabalho e folga de cada colaborador conforme o ciclo 6x2.',
      },
      {
        icon: Wand2,
        label: 'Sugestão oficial de escala',
        description: 'O botão "Preencher calendário com a sugestão oficial" aplica o padrão 6x2 automaticamente para o ano.',
      },
      {
        icon: Users,
        label: 'Dias por colaborador',
        description: 'Cada linha mostra o status do dia — trabalhando, folga de escala ou afastamento programado.',
      },
    ],
  },
  team: {
    title: 'Equipe & Cadastros',
    subtitle: 'Gerencie os colaboradores, cargos, categorias e times.',
    items: [
      {
        icon: UserPlus,
        label: 'Adicionar colaborador',
        description: 'Cadastre novos colaboradores informando turno, escala, cargo, categoria e Time / Team Leader.',
      },
      {
        icon: Search,
        label: 'Busca e filtros',
        description: 'Localize rapidamente por nome e filtre por Turno, Cargo, Categoria e Time.',
      },
      {
        icon: Pencil,
        label: 'Edição inline',
        description: 'Altere turno, escala, cargo e categoria direto na tabela usando os seletores de cada linha.',
      },
      {
        icon: Shield,
        label: 'Lixeira de segurança',
        description: 'Colaboradores removidos ficam retidos por 60 dias na Lixeira, podendo ser restaurados se necessário.',
      },
    ],
  },
  presence: {
    title: 'Presença de Hoje',
    subtitle: 'Registre a presença e os afastamentos do dia.',
    items: [
      {
        icon: SlidersHorizontal,
        label: 'Agrupamento da lista',
        description: 'Organize os colaboradores por Cargo, Categoria, Time Leader ou em uma lista Geral.',
      },
      {
        icon: CheckSquare,
        label: 'Marcar presença',
        description: 'Marque as caixas dos colaboradores presentes no dia. Desmarque para registrar a ausência.',
      },
      {
        icon: ListChecks,
        label: 'Motivo da ausência',
        description: 'Ao desmarcar, escolha o motivo (Atestado, Banco de Horas, Falta Injustificada) para gerar o registro correto.',
      },
      {
        icon: FileText,
        label: 'Cartões laterais',
        description: 'Os cartões à direita mostram Presentes, Férias, Licenças/Treinamento e Ausências com motivos preenchidos.',
      },
    ],
  },
  assignment: {
    title: 'Dimensionamento de Tarefas',
    subtitle: 'Aloque colaboradores nos postos e tarefas da operação.',
    items: [
      {
        icon: Briefcase,
        label: 'Tarefas e postos',
        description: 'Cada tarefa possui uma meta de colaboradores. Ajuste o dimensionamento por tarefa e posto.',
      },
      {
        icon: Wand2,
        label: 'Modo Guiado Passo a Passo',
        description: 'Ative o assistente para alocar colaboradores tarefa por tarefa, de forma conduzida.',
      },
      {
        icon: SlidersHorizontal,
        label: 'Filtros por turno e time',
        description: 'Filtre quais colaboradores aparecem no dimensionamento conforme turno e Time / Team Leader.',
      },
      {
        icon: Undo2,
        label: 'Desfazer e limpar',
        description: 'Use o desfazer para reverter a última alteração ou limpe todo o dimensionamento quando necessário.',
      },
    ],
  },
  breaks: {
    title: 'Horários de Intervalo',
    subtitle: 'Configure os intervalos de café e refeição por escala.',
    items: [
      {
        icon: Clock,
        label: 'Horários por turno',
        description: 'Defina os horários de intervalo de cada escala (Grupos A, B, C, D) para o turno.',
      },
      {
        icon: RefreshCw,
        label: 'Escala de intervalos do dia',
        description: 'Ajuste os horários específicos do dia e sincronize com a presença dos colaboradores.',
      },
      {
        icon: Undo2,
        label: 'Desfazer e limpar',
        description: 'Reverta alterações rapidamente ou limpe a escala de intervalos do dia inteiro.',
      },
    ],
  },
  briefing: {
    title: 'Montagem de Slide',
    subtitle: 'Designe o briefing operacional do dia para apresentar à equipe.',
    items: [
      {
        icon: Layers,
        label: 'Slides do briefing',
        description: 'Edite os slides padrão (Capa, Operacional, Processos, Escala, QA) e adicione slides livres.',
      },
      {
        icon: GripVertical,
        label: 'Arrastar e redimensionar',
        description: 'Clique nos elementos do slide para selecioná-los, movê-los e ajustar o tamanho no preview.',
      },
      {
        icon: Palette,
        label: 'Elementos e fundo',
        description: 'Personalize cor de fundo, textos, tabelas, escalas e a identidade visual de cada slide.',
      },
      {
        icon: Presentation,
        label: 'Tela cheia e organização',
        description: 'Use o modo apresentação em tela cheia e organize a ordem dos slides pela barra superior.',
      },
    ],
  },
  share: {
    title: 'Resumo para Compartilhar',
    subtitle: 'Compartilhe a escala e sincronize com o Google Sheets.',
    items: [
      {
        icon: Copy,
        label: 'Copiar resumo do turno',
        description: 'Gere o resumo formatado do dia e copie para colar em grupos ou planilhas.',
      },
      {
        icon: Download,
        label: 'Exportar imagem',
        description: 'Baixe o resumo como imagem para compartilhar rapidamente.',
      },
      {
        icon: Cloud,
        label: 'Sincronização online',
        description: 'Conecte o Google Sheets e envie os dados da escala para a planilha compartilhada.',
      },
    ],
  },
  report: {
    title: 'Relatório Diário Operacional',
    subtitle: 'Consolide ocorrências e métricas do turno.',
    items: [
      {
        icon: FileText,
        label: 'Quadro de Ocorrências',
        description: 'Registre e visualize os eventos e observações gerais da operação no dia.',
      },
      {
        icon: LayoutDashboard,
        label: 'Dashboard Interativo',
        description: 'Clique nos cartões de status e nas barras de tarefas, cargos e categorias para detalhar as métricas.',
      },
      {
        icon: SlidersHorizontal,
        label: 'Filtros',
        description: 'Limpe ou refine o filtro aplicado para alternar entre a visão geral e o detalhe de cada grupo.',
      },
    ],
  },
  settings: {
    title: 'Configurações & Temas',
    subtitle: 'Personalize o aplicativo e gerencie os dados.',
    items: [
      {
        icon: Palette,
        label: 'Temas',
        description: 'Alterne entre os temas de cor e os modos claro e escuro da aplicação.',
      },
      {
        icon: Eye,
        label: 'Módulos visíveis',
        description: 'Escolha quais módulos aparecem no menu lateral, mantendo a tela enxuta para o seu time.',
      },
      {
        icon: Cloud,
        label: 'Planilha conectada',
        description: 'Gerencie a conexão com o Google Sheets e o banco de dados online compartilhado.',
      },
      {
        icon: RefreshCw,
        label: 'Backup e restauração',
        description: 'Exporte e importe backups dos dados locais para garantir a segurança das informações.',
      },
    ],
  },
  help: {
    title: 'Ajuda & Guia de Uso',
    subtitle: 'Documentação, tutorial e suporte da aplicação.',
    items: [
      {
        icon: Sparkles,
        label: 'Tutorial Interativo',
        description: 'Refaça a demonstração guiada do aplicativo quando precisar relembrar os passos iniciais.',
      },
      {
        icon: FileSpreadsheet,
        label: 'Guia de integração',
        description: 'Passo a passo completo para conectar o Google Sheets e ativar a sincronização automática.',
      },
      {
        icon: HelpCircle,
        label: 'Perguntas frequentes',
        description: 'Consulte as respostas para as dúvidas mais comuns sobre os módulos e recursos.',
      },
    ],
  },
};

interface ContextualGuideProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: string;
}

export const ContextualGuide: React.FC<ContextualGuideProps> = ({ isOpen, onClose, currentView }) => {
  const content = GUIDE_CONTENT[currentView] || GUIDE_CONTENT.home;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-[var(--line)] flex items-center justify-between gap-3 bg-[var(--bg)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-[var(--primary)] tracking-wider">
                Como usar esta tela
              </span>
              <h3 className="text-base font-extrabold text-[var(--ink)] leading-snug">{content.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--paper)] rounded-lg transition-colors cursor-pointer"
            title="Fechar Guia"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <p className="text-xs font-semibold text-[var(--muted)]">{content.subtitle}</p>

          <div className="space-y-2.5">
            {content.items.map((item) => {
              const IconComponent = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]"
                >
                  <div className="p-2 rounded-lg bg-[var(--paper)] border border-[var(--line)] text-[var(--primary)] shrink-0">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs font-black text-[var(--ink)]">{item.label}</div>
                    <div className="text-[11px] leading-relaxed text-[var(--muted)]">{item.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-[var(--line)] bg-[var(--bg)] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] text-xs font-black rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Entendi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
