import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ExtensionConfig, ExtensionCustomSelector } from '../types';
import {
  isExtensionInstalled,
  downloadExtensionZip,
  dispatchHighlightToExtension,
  dispatchOpenSystemToExtension,
  dispatchQuickFillsToExtension,
  pingExtensionBridge,
} from '../utils/extensionInstaller';
import {
  Puzzle,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  ExternalLink,
  Sparkles,
  Search,
  Eye,
  Sliders,
  Layers,
  Terminal,
  Activity,
  Plus,
  Trash2,
  Copy,
  Check,
  Code2,
  Clock,
  Compass,
  Palette,
  ShieldCheck,
  MousePointerClick,
  HelpCircle,
} from 'lucide-react';

const DEFAULT_PALETTE = [
  '#fde047', // Amarelo
  '#fca5a5', // Vermelho suave
  '#86efac', // Verde
  '#93c5fd', // Azul
  '#f0abfc', // Magenta
  '#fbbf24', // Âmbar
  '#5eead4', // Turquesa
  '#fda4af', // Rosa
];

export const ExtensionSettingsPanel: React.FC = () => {
  const { state, updateExtensionConfig, showNotice } = useApp();

  const extensionConfig: ExtensionConfig = state.extensionConfig || {
    enabled: true,
    highlightEnabled: true,
    highlightCaseSensitive: false,
    highlightIgnoreAccents: true,
    highlightPalette: DEFAULT_PALETTE,
    openSystemMode: 'dedicated_window',
    quickFillsAutoSync: true,
    quickFillsFloatingButton: true,
    autoMetricsEnabled: true,
    metricsCollectInterval: 15,
    customSelectors: [],
  };

  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latencyMs: number; mode: string } | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // New Selector Modal / State
  const [showAddSelector, setShowAddSelector] = useState<boolean>(false);
  const [newSelectorName, setNewSelectorName] = useState('');
  const [newSelectorUrl, setNewSelectorUrl] = useState('');
  const [newSelectorCss, setNewSelectorCss] = useState('');
  const [newSelectorAttr, setNewSelectorAttr] = useState('');
  const [newSelectorDesc, setNewSelectorDesc] = useState('');

  const checkStatus = () => {
    const installed = isExtensionInstalled();
    setIsInstalled(installed);
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadExtensionZip();
      showNotice('Extensão baixada com sucesso! Extraia o arquivo .zip e carregue no Chrome/Edge.');
    } catch (err: any) {
      showNotice(err.message || 'Erro ao baixar pacote da extensão.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePing = async () => {
    setIsPinging(true);
    try {
      const res = await pingExtensionBridge();
      setPingResult(res);
      setIsInstalled(res.success);
      if (res.success) {
        showNotice(`Ponte da extensão ativa! Latência: ${res.latencyMs}ms`);
      } else {
        showNotice('Extensão não respondeu ao ping. Verifique se o content-script está carregado.');
      }
    } catch {
      setPingResult({ success: false, latencyMs: 0, mode: 'error' });
    } finally {
      setIsPinging(false);
    }
  };

  const handleTestHighlight = () => {
    const sampleNames = (state.collaborators || []).slice(0, 4).map((c) => c.name);
    const namesToTest = sampleNames.length > 0 ? sampleNames : ['Operador Exemplo 1', 'Operador Exemplo 2'];
    const ok = dispatchHighlightToExtension(namesToTest, 'Teste de Destaque Dimensio');
    if (ok) {
      showNotice(`Enviado teste de destaque para ${namesToTest.length} nomes na extensão!`);
    } else {
      showNotice('Extensão não detectada nesta aba, mas o evento de broadcast foi disparado.');
    }
  };

  const handleSyncQuickFillsNow = () => {
    const list = state.infoHubQuickFills || [];
    const ok = dispatchQuickFillsToExtension(list);
    showNotice(
      ok
        ? `Sincronizados ${list.length} grupos de preenchimentos rápidos com a extensão!`
        : `Disparados ${list.length} grupos de preenchimento via broadcast para a extensão.`
    );
  };

  const handleTestOpenDedicatedWindow = () => {
    const testUrl = window.location.origin;
    dispatchOpenSystemToExtension(testUrl);
    showNotice('Solicitada abertura de sistema em janela dedicada na extensão.');
  };

  const handleSaveSelector = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSelectorName.trim() || !newSelectorCss.trim()) {
      showNotice('Preencha o nome e o seletor CSS.');
      return;
    }

    const newEntry: ExtensionCustomSelector = {
      id: Math.random().toString(36).substring(2, 9),
      name: newSelectorName.trim(),
      urlPattern: newSelectorUrl.trim() || '*',
      selector: newSelectorCss.trim(),
      attribute: newSelectorAttr.trim() || undefined,
      description: newSelectorDesc.trim() || undefined,
      enabled: true,
    };

    const currentSelectors = extensionConfig.customSelectors || [];
    updateExtensionConfig({
      customSelectors: [...currentSelectors, newEntry],
    });

    setNewSelectorName('');
    setNewSelectorUrl('');
    setNewSelectorCss('');
    setNewSelectorAttr('');
    setNewSelectorDesc('');
    setShowAddSelector(false);
    showNotice('Seletor personalizado adicionado com sucesso!');
  };

  const handleDeleteSelector = (id: string) => {
    const currentSelectors = extensionConfig.customSelectors || [];
    updateExtensionConfig({
      customSelectors: currentSelectors.filter((s) => s.id !== id),
    });
    showNotice('Seletor removido.');
  };

  const handleToggleSelector = (id: string) => {
    const currentSelectors = extensionConfig.customSelectors || [];
    updateExtensionConfig({
      customSelectors: currentSelectors.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    showNotice(`Copiado: ${text}`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Banner Principal de Status da Extensão */}
      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <Puzzle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-[var(--ink)]">
                  Extensão Dimensio para Chrome & Edge
                </h3>
                {isInstalled ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-[11px] font-black border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Instalada & Conectada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-[11px] font-black border border-amber-300 dark:border-amber-800">
                    <AlertCircle className="w-3.5 h-3.5" /> Não Detectada no Navegador
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--muted)] font-medium mt-0.5">
                Destaque persistente de operadores (Ctrl+F inteligente), automação de sistemas externos, coleta de métricas e preenchimento rápido.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePing}
              disabled={isPinging}
              className="px-3 py-2 bg-[var(--bg)] hover:bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink)] text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${isPinging ? 'animate-spin' : ''}`} />
              <span>{isPinging ? 'Verificando...' : 'Testar Conexão (Ping)'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-xs"
            >
              <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
              <span>{isDownloading ? 'Montando ZIP...' : 'Baixar Extensão (.ZIP)'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowInstallGuide(!showInstallGuide)}
              className="px-3 py-2 bg-[var(--bg)] hover:bg-[var(--surface-2)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-[var(--primary)]" />
              <span>{showInstallGuide ? 'Ocultar Guia' : 'Como Instalar?'}</span>
            </button>
          </div>
        </div>

        {/* Guia Rápido de Instalação (Colapsável) */}
        {showInstallGuide && (
          <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Instalação Rápida no Chrome / Edge (Modo Desenvolvedor)</span>
              </h4>
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Tempo estimado: 30 segundos</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-[var(--ink)]">
              <div className="bg-[var(--paper)] border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl space-y-1">
                <div className="font-black text-amber-600 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Baixe e Extraia</span>
                </div>
                <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                  Clique no botão laranja acima para baixar o <strong className="text-[var(--ink)]">dimensio-extensao.zip</strong> e descompacte em uma pasta de sua escolha.
                </p>
              </div>

              <div className="bg-[var(--paper)] border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl space-y-1">
                <div className="font-black text-amber-600 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Abra Extensões</span>
                </div>
                <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                  Abra uma nova aba e acerte a URL:
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <code className="px-1.5 py-0.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[10px] font-mono">
                    chrome://extensions
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('chrome://extensions', 'chrome_ext')}
                    className="p-1 hover:bg-[var(--surface-2)] rounded text-[var(--muted)]"
                    title="Copiar URL"
                  >
                    {copiedText === 'chrome_ext' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="bg-[var(--paper)] border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl space-y-1">
                <div className="font-black text-amber-600 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">3</span>
                  <span>Modo Desenvolvedor</span>
                </div>
                <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                  No canto superior direito da página de extensões, ative a chave <strong className="text-[var(--ink)]">Modo do desenvolvedor</strong>.
                </p>
              </div>

              <div className="bg-[var(--paper)] border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl space-y-1">
                <div className="font-black text-amber-600 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">4</span>
                  <span>Carregar Pasta</span>
                </div>
                <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                  Clique em <strong className="text-[var(--ink)]">"Carregar sem compactação"</strong> e selecione a pasta extraída. A extensão se conectará de imediato!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Diagnóstico em tempo real da conexão */}
        {pingResult && (
          <div
            className={`p-3 rounded-xl text-xs border flex items-center justify-between gap-3 ${
              pingResult.success
                ? 'bg-emerald-50 text-emerald-950 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-100 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-950 border-rose-300 dark:bg-rose-950/60 dark:text-rose-100 dark:border-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {pingResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>
                {pingResult.success
                  ? `Comunicação ativa via Ponte Dimensio (${pingResult.mode}) • Resposta em ${pingResult.latencyMs}ms`
                  : 'Nenhuma resposta da extensão. Carregue-a no Chrome/Edge para utilizar todas as automações.'}
              </span>
            </div>
            <span className="text-[10px] font-mono opacity-80 uppercase tracking-wider">
              {pingResult.success ? 'HTTP/PONG OK' : 'OFFLINE'}
            </span>
          </div>
        )}
      </div>

      {/* Grid de Seções de Configurações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bloco 1: Destaque de Nomes & Operadores (Ctrl+F Persistente) */}
        <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-300 flex items-center justify-center font-bold">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[var(--ink)]">
                    Destaque de Nomes em Pedidos (Ctrl+F)
                  </h4>
                  <p className="text-[11px] text-[var(--muted)]">
                    Destaca na tela os nomes dos operadores escalados ao abrir pedidos e sistemas.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-[var(--bg)] transition-colors">
                <input
                  type="checkbox"
                  checked={extensionConfig.highlightEnabled !== false}
                  onChange={(e) => updateExtensionConfig({ highlightEnabled: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-[var(--ink)]">Ativar Destaque Automático de Nomes</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Ao abrir um chamado ou pedido com operadores atribuídos, a extensão destaca os nomes automaticamente na tela.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-[var(--bg)] transition-colors">
                <input
                  type="checkbox"
                  checked={extensionConfig.highlightIgnoreAccents !== false}
                  onChange={(e) => updateExtensionConfig({ highlightIgnoreAccents: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-[var(--ink)]">Ignorar Acentuação e Cedilha</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Localiza o operador mesmo que o sistema de origem não use acentos (ex: "Jose" encontra "José").
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-[var(--bg)] transition-colors">
                <input
                  type="checkbox"
                  checked={!!extensionConfig.highlightCaseSensitive}
                  onChange={(e) => updateExtensionConfig({ highlightCaseSensitive: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-[var(--ink)]">Diferenciar Maiúsculas e Minúsculas</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Caso desmarcado, a busca é insensível a maiúsculas/minúsculas.
                  </div>
                </div>
              </label>

              {/* Paleta de Cores dos Marcadores */}
              <div className="pt-2 border-t border-[var(--line)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-amber-600" />
                    <span>Paleta de Cores dos Operadores na Tela</span>
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">Cores rotativas por pessoa</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap p-2 bg-[var(--bg)] rounded-xl border border-[var(--line)]">
                  {(extensionConfig.highlightPalette || DEFAULT_PALETTE).map((color, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold text-slate-900 shadow-2xs border border-black/10"
                      style={{ backgroundColor: color }}
                    >
                      <span>#{idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
            <span className="text-[11px] text-[var(--muted)] font-medium">
              {(state.collaborators || []).length} operadores na base
            </span>
            <button
              type="button"
              onClick={handleTestHighlight}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Testar Destaque Agora</span>
            </button>
          </div>
        </div>

        {/* Bloco 2: Preenchimento Rápido (Quick-Fills do InfoHub) */}
        <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[var(--ink)]">
                    Preenchimento Rápido & Modelos (InfoHub)
                  </h4>
                  <p className="text-[11px] text-[var(--muted)]">
                    Injeta códigos de balança, impressoras e respostas prontas direto no popup da extensão.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-[var(--bg)] transition-colors">
                <input
                  type="checkbox"
                  checked={extensionConfig.quickFillsAutoSync !== false}
                  onChange={(e) => updateExtensionConfig({ quickFillsAutoSync: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-purple-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-[var(--ink)]">Sincronização Contínua em Segundo Plano</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Sempre que novos códigos forem cadastrados no InfoHub, a extensão recebe a lista atualizada automaticamente.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-[var(--bg)] transition-colors">
                <input
                  type="checkbox"
                  checked={extensionConfig.quickFillsFloatingButton !== false}
                  onChange={(e) => updateExtensionConfig({ quickFillsFloatingButton: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-purple-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-[var(--ink)]">Gatilho de URL com Painel Flutuante</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Abre um painel de inserção rápida ao entrar em URLs de sistemas configurados no InfoHub (ex: tela de triagem, WMS).
                  </div>
                </div>
              </label>

              {/* Status do Banco do InfoHub */}
              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-[var(--ink)]">
                  <span>Itens no Banco do InfoHub:</span>
                  <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono">
                    {(state.infoHubQuickFills || []).length} grupos cadastrados
                  </span>
                </div>
                <p className="text-[10.5px] text-[var(--muted)] leading-relaxed">
                  Os preenchimentos rápidos ficam acessíveis no ícone da extensão ao lado da barra de endereços para preenchimento com 1 clique.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
            <span className="text-[11px] text-[var(--muted)] font-medium">
              Popup v1.0 • Storage local
            </span>
            <button
              type="button"
              onClick={handleSyncQuickFillsNow}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sincronizar com a Extensão Agora</span>
            </button>
          </div>
        </div>

        {/* Bloco 3: Navegação & Abertura de Janelas de Sistemas */}
        <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[var(--ink)]">
                    Abertura de Sistemas Operacionais
                  </h4>
                  <p className="text-[11px] text-[var(--muted)]">
                    Comportamento ao clicar em links externos de pedidos, chamados e WMS.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-[11px] font-bold text-[var(--ink)]">
                Modo de Abertura de Janela pela Extensão:
              </label>

              <div className="space-y-2">
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    (extensionConfig.openSystemMode || 'dedicated_window') === 'dedicated_window'
                      ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800'
                      : 'bg-[var(--bg)] border-[var(--line)] hover:border-blue-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="openSystemMode"
                    value="dedicated_window"
                    checked={(extensionConfig.openSystemMode || 'dedicated_window') === 'dedicated_window'}
                    onChange={(e) => updateExtensionConfig({ openSystemMode: e.target.value as any })}
                    className="w-4 h-4 mt-0.5 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                      <span>Janela Dedicada Única (Multi-abas)</span>
                      <span className="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-[9.5px] font-black">
                        Recomendado
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5">
                      Cria uma janela separada do navegador para concentrar todos os chamados e sistemas externos, agrupando novas guias na mesma janela para não poluir sua área de trabalho.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    extensionConfig.openSystemMode === 'new_tab'
                      ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800'
                      : 'bg-[var(--bg)] border-[var(--line)] hover:border-blue-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="openSystemMode"
                    value="new_tab"
                    checked={extensionConfig.openSystemMode === 'new_tab'}
                    onChange={(e) => updateExtensionConfig({ openSystemMode: e.target.value as any })}
                    className="w-4 h-4 mt-0.5 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <div className="font-bold text-[var(--ink)]">Nova Guia no Navegador Atual</div>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5">
                      Abre cada link em uma nova guia na mesma janela onde você está trabalhando.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
            <span className="text-[11px] text-[var(--muted)] font-medium">
              API chrome.windows & tabs
            </span>
            <button
              type="button"
              onClick={handleTestOpenDedicatedWindow}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Testar Abertura em Janela</span>
            </button>
          </div>
        </div>

        {/* Bloco 4: Coleta de Métricas & Automação ("Poderes Automa") */}
        <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[var(--ink)]">
                    Coleta de Métricas & Automação de Telas
                  </h4>
                  <p className="text-[11px] text-[var(--muted)]">
                    Agendador de coletas, inspetor visual de elementos e contadores de fila.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-[var(--bg)] transition-colors">
                <input
                  type="checkbox"
                  checked={extensionConfig.autoMetricsEnabled !== false}
                  onChange={(e) => updateExtensionConfig({ autoMetricsEnabled: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-[var(--ink)]">Habilitar Coleta Automática de Métricas</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Executa os fluxos de cliques e leitura de contadores nos horários e turnos programados.
                  </div>
                </div>
              </label>

              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Intervalo de Coleta em Segundo Plano:</span>
                  </label>
                  <select
                    value={extensionConfig.metricsCollectInterval || 15}
                    onChange={(e) => updateExtensionConfig({ metricsCollectInterval: Number(e.target.value) })}
                    className="bg-[var(--paper)] border border-[var(--line)] rounded-lg px-2.5 py-1 text-xs font-bold text-[var(--ink)]"
                  >
                    <option value={5}>A cada 5 minutos</option>
                    <option value={10}>A cada 10 minutos</option>
                    <option value={15}>A cada 15 minutos (Padrão)</option>
                    <option value={30}>A cada 30 minutos</option>
                    <option value={60}>A cada 1 hora</option>
                  </select>
                </div>
                <p className="text-[10.5px] text-[var(--muted)] leading-relaxed">
                  A extensão executa a leitura silenciosa em abas em segundo plano sem atrapalhar a digitação do operador.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
            <span className="text-[11px] text-[var(--muted)] font-medium">
              {(state.metricDefinitions || []).length} métricas ativas na base
            </span>
            <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>Inspetor "Automa" Ativo</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bloco 5: Seletores Personalizados e Regras CSS por URL */}
      <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black text-[var(--ink)]">
                Seletores CSS & Mapeamento de Telas Externas
              </h4>
              <p className="text-[11px] text-[var(--muted)]">
                Cadastre elementos DOM para captura rápida de contadores de chamados ou pedidos em sistemas da sua empresa.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddSelector(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Novo Seletor</span>
          </button>
        </div>

        {/* Modal / Formulário de Novo Seletor */}
        {showAddSelector && (
          <form onSubmit={handleSaveSelector} className="bg-[var(--bg)] border border-indigo-200 dark:border-indigo-900/50 p-4 rounded-xl space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
              <span className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>Novo Mapeamento de Elemento CSS</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAddSelector(false)}
                className="text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[var(--ink)] mb-1">
                  Nome Amigável / Descrição *
                </label>
                <input
                  type="text"
                  required
                  value={newSelectorName}
                  onChange={(e) => setNewSelectorName(e.target.value)}
                  placeholder="Ex: Total de Chamados Pendentes WMS"
                  className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-lg px-3 py-1.5 font-semibold text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--ink)] mb-1">
                  Padrão de URL (ou * para todas)
                </label>
                <input
                  type="text"
                  value={newSelectorUrl}
                  onChange={(e) => setNewSelectorUrl(e.target.value)}
                  placeholder="Ex: https://wms.empresa.com.br/*"
                  className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-lg px-3 py-1.5 font-mono text-[11px] text-[var(--ink)]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-[var(--ink)] mb-1">
                  Seletor CSS *
                </label>
                <input
                  type="text"
                  required
                  value={newSelectorCss}
                  onChange={(e) => setNewSelectorCss(e.target.value)}
                  placeholder="Ex: div.badge-counter, #pending-queue span.count, [data-testid='orders-total']"
                  className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-lg px-3 py-1.5 font-mono text-[11px] text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--ink)] mb-1">
                  Atributo (Opcional - vazio = texto interno)
                </label>
                <input
                  type="text"
                  value={newSelectorAttr}
                  onChange={(e) => setNewSelectorAttr(e.target.value)}
                  placeholder="Ex: value, data-count, title"
                  className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-lg px-3 py-1.5 font-mono text-[11px] text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--ink)] mb-1">
                  Notas Operacionais
                </label>
                <input
                  type="text"
                  value={newSelectorDesc}
                  onChange={(e) => setNewSelectorDesc(e.target.value)}
                  placeholder="Ex: Atualizado a cada 5min na tela principal"
                  className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-lg px-3 py-1.5 font-semibold text-[var(--ink)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddSelector(false)}
                className="px-3 py-1.5 border border-[var(--line)] text-[var(--ink)] text-xs font-bold rounded-lg cursor-pointer hover:bg-[var(--surface-2)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
              >
                Salvar Seletor
              </button>
            </div>
          </form>
        )}

        {/* Lista de Seletores Cadastrados */}
        {(!extensionConfig.customSelectors || extensionConfig.customSelectors.length === 0) ? (
          <div className="p-6 text-center bg-[var(--bg)] border border-dashed border-[var(--line)] rounded-xl space-y-2">
            <MousePointerClick className="w-8 h-8 mx-auto text-[var(--muted)] opacity-60" />
            <div className="text-xs font-bold text-[var(--ink)]">Nenhum seletor CSS customizado adicionado</div>
            <p className="text-[11px] text-[var(--muted)] max-w-md mx-auto">
              Você pode usar o Inspetor Visual da extensão para capturar elementos automaticamente ou cadastrar seletores manuais acima.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {extensionConfig.customSelectors.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2 text-xs flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-[var(--ink)] truncate">{item.name}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSelector(item.id)}
                      className={`px-2 py-0.5 text-[9.5px] font-black uppercase rounded-md border cursor-pointer ${
                        item.enabled !== false
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300'
                      }`}
                    >
                      {item.enabled !== false ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                  <div className="font-mono text-[10.5px] text-[var(--primary)] bg-[var(--paper)] px-2 py-1 rounded border border-[var(--line)] truncate">
                    {item.selector}
                  </div>
                  {item.urlPattern && (
                    <div className="text-[10px] text-[var(--muted)] truncate">
                      <strong>URL:</strong> {item.urlPattern}
                    </div>
                  )}
                  {item.description && (
                    <div className="text-[10.5px] text-[var(--muted)]">{item.description}</div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
                  <button
                    type="button"
                    onClick={() => handleDeleteSelector(item.id)}
                    className="text-rose-600 hover:text-rose-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
