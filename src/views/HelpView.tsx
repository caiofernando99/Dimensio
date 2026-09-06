import React, { useState } from 'react';
import {
  HelpCircle,
  FileSpreadsheet,
  Users,
  CheckSquare,
  Shuffle,
  Clock,
  Share2,
  FileText,
  Settings,
  Calendar,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Download,
  Database,
  Sparkles,
  ShieldAlert,
  Smartphone,
  Copy,
  Code,
  Check,
  MessageSquareText,
  Send,
  Keyboard,
  Search,
  Presentation,
  Sliders,
  Bell,
  RefreshCw,
  BookOpen,
  Puzzle,
  GitBranch,
  Radio,
  Mic,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Button,
  Tabs,
  Toolbar,
  Field,
  Textarea,
  Input,
} from '../components/ui';
import { APP_VERSION, BUILD_TS, GIT_COMMIT, APPS_SCRIPT_VERSION } from '../version';
import { useApp } from '../context/AppContext';
import { getAppsScriptCode } from '../utils/appsScriptCode';
import { downloadExtensionZip, isExtensionInstalled } from '../utils/extensionInstaller';

interface HelpViewProps {
  onOpenTutorial?: () => void;
}

export const HelpView: React.FC<HelpViewProps> = ({ onOpenTutorial }) => {
  const {
    state,
    generateTemplateSpreadsheet,
    exportTeamRosterSpreadsheet,
    showNotice,
    syncToOnlineSpreadsheet,
  } = useApp();

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [searchDocQuery, setSearchDocQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'radio' | 'modules' | 'shortcuts' | 'sheets' | 'extension' | 'faq'>('all');
  const [downloadingExt, setDownloadingExt] = useState(false);
  const [extInstalled, setExtInstalled] = useState<boolean>(() => isExtensionInstalled());

  const feedbackConfig = state.feedbackConfig;

  const handleSubmitFeedback = () => {
    const cfg = feedbackConfig;
    if (!cfg?.formUrl || !cfg.entryMessage) {
      showNotice('O formulário de feedback ainda não foi configurado pela equipe de gestão.');
      return;
    }
    if (!feedbackText.trim()) {
      showNotice('Escreva sua mensagem de feedback antes de enviar.');
      return;
    }
    const params = new URLSearchParams();
    params.set('usp', 'pp_url');
    params.set(cfg.entryMessage, feedbackText);
    const base = cfg.formUrl.split('?')[0];
    window.open(`${base}?${params.toString()}`, '_blank', 'noopener,noreferrer');
    showNotice('Feedback enviado! Obrigado por ajudar a melhorar o Dimensio.');
    setFeedbackText('');
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const appsScriptCode = getAppsScriptCode(state.onlineSpreadsheet?.url);
  const appsScriptLineCount = appsScriptCode.split('\n').length;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedScript(true);
    showNotice('Código do Google Apps Script copiado para a área de transferência!');
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleDownloadExtension = async () => {
    if (downloadingExt) return;
    setDownloadingExt(true);
    try {
      await downloadExtensionZip();
      showNotice('✅ Extensão baixada! Extraia o .zip e carregue em chrome://extensions (Modo desenvolvedor).');
      setExtInstalled(isExtensionInstalled());
    } catch (err) {
      showNotice('Falha ao gerar o pacote da extensão. Tente novamente.');
    } finally {
      setDownloadingExt(false);
    }
  };

  const customShortcuts = state.customShortcuts || {};
  const getShortcut = (viewId: string, defaultKey: string) =>
    customShortcuts[viewId] !== undefined && customShortcuts[viewId] !== ''
      ? customShortcuts[viewId]
      : defaultKey;

  const shortcutsList = [
    { key: getShortcut('presence', '1'), title: 'Presença de Hoje', desc: 'Abre a tela de controle de presenças, faltas e licenças' },
    { key: getShortcut('operator_portal', 'P'), title: 'Portal do Operador & Rádio', desc: 'Abre o portal do operador e rádio P2P (Dimensio Talk)' },
    { key: getShortcut('employee', 'M'), title: 'Meu Painel', desc: 'Abre o painel pessoal do colaborador identificado' },
    { key: getShortcut('assignment', '2'), title: 'Dimensionamento', desc: 'Abre o painel de atribuição de tarefas e postos operacionais' },
    { key: getShortcut('breaks', '3'), title: 'Intervalos & Pausas', desc: 'Abre o escalonamento de horários de almoço e refeições' },
    { key: getShortcut('share', '4'), title: 'Resumo / Compartilhar', desc: 'Abre o painel de geração de links do Portal do Colaborador' },
    { key: getShortcut('calendar', '5'), title: 'Calendário Anual 6x2', desc: 'Abre o mapa do ciclo anual de folgas das turmas A-H' },
    { key: getShortcut('team', '6'), title: 'Equipe e Cadastros', desc: 'Abre a gestão de colaboradores, logins, cargos e lixeira' },
    { key: getShortcut('info_hub', 'I'), title: 'Hub de Informações', desc: 'Abre os atalhos rápidos, lembretes e links úteis' },
    { key: getShortcut('briefing', '7'), title: 'Montagem de Slide', desc: 'Abre a tela de briefing e apresentação fullscreen' },
    { key: getShortcut('requests', '8'), title: 'Pedidos e Avisos', desc: 'Abre a central de solicitações de trocas e avisos do sistema' },
    { key: getShortcut('report', '9'), title: 'Relatório Diário', desc: 'Abre a auditoria diária e relatórios de alocação' },
    { key: getShortcut('home', '0'), title: 'Visão Geral (Dashboard)', desc: 'Retorna para o painel principal de métricas da operação' },
    { key: getShortcut('settings', 'S'), title: 'Configurações', desc: 'Abre as configurações gerais do sistema, planilha e preferências' },
    { key: getShortcut('help', 'H'), title: 'Central de Ajuda', desc: 'Abre esta página oficial de documentação e guia de uso' },
    { key: 'Espaço', title: 'PTT Rádio (Segurar)', desc: 'Transmite voz no canal ativo enquanto a tecla estiver pressionada' },
    { key: 'Esc', title: 'Fechar Modais / Teclado', desc: 'Fecha qualquer janela flutuante, menu ou modo slide' },
  ];

  const modulesList = [
    {
      icon: Radio,
      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
      title: 'Rádio PTT & Dimensio Talk',
      subtitle: 'Comunicação por voz em tempo real P2P + Nuvem',
      desc: 'Transmita áudio instantâneo entre operadores e supervisores. Inclui canais por posto/tarefa, chamada direta privada (DM), feedback sonoro (chirps) e suporte a operação contínua em segundo plano.',
      highlights: ['Transmissão rápida PTT por tecla ou toque', 'Canais por posto + Chamada Direta DM', 'Relay duplo WebRTC + Streaming em Nuvem'],
    },
    {
      icon: Smartphone,
      color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
      title: 'Portal do Operador',
      subtitle: 'Painel móvel para colaboradores no chão de fábrica',
      desc: 'Interface otimizada para smartphones com consulta imediata da tarefa do dia, horário de almoço, alertas sonoros de retorno e conexão rápida ao rádio operacional.',
      highlights: ['Identificação rápida por nome ou LDAP', 'Visualização de postos e horários', 'Instalável como PWA offline-first'],
    },
    {
      icon: CheckSquare,
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
      title: 'Presença de Hoje',
      subtitle: 'Controle diário de frequência da operação',
      desc: 'Registre entradas, ausências e faltas não justificadas. O sistema identifica e separa automaticamente colaboradores em Férias, Licença Médica, Treinamento ou em dia de Folga do Ciclo 6x2.',
      highlights: ['Separação automática de folgas do ciclo 6x2', 'Histórico e justificativa de faltas', 'Filtros rápidos por time e turno'],
    },
    {
      icon: Shuffle,
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
      title: 'Dimensionamento de Tarefas',
      subtitle: 'Distribuição operacional por postos de trabalho',
      desc: 'Crie postos operacionais (Separador, Recebimento, Apoio GDM, Caixa, Recepção) e aloque os colaboradores presentes. Exige justificativa obrigatória para quem permanecer não alocado.',
      highlights: ['Atribuição drag & drop ou clique rápido', 'Justificativa para colaboradores sem posto', 'Cópia de estrutura entre turnos'],
    },
    {
      icon: Clock,
      color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
      title: 'Horários de Intervalo & Refeição',
      subtitle: 'Escalonamento de refeições sem sobrecarga',
      desc: 'Organize as pausas de almoço em blocos (ex: 11:30, 12:00, 12:30). O sistema garante visibilidade total para evitar que membros chaves do mesmo setor saiam juntos.',
      highlights: ['Grade em colunas por horário', 'Alerta sonoro e pop-up de retorno', 'Sem limite numérico de lotação por horário'],
    },
    {
      icon: Share2,
      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
      title: 'Portal do Colaborador (Link Público)',
      subtitle: 'Consulta autônoma de tarefas pelos operadores',
      desc: 'Gere um link direto para o Portal do Colaborador. Os funcionários abrem no celular, digitam seu nome ou LDAP e veem na hora qual a sua tarefa do dia e o horário do seu almoço.',
      highlights: ['Acesso rápido via QR Code ou Link', 'Identificação por nome ou LDAP', 'Atualização instantânea via Nuvem'],
    },
    {
      icon: Calendar,
      color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
      title: 'Calendário Anual da Escala 6x2',
      subtitle: 'Projeção automatizada de folgas e ciclos',
      desc: 'Projeta o ciclo automático de folgas 6x2 para as Turmas A, B, C, D, E, F, G, H para todos os 365 dias do ano. Permite ajustes manuais e exportação/importação em formato JSON.',
      highlights: ['Matriz visual dos 12 meses', 'Ajuste fino de folgas individuais', 'Sincronização com o dia de presença'],
    },
    {
      icon: Users,
      color: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
      title: 'Equipe, Cadastros & Lixeira Segura',
      subtitle: 'Cadastro completo com proteção contra exclusões',
      desc: 'Matricule nomes, logins LDAP, turnos, cargos e competências (skills). Ao remover um colaborador, o cadastro vai para a Lixeira de Segurança por 60 dias antes de ser apagado.',
      highlights: ['Lixeira com retenção por 60 dias', 'Restauração com 1 clique', 'Histórico de edições e senhas'],
    },
    {
      icon: Presentation,
      color: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
      title: 'Briefing & Apresentação em Slide',
      subtitle: 'Modo TV e Projetor com ocultação automática',
      desc: 'Transmita o planejamento do dia em telas de TV ou projetores na operação. O menu oculta sozinho após 3 segundos e reaparece ao mover o mouse. Suporta modo Fullscreen.',
      highlights: ['Auto-ocultação do menu de navegação', 'Navegação por setas (← / →) ou tecla F', 'Elementos e anotações customizáveis'],
    },
    {
      icon: Send,
      color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
      title: 'Pedidos de Serviço & Avisos',
      subtitle: 'Solicitações de troca e recados operacionais',
      desc: 'Central de comunicação para troca de folgas, pedidos de ajuste de escala e avisos em destaque para a equipe. Os avisos podem ser afixados com prioridade na tela principal.',
      highlights: ['Status de aprovação/rejeição', 'Notificações no Quick Dock', 'Mural de avisos destacados'],
    },
    {
      icon: FileText,
      color: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
      title: 'Relatório Diário & Auditoria',
      subtitle: 'Registro imutável de ações e exportação CSV',
      desc: 'Acompanhe quem fez qual alteração e em qual horário (Audit Log). Exporte relatórios em formato .CSV compatíveis com Excel e Google Sheets com um clique.',
      highlights: ['Trilha completa de auditoria com autor', 'Exportação imediata em .CSV', 'Estatísticas de alocação por cargo'],
    },
  ];

  const filteredShortcuts = shortcutsList.filter(
    (s) =>
      !searchDocQuery ||
      s.title.toLowerCase().includes(searchDocQuery.toLowerCase()) ||
      s.desc.toLowerCase().includes(searchDocQuery.toLowerCase()) ||
      s.key.toLowerCase().includes(searchDocQuery.toLowerCase())
  );

  const filteredModules = modulesList.filter(
    (m) =>
      !searchDocQuery ||
      m.title.toLowerCase().includes(searchDocQuery.toLowerCase()) ||
      m.desc.toLowerCase().includes(searchDocQuery.toLowerCase()) ||
      m.highlights.some((h) => h.toLowerCase().includes(searchDocQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      <PageHeader
        icon={BookOpen}
        title="Central de Ajuda, Guias & Documentação"
        subtitle="Consulte os manuais operacionais, aprenda a usar o rádio PTT, conheça os atalhos de teclado e configure a sincronização com Google Sheets via Webhook."
        meta={<Badge tone="primary">Documentação Oficial Dimensio</Badge>}
        actions={
          onOpenTutorial && (
            <Button size="sm" icon={Sparkles} onClick={onOpenTutorial}>
              Abrir Tutorial Interativo
            </Button>
          )
        }
      />

      <Toolbar className="justify-between">
        <Tabs
          items={[
            { value: 'all', label: 'Visão Geral' },
            { value: 'radio', label: 'Rádio PTT & Voz' },
            { value: 'modules', label: 'Módulos Operacionais' },
            { value: 'shortcuts', label: 'Atalhos de Teclado' },
            { value: 'sheets', label: 'Google Sheets & Webhook' },
            { value: 'extension', label: 'Extensão de Navegador' },
            { value: 'faq', label: 'FAQ' },
          ]}
          value={activeTab}
          onChange={(v) => setActiveTab(v as typeof activeTab)}
          className="max-w-full overflow-x-auto scrollbar-none"
        />
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            type="text"
            value={searchDocQuery}
            onChange={(e) => setSearchDocQuery(e.target.value)}
            placeholder="Buscar no manual..."
            className="pl-8.5"
          />
        </div>
      </Toolbar>

      {/* SECTION: RADIO PTT & AUDIO STREAMING GUIDE */}
      {(activeTab === 'all' || activeTab === 'radio') && (
        <Card>
          <CardHeader
            icon={<Radio className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            title="Guia Oficial: Rádio PTT & Dimensio Talk"
            subtitle="Comunicação por voz em tempo real com canais setoriais, chamadas diretas privadas e feedback sonoro profissional."
            actions={<Badge tone="success">Transmissão em Tempo Real</Badge>}
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[var(--bg)] border border-[var(--line)] p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-[var(--ink)] uppercase">
                  <Mic className="w-4 h-4 text-emerald-600" />
                  <span>1. Como Transmitir (PTT)</span>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Pressione e <strong>segure a tecla Espaço</strong> no computador ou o <strong>botão PTT</strong> na tela do celular. Ao iniciar, você ouvirá o chirp de início; ao soltar, o chirp de finalização é disparado e o canal é liberado.
                </p>
                <div className="text-[11px] text-[var(--ink)] font-semibold pt-1">
                  💡 Modo Trava: Dê um duplo clique ou ative o botão de cadeado para falar com as mãos livres.
                </div>
              </div>

              <div className="bg-[var(--bg)] border border-[var(--line)] p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-[var(--ink)] uppercase">
                  <Volume2 className="w-4 h-4 text-indigo-600" />
                  <span>2. Canais & Chamada Direta</span>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  O canal <strong>Geral</strong> transmite para toda a equipe. Tarefas com vários operadores criam canais de grupo automáticos. Para falar em particular com um colega, clique no ícone de rádio ao lado do nome dele para abrir uma <strong>Chamada Direta (DM)</strong>.
                </p>
                <div className="text-[11px] text-[var(--ink)] font-semibold pt-1">
                  🔒 Somente você e o colega escutam o áudio na chamada direta.
                </div>
              </div>

              <div className="bg-[var(--bg)] border border-[var(--line)] p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-[var(--ink)] uppercase">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span>3. Status & Indicadores</span>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  O círculo <strong>verde</strong> indica conexão estabelecida e pronta para áudio. Quando alguém estiver falando no canal, o botão pulsa em verde/âmbar e um chirp sutil de entrada avisa que há transmissão.
                </p>
                <div className="text-[11px] text-[var(--ink)] font-semibold pt-1">
                  ⚡ O sistema mantém o áudio ativo mesmo em segundo plano no celular.
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* SECTION: KEYBOARD SHORTCUTS */}
      {(activeTab === 'all' || activeTab === 'shortcuts') && (
        <Card>
          <CardHeader
            icon={<Keyboard className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />}
            title="Atalhos de Teclado Rápidos"
            subtitle="Navegue rapidamente entre as telas do sistema pressionando as teclas indicadas"
            actions={<Badge tone="primary">{filteredShortcuts.length} Atalhos Ativos</Badge>}
          />
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredShortcuts.map((s) => (
                <div
                  key={s.key}
                  className="p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl flex items-center gap-3 hover:border-[var(--primary)]/40 transition-all group"
                >
                  <kbd className="min-w-[36px] h-9 px-2.5 bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--line)] rounded-lg text-xs font-mono font-black flex items-center justify-center shadow-xs shrink-0 group-hover:border-[var(--primary)] group-hover:text-[var(--primary)] transition-colors">
                    {s.key}
                  </kbd>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold text-[var(--ink)] truncate">
                      {s.title}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] truncate font-medium">
                      {s.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* SECTION: SYSTEM MODULES */}
      {(activeTab === 'all' || activeTab === 'modules') && (
        <Card>
          <CardHeader
            icon={<Sliders className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />}
            title="Módulos Operacionais & Recursos do Dimensio"
            subtitle="Guia prático de funcionamento de cada funcionalidade da aplicação"
            actions={<Badge tone="success">{filteredModules.length} Módulos</Badge>}
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredModules.map((m, idx) => {
                const Icon = m.icon;
                return (
                  <div
                    key={idx}
                    className="bg-[var(--bg)] border border-[var(--line)] p-5 rounded-xl flex flex-col justify-between gap-3 hover:border-[var(--primary)]/50 transition-all shadow-2xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl font-bold shrink-0 ${m.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold text-[var(--ink)] truncate">
                            {m.title}
                          </h3>
                          <p className="text-[11px] text-[var(--muted)] font-medium truncate">
                            {m.subtitle}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-[var(--muted)] leading-relaxed pt-1">
                        {m.desc}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[var(--line)] space-y-1">
                      {m.highlights.map((h, hIdx) => (
                        <div key={hIdx} className="text-[11px] text-[var(--ink)] font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* EXTENSÃO PARA O NAVEGADOR */}
      {(activeTab === 'all' || activeTab === 'extension') && (
        <Card>
          <CardHeader
            icon={<Puzzle className="w-4.5 h-4.5 text-violet-600 dark:text-violet-400" />}
            title="Extensão para o Navegador — Destacar Colaboradores"
            subtitle="Ao abrir um pedido no sistema, destaca automaticamente na tela os nomes dos colaboradores — como um Ctrl+F persistente, com vários nomes marcados ao mesmo tempo."
            actions={
              extInstalled ? (
                <Badge tone="success" dot>Extensão detectada</Badge>
              ) : (
                <Badge tone="warning" dot>Não instalada</Badge>
              )
            }
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-extrabold text-[var(--ink)] flex items-center gap-2">
                  <Download className="w-4 h-4 text-violet-500" /> Instalação em 4 passos
                </h3>
                <ol className="space-y-2.5 text-xs text-[var(--muted)] leading-relaxed">
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center">1</span>
                    <span><strong className="text-[var(--ink)]">Baixar a extensão</strong> — clique no botão abaixo para baixar o arquivo <code className="font-mono bg-[var(--paper)] px-1 rounded border border-[var(--line)]">dimensio-extensao.zip</code>.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center">2</span>
                    <span><strong className="text-[var(--ink)]">Extrair o .zip</strong> — descompacte em uma pasta (ex.: <code className="font-mono bg-[var(--paper)] px-1 rounded border border-[var(--line)]">dimensio-extensao</code>).</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center">3</span>
                    <span>Acesse <code className="font-mono bg-[var(--paper)] px-1 rounded border border-[var(--line)]">chrome://extensions</code> (ou <code className="font-mono bg-[var(--paper)] px-1 rounded border border-[var(--line)]">edge://extensions</code>) e ative o <strong className="text-[var(--ink)]">Modo do desenvolvedor</strong>.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center">4</span>
                    <span>Clique em <strong className="text-[var(--ink)]">Carregar sem compactação</strong> e selecione a pasta extraída. Pronto!</span>
                  </li>
                </ol>
                <Button
                  fullWidth
                  icon={Download}
                  onClick={handleDownloadExtension}
                  disabled={downloadingExt}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {downloadingExt ? 'Gerando pacote...' : 'Baixar Extensão (.zip)'}
                </Button>
              </div>

              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-extrabold text-[var(--ink)] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Como funciona
                </h3>
                <ul className="space-y-2 text-xs text-[var(--muted)] leading-relaxed">
                  <li className="flex gap-2 items-start">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Ao clicar em <strong className="text-[var(--ink)]">"Abrir no Sistema (Copiar Nomes & Destacar)"</strong> em um pedido, os nomes dos colaboradores são destacados na tela do sistema aberto.</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Funciona como um <strong className="text-[var(--ink)]">Ctrl+F persistente</strong>: cada nome fica marcado com uma cor, mesmo após navegar ou atualizar a página.</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong className="text-[var(--ink)]">Vários nomes ao mesmo tempo</strong>: marque/desmarque nomes na barra flutuante ou no ícone da extensão para acompanhar o pedido.</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong className="text-[var(--ink)]">Coleta de métricas (poderes Automa)</strong>: cadastre indicadores em <strong className="text-[var(--ink)]">Equipe e cadastros › Métricas</strong> com o link do sistema e os seletores dos valores para extração automática de dados.</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* SECTION: GOOGLE SHEETS & WEBHOOK INTEGRATION */}
      {(activeTab === 'all' || activeTab === 'sheets') && (
        <Card>
          <CardHeader
            icon={<FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            title="Guia de Integração: Google Sheets & Webhook Automático"
            subtitle="Aprenda a baixar o modelo, converter no Google Sheets, preencher os dados, compartilhar o link correto e integrar via Webhook."
            actions={
              <>
                <Badge tone="success">Passo a Passo Oficial</Badge>
                {state.collaborators.length > 0 ? (
                  <Button size="sm" icon={Download} onClick={exportTeamRosterSpreadsheet}>
                    Gerar Planilha da Equipe ({state.collaborators.length} .CSV)
                  </Button>
                ) : (
                  <Button size="sm" icon={Download} onClick={generateTemplateSpreadsheet}>
                    1. Baixar Modelo (.CSV)
                  </Button>
                )}
              </>
            }
          />
          <CardBody>
            <div className="space-y-5">
            {/* STEP 1 */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-5 rounded-xl space-y-3 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                  1
                </span>
                <h3 className="text-sm font-black text-[var(--ink)] uppercase tracking-wide">
                  Baixar ou Exportar a Planilha de Dados (.CSV)
                </h3>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed pl-11">
                {state.collaborators.length > 0
                  ? `Como você já possui ${state.collaborators.length} colaborador(es) cadastrado(s) na aplicação, clique no botão abaixo para exportar o arquivo pré-preenchido com a sua equipe real!`
                  : 'O Dimensio disponibiliza um arquivo modelo pré-formatado em formato .CSV contendo todas as colunas necessárias para o dimensionamento perfeito da equipe.'}
              </p>
              <div className="pl-11 pt-1 flex flex-wrap items-center gap-2.5">
                {state.collaborators.length > 0 && (
                  <Button size="sm" icon={Download} onClick={exportTeamRosterSpreadsheet}>
                    Exportar Minha Equipe Cadastrada ({state.collaborators.length} Colaboradores .CSV)
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={state.collaborators.length > 0 ? 'outline' : 'primary'}
                  icon={Download}
                  onClick={generateTemplateSpreadsheet}
                >
                  Baixar Modelo Em Branco (.CSV)
                </Button>
              </div>
              <div className="pl-11 pt-1 text-[11px] text-[var(--muted)] bg-[var(--paper)] p-3 rounded-xl border border-[var(--line)] font-mono">
                <strong>Estrutura de Colunas:</strong> RE (Matrícula), Nome, LDAP, Setor, Gestor, Turno, Team Leader, Escala, Cargo, Categoria, Observações
              </div>
            </div>

            {/* STEP 2 */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-5 rounded-xl space-y-3 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                  2
                </span>
                <h3 className="text-sm font-black text-[var(--ink)] uppercase tracking-wide">
                  Converter o Arquivo CSV para Planilha do Google Sheets
                </h3>
              </div>
              <div className="pl-11 space-y-2 text-xs text-[var(--muted)] leading-relaxed">
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>
                    Acesse o <strong>Google Drive</strong> (<a href="https://drive.google.com" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline font-bold">drive.google.com</a>) ou abra uma nova planilha no <strong>Google Sheets</strong> (<a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline font-bold">sheets.new</a>).
                  </li>
                  <li>
                    No menu superior da planilha, clique em <strong>Arquivo (File)</strong> ➔ <strong>Importar (Import)</strong>.
                  </li>
                  <li>
                    Vá até a aba <strong>Fazer upload (Upload)</strong> e selecione o arquivo <code className="bg-[var(--paper)] px-1.5 py-0.5 rounded border border-[var(--line)] font-mono text-[11px]">.csv</code> baixado no Passo 1.
                  </li>
                  <li>
                    Em <i>"Local de importação"</i>, escolha <strong>Substituir planilha</strong> ou <strong>Criar nova planilha</strong>. Em <i>"Tipo de separador"</i>, selecione <strong>Detectar automaticamente</strong>.
                  </li>
                  <li>
                    Clique em <strong>Importar dados</strong>. Pronto! O CSV será convertido em uma planilha Google Sheets nativa.
                  </li>
                </ol>
              </div>
            </div>

            {/* STEP 3 */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-5 rounded-xl space-y-3 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                  3
                </span>
                <h3 className="text-sm font-black text-[var(--ink)] uppercase tracking-wide">
                  Como Preencher os Dados da Sua Equipe Corretamente
                </h3>
              </div>
              <div className="pl-11 space-y-2 text-xs text-[var(--muted)] leading-relaxed">
                <p>Siga as boas práticas de preenchimento para garantir que o sistema leia a planilha sem erros:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>RE (Matrícula):</strong> Código do crachá/registro interno (ex: <i>RE-8821</i> ou <i>100293</i>).</li>
                  <li><strong>Nome:</strong> Nome completo do colaborador (ex: <i>Ana Beatris Silva</i>).</li>
                  <li><strong>LDAP:</strong> Identificador único sem espaços (ex: <i>anabs</i>). Usado para consulta no Portal do Colaborador.</li>
                  <li><strong>Turno:</strong> Escolha entre <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">T1</code>, <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">T2</code>, <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">T3</code>, <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">T4</code> ou <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">T5</code>.</li>
                  <li><strong>Turma da Escala (scale):</strong> Código do grupo do ciclo 6x2 (ex: <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">A</code>, <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">B</code>, <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">C</code>, <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">D</code>).</li>
                  <li><strong>Cargo (role):</strong> Sigla ou nome da função (ex: <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">REP</code>, <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">PS</code>, <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">TL</code>, <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">Operador de Processo</code>).</li>
                  <li><strong>Categoria (category):</strong> Setor operacional (ex: <i>Picking, Packing, Qualidade, Inventario, Put-Away</i>).</li>
                  <li><strong>Team Leader / Time:</strong> Nome do time ou supervisor responsável (ex: <i>Time do TL Bruno Silva (T1)</i>).</li>
                </ul>
              </div>
            </div>

            {/* STEP 4 */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-5 rounded-xl space-y-3 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                  4
                </span>
                <h3 className="text-sm font-black text-[var(--ink)] uppercase tracking-wide">
                  Compartilhar da Forma Correta para o Link Funcionar na Aplicação
                </h3>
              </div>
              <div className="pl-11 space-y-2 text-xs text-[var(--muted)] leading-relaxed">
                <p>Para que o Dimensio consiga se conectar à planilha, configure as permissões no Google Sheets da seguinte forma:</p>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>
                    No canto superior direito da planilha no Google Sheets, clique no botão verde <strong>Compartilhar (Share)</strong>.
                  </li>
                  <li>
                    Em <i>"Acesso geral" (General Access)</i>, altere de <strong>"Restrito"</strong> para <strong>"Qualquer pessoa com o link"</strong> (<i>Anyone with the link</i>).
                  </li>
                  <li>
                    Mantenha a permissão como <strong>"Editor"</strong> (se desejar sincronização total) ou <strong>"Leitor"</strong>.
                  </li>
                  <li>
                    Clique em <strong>Copiar link</strong> (o link terá o formato <code className="bg-[var(--paper)] px-1.5 py-0.5 rounded border border-[var(--line)] font-mono text-[11px]">https://docs.google.com/spreadsheets/d/ID_DA_PLANILHA/edit</code>).
                  </li>
                  <li>
                    No Dimensio, acesse o menu <strong>Compartilhar</strong> (ou <strong>Configurações</strong>), clique no botão <strong>"Gerar / Conectar Planilha Online"</strong>, cole o link e clique em <strong>Salvar & Conectar</strong>.
                  </li>
                </ol>
              </div>
            </div>

            {/* STEP 5 */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-5 rounded-xl space-y-4 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                  5
                </span>
                <h3 className="text-sm font-black text-[var(--ink)] uppercase tracking-wide">
                  Etapas de Integração Webhook via Google Apps Script (Gravação Automática em Tempo Real)
                </h3>
              </div>

              <div className="pl-11 space-y-3 text-xs text-[var(--muted)] leading-relaxed">
                <p>
                  O Webhook do Google Apps Script é o canal que mantém todos os dispositivos (celulares, tablets e computadores) conectados à mesma planilha sincronizados em tempo real. Ao editar qualquer dado, o app envia a alteração automaticamente para a nuvem e os demais dispositivos recebem em segundos.
                </p>

                <ol className="list-decimal pl-4 space-y-2">
                  <li>
                    Com a planilha aberta no Google Sheets, acesse o menu superior <strong>Extensões (Extensions)</strong> ➔ <strong>Apps Script</strong>.
                  </li>
                  <li>
                    Apague todo o código padrão existente na tela do editor e cole o código oficial abaixo:
                  </li>
                </ol>

                {/* Code Box */}
                <div className="my-2 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 relative shadow-inner overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-[11px] text-slate-400 border-b border-slate-800">
                    <span className="flex items-center gap-1.5 font-bold min-w-0">
                      <Code className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Google Apps Script (Code.gs)</span>
                      <span className="px-1.5 py-0.5 bg-emerald-900/70 border border-emerald-700 text-emerald-300 rounded-md font-bold text-[10px] shrink-0">
                        v{APPS_SCRIPT_VERSION}
                      </span>
                      <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded-md font-bold text-[10px] shrink-0">
                        ~{appsScriptLineCount} linhas
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="xs"
                        variant="primary"
                        icon={copiedScript ? Check : Copy}
                        onClick={handleCopyScript}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {copiedScript ? 'Copiado!' : 'Copiar'}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        iconRight={showCode ? ChevronUp : ChevronDown}
                        onClick={() => setShowCode(!showCode)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white"
                        aria-expanded={showCode}
                      >
                        {showCode ? 'Ocultar' : 'Ver código'}
                      </Button>
                    </div>
                  </div>
                  {showCode && (
                    <pre className="text-[11px] leading-relaxed text-emerald-300 whitespace-pre font-mono overflow-x-auto overflow-y-auto p-4 max-h-[420px]">
                      {appsScriptCode}
                    </pre>
                  )}
                </div>

                <ol className="list-decimal pl-4 space-y-2 pt-1" start={3}>
                  <li>
                    No canto superior direito da página do Apps Script, clique no botão azul <strong>Implantar (Deploy)</strong> ➔ <strong>Nova implantação (New deployment)</strong>.
                  </li>
                  <li>
                    No painel que se abre, clique no ícone de engrenagem ao lado de <i>"Selecionar tipo"</i> e selecione <strong>App da Web (Web App)</strong>.
                  </li>
                  <li>
                    Preencha as configurações de implantação exatamente assim:
                    <ul className="list-disc pl-5 my-1 space-y-0.5 text-[11px]">
                      <li><strong>Descrição:</strong> Webhook Dimensio</li>
                      <li><strong>Executar como (Execute as):</strong> <code className="bg-[var(--paper)] px-1 py-0.5 rounded font-bold">Eu (seu e-mail)</code></li>
                      <li><strong>Quem tem acesso (Who has access):</strong> <strong className="text-emerald-700 dark:text-emerald-300">Qualquer pessoa (Anyone)</strong> *(Essencial! Se mantido como restrito, a sincronização será bloqueada pelo Google)*</li>
                    </ul>
                  </li>
                  <li>
                    Clique em <strong>Implantar</strong>. O Google pedirá autorização para acessar a planilha. Clique em <i>"Autorizar acesso"</i> e conclua a ativação.
                  </li>
                  <li>
                    Copie a <strong>URL do App da Web</strong> gerada (o link termina com <code className="bg-[var(--paper)] px-1.5 py-0.5 rounded font-mono text-[11px]">/exec</code>).
                  </li>
                  <li>
                    No Dimensio, abra a janela de <strong>Conectar Planilha Online</strong>, cole a URL copiada no campo <strong>"URL do Webhook (Google Apps Script)"</strong> e clique em <strong>Salvar & Conectar</strong>.
                  </li>
                </ol>
              </div>
            </div>

            {/* TROUBLESHOOTING BOX */}
            <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-400 dark:border-amber-700/60 p-5 rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-amber-950 dark:text-amber-100 uppercase tracking-tight">
                    Solução de Problemas: Por que a minha planilha não está atualizando?
                  </h3>
                  <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold">
                    Se você seguiu o passo a passo mas a planilha ainda não recebeu as alterações, verifique estes 3 pontos essenciais:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="bg-[var(--paper)] border border-amber-300 dark:border-amber-800 p-4 rounded-xl space-y-2">
                  <div className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-mono flex items-center justify-center text-[11px]">1</span>
                    <span>"Quem Tem Acesso" = Qualquer Pessoa</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                    No Google Apps Script, ao clicar em <strong>Implantar ➔ Nova Implantação</strong>, o campo <strong>"Quem tem acesso" (Who has access)</strong> DEVE ser configurado obrigatoriamente como <strong>"Qualquer pessoa" (Anyone)</strong>. Se mantido como "Apenas eu", o Google bloqueia os acessos externos e a planilha não atualiza.
                  </p>
                </div>

                <div className="bg-[var(--paper)] border border-amber-300 dark:border-amber-800 p-4 rounded-xl space-y-2">
                  <div className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-mono flex items-center justify-center text-[11px]">2</span>
                    <span>URL Correta no Campo Webhook</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                    A URL do Webhook DEVE iniciar com <code className="bg-[var(--bg)] px-1 rounded font-mono font-bold text-[10px]">https://script.google.com/macros/s/.../exec</code> (o link do Web App) e NÃO com <code className="bg-[var(--bg)] px-1 rounded font-mono font-bold text-[10px]">docs.google.com/spreadsheets/d/...</code> (que é a página da planilha).
                  </p>
                </div>

                <div className="bg-[var(--paper)] border border-amber-300 dark:border-amber-800 p-4 rounded-xl space-y-2">
                  <div className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-mono flex items-center justify-center text-[11px]">3</span>
                    <span>Autorização Concluída & Script Atualizado</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                    Ao implantar pela 1ª vez, o Google exige autorizar o acesso. Depois de atualizar o código do script, refaça o deploy (Implantar ➔ Gerenciar implantações ➔ lápis ✏️ ➔ Nova versão ➔ Implantar) para que a nova versão passe a valer.
                  </p>
                </div>
              </div>

              {/* Live Webhook Tester */}
              <div className="bg-[var(--paper)] border border-amber-300 dark:border-amber-800/80 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-[var(--ink)] flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span>Testar Conexão com Google Sheets Agora</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)]">
                    {state.onlineSpreadsheet?.webhookUrl
                      ? `Planilha atual configurada: "${state.onlineSpreadsheet.name}"`
                      : 'Nenhuma URL de Webhook salva no momento. Configure em Conectar Planilha Online.'}
                  </p>
                </div>

                <Button
                  icon={Sparkles}
                  onClick={async () => {
                    if (!state.onlineSpreadsheet?.webhookUrl) {
                      showNotice('Você precisa informar a URL do Webhook do Apps Script antes de testar. Clique em "Conectar Planilha Online".');
                      return;
                    }
                    showNotice('Testando envio de dados para o Google Sheets...');
                    const ok = await syncToOnlineSpreadsheet();
                    if (ok) {
                      showNotice('Sincronização enviada com sucesso ao Google Sheets!');
                    }
                  }}
                  className="shrink-0"
                >
                  Testar Envio p/ Planilha
                </Button>
              </div>
            </div>
          </div>
          </CardBody>
        </Card>
      )}

      {/* SECTION: FREQUENTLY ASKED QUESTIONS */}
      {(activeTab === 'all' || activeTab === 'faq') && (
        <Card>
          <CardHeader
            icon={<HelpCircle className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />}
            title="Perguntas Frequentes & Resolução de Dúvidas (FAQ)"
            subtitle="Respostas diretas para as dúvidas mais comuns dos supervisores e operadores"
          />
          <CardBody>
            <div className="space-y-3">
              {[
                {
                  q: 'Como funciona o Rádio PTT (Push-to-Talk)?',
                  a: 'O Rádio PTT permite falar em tempo real com sua equipe em canais públicos ou por chamada direta (DM). No computador, segure a tecla Espaço para falar. No celular, segure o botão de microfone na tela. Um chirp sonoro avisa o início e o fim da fala.',
                },
                {
                  q: 'Por que o áudio do rádio continua funcionando mesmo com a tela do celular apagada?',
                  a: 'O Dimensio implementa um motor de áudio em segundo plano que mantém o processo ativo no sistema operacional móvel (Android e iOS), garantindo que mensagens de voz importantes não sejam perdidas durante o turno de trabalho.',
                },
                {
                  q: 'Como funcionam os atalhos de teclado no Dimensio?',
                  a: 'Você pode utilizar as teclas numéricas 1 a 9 e 0 para alternar instantaneamente entre as telas (1 para Presença, 2 para Dimensionamento, 3 para Intervalos, 4 para Compartilhar, etc.). Pressione P para o Portal do Operador e H para abrir esta Central de Ajuda. Os atalhos são desativados automaticamente enquanto você digita em caixas de texto.',
                },
                {
                  q: 'O que acontece no uso por múltiplos administradores/supervisores simultâneos?',
                  a: 'O sistema funciona perfeitamente em multi-usuário! As alterações feitas por cada supervisor são enviadas de forma assíncrona para a nuvem e para a planilha do Google Sheets, e os demais dispositivos recebem as atualizações em tempo real sem conflito.',
                },
                {
                  q: 'O que acontece ao excluir um colaborador? Os dados são perdidos?',
                  a: 'Não. Ao excluir um colaborador, o sistema exibe um aviso imediato com o botão "Desfazer Exclusão". Além disso, o cadastro vai para a Lixeira de Segurança por 60 dias, onde pode ser restaurado a qualquer momento.',
                },
                {
                  q: 'Como funciona o modo de Apresentação em Slide para TV e Projetor?',
                  a: 'No menu Briefing, ative o Modo Apresentação de Slide ou pressione a tecla F. O painel superior e inferior oculta automaticamente após 3 segundos sem movimento do mouse para garantir exibição limpa em tela cheia na operação. Mova o mouse ou pressione Esc para reexibir os controles.',
                },
                {
                  q: 'Onde ficam salvos meus dados se eu não conectar uma planilha online?',
                  a: 'Todos os cadastros, presenças e dimensionamentos ficam salvos de forma totalmente segura e privada no armazenamento local do navegador (LocalStorage / IndexedDB). Eles não são perdidos ao fechar a aba do navegador.',
                },
                {
                  q: 'Como fazer backup ou restaurar os dados da minha equipe?',
                  a: 'Acesse o menu Configurações ➔ Exportar & Importar Backup. Você pode exportar um arquivo .JSON completo da equipe e restaurá-lo em qualquer outro computador ou celular.',
                },
              ]
                .filter(
                  (f) =>
                    !searchDocQuery ||
                    f.q.toLowerCase().includes(searchDocQuery.toLowerCase()) ||
                    f.a.toLowerCase().includes(searchDocQuery.toLowerCase())
                )
                .map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-[var(--line)] rounded-xl overflow-hidden transition-colors"
                    >
                      <button
                        onClick={() => toggleFaq(idx)}
                        className="w-full p-4 text-left font-bold text-xs sm:text-sm text-[var(--ink)] bg-[var(--bg)] hover:bg-slate-100 dark:hover:bg-slate-800/60 flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <span>{faq.q}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 shrink-0 text-[var(--primary)]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 shrink-0 text-[var(--muted)]" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="p-4 pt-2 text-xs text-[var(--muted)] leading-relaxed bg-[var(--paper)] border-t border-[var(--line)] font-medium">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* SECTION: FEEDBACK FORM */}
      <Card>
        <CardHeader
          icon={<MessageSquareText className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />}
          title="Envie seu Feedback & Sugestões"
          subtitle="Ajude a melhorar o Dimensio! Sua opinião vai direto para a equipe de desenvolvimento e gestão."
        />
        <CardBody>
          <Field label="Sua mensagem">
            <Textarea
              rows={4}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Escreva aqui sua opinião, sugestão, elogio ou relato de melhoria..."
            />
          </Field>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4">
            <p className="text-[11px] text-[var(--muted)] font-semibold leading-relaxed">
              Sua sugestão nos ajuda a criar novas ferramentas de produtividade.
            </p>
            <Button icon={Send} onClick={handleSubmitFeedback} className="shrink-0">
              Enviar Feedback
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* System Version Footer */}
      <div className="text-center py-4 border-t border-[var(--line)] text-xs text-[var(--muted)] font-medium flex items-center justify-center gap-2 flex-wrap">
        <span>Dimensio v{APP_VERSION}</span>
        {GIT_COMMIT && (
          <>
            <span>•</span>
            <span className="font-mono text-[11px] flex items-center gap-1">
              <GitBranch className="w-3 h-3 text-emerald-600" />
              {GIT_COMMIT}
            </span>
          </>
        )}
        {BUILD_TS && (
          <>
            <span>•</span>
            <span>Build: {BUILD_TS}</span>
          </>
        )}
      </div>
    </div>
  );
};
