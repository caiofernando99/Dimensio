import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Code2,
  MessageSquareText,
  Check,
  Database,
  Download,
  RefreshCw,
  Activity,
  Trash2,
} from 'lucide-react';
import {
  APP_VERSION,
  BUILD_TS as APP_BUILD_DATE,
  GIT_COMMIT,
  GIT_BRANCH,
  HAS_GIT,
} from '../../version';

interface DeveloperSettingsPanelProps {
  checkPermissionOrAlert: (requireAdmin?: boolean) => boolean;
}

export const DeveloperSettingsPanel: React.FC<DeveloperSettingsPanelProps> = ({
  checkPermissionOrAlert,
}) => {
  const {
    state,
    updateFeedbackConfig,
    showNotice,
    fetchFromOnlineSpreadsheet,
  } = useApp();

  const [feedbackFormUrl, setFeedbackFormUrl] = useState(state.feedbackConfig?.formUrl || '');
  const [feedbackEntryMessage, setFeedbackEntryMessage] = useState(
    state.feedbackConfig?.entryMessage || ''
  );
  const [feedbackEntryName, setFeedbackEntryName] = useState(
    state.feedbackConfig?.entryName || ''
  );
  const [feedbackEntryCategory, setFeedbackEntryCategory] = useState(
    state.feedbackConfig?.entryCategory || ''
  );

  const handleSaveFeedbackConfig = () => {
    if (!checkPermissionOrAlert(true)) return;
    updateFeedbackConfig({
      formUrl: feedbackFormUrl.trim(),
      entryMessage: feedbackEntryMessage.trim(),
      entryName: feedbackEntryName.trim(),
      entryCategory: feedbackEntryCategory.trim(),
    });
    showNotice('Formulário de feedback configurado com sucesso!');
  };

  const handleCheckForUpdate = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          showNotice(
            'Verificação concluída. Se houver nova versão, ela será carregada na próxima reinicialização.'
          );
        } else {
          showNotice('Nenhum service worker ativo neste momento.');
        }
      } catch {
        showNotice('Falha ao verificar atualizações do service worker.');
      }
    } else {
      showNotice('Service workers não são suportados neste navegador.');
    }
  };

  const handleDownloadRawState = () => {
    try {
      const dataStr =
        'data:text/json;charset=utf-8,' +
        encodeURIComponent(JSON.stringify(state, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `dimensio-raw-state-${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showNotice('Estado bruto exportado em JSON para diagnóstico.');
    } catch {
      showNotice('Erro ao gerar download do estado bruto.');
    }
  };

  const handleResetDevConfig = () => {
    if (!window.confirm('Deseja realmente redefinir as configurações do desenvolvedor para os padrões?')) return;
    updateFeedbackConfig({ formUrl: '', entryMessage: '', entryName: '', entryCategory: '' });
    setFeedbackFormUrl('');
    setFeedbackEntryMessage('');
    setFeedbackEntryName('');
    setFeedbackEntryCategory('');
    showNotice('Configurações de desenvolvedor limpas.');
  };

  return (
    <div className="space-y-4">
      {/* Header note */}
      <div className="bg-slate-900 text-slate-100 border border-slate-700 p-4 rounded-2xl flex items-start gap-3">
        <Code2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-sm font-black text-white uppercase tracking-wider">
            Opções de Desenvolvedor
          </h3>
          <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
            Menu oculto para o gestor/desenvolvedor. Não aparece para usuários comuns. Use com
            cuidado — alterações aqui afetam a configuração global do aplicativo.
          </p>
        </div>
      </div>

      {/* Feedback Form Config */}
      <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-3 shadow-2xs">
        <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm border-b border-[var(--line)] pb-3">
          <MessageSquareText className="w-4 h-4 text-emerald-600" />
          <span>Feedback dos Usuários (Google Forms)</span>
        </div>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          O colaborador preenche um campo simples na tela de <strong>Ajuda</strong>. Cada envio
          vira uma resposta do formulário — para receber em uma{' '}
          <strong>planilha organizada</strong>, abra o formulário no Google Forms e ative a aba{' '}
          <strong>"Respostas" → "Vincular ao Planilhas"</strong>. Cada feedback entrará como uma
          linha na planilha, com data e hora.
        </p>

        <div className="space-y-2">
          <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">
            URL do Formulário (base, termina em /viewform)
          </label>
          <input
            type="text"
            value={feedbackFormUrl}
            onChange={(e) => setFeedbackFormUrl(e.target.value)}
            placeholder="https://docs.google.com/forms/d/e/1FAIpQLS.../viewform"
            className="w-full bg-[var(--bg)] border border-[var(--line)] px-3 py-2 rounded-xl font-mono text-xs text-[var(--ink)]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">
              Entry ID — Mensagem (obrigatório)
            </label>
            <input
              type="text"
              value={feedbackEntryMessage}
              onChange={(e) => setFeedbackEntryMessage(e.target.value)}
              placeholder="entry.123456789"
              className="w-full bg-[var(--bg)] border border-[var(--line)] px-3 py-2 rounded-xl font-mono text-xs text-[var(--ink)]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">
              Entry ID — Nome (reservado)
            </label>
            <input
              type="text"
              value={feedbackEntryName}
              onChange={(e) => setFeedbackEntryName(e.target.value)}
              placeholder="entry.987654321"
              className="w-full bg-[var(--bg)] border border-[var(--line)] px-3 py-2 rounded-xl font-mono text-xs text-[var(--ink)]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">
              Entry ID — Categoria (reservado)
            </label>
            <input
              type="text"
              value={feedbackEntryCategory}
              onChange={(e) => setFeedbackEntryCategory(e.target.value)}
              placeholder="entry.555555555"
              className="w-full bg-[var(--bg)] border border-[var(--line)] px-3 py-2 rounded-xl font-mono text-xs text-[var(--ink)]"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-[var(--muted)] font-semibold">
            Para descobrir os IDs: abra o formulário em uma aba anônima, envie um teste e veja os
            parâmetros <code className="bg-[var(--bg)] px-1 py-0.5 rounded font-mono">entry.</code>{' '}
            na URL da resposta.
          </p>
          <button
            onClick={handleSaveFeedbackConfig}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Salvar Configuração</span>
          </button>
        </div>
      </div>

      {/* Dev utilities */}
      <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-3 shadow-2xs">
        <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm border-b border-[var(--line)] pb-3">
          <Database className="w-4 h-4 text-blue-600" />
          <span>Diagnóstico & Utilidades</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3 space-y-1.5">
            <div className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">
              Estado Local
            </div>
            <div className="text-xs font-bold text-[var(--ink)]">
              {(new Blob([JSON.stringify(state)]).size / 1024).toFixed(1)} KB armazenados •{' '}
              {state.collaborators.length} colaboradores
            </div>
          </div>
          <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3 space-y-1.5">
            <div className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">
              Conexão em Nuvem
            </div>
            <div className="text-xs font-bold text-[var(--ink)]">
              {state.onlineSpreadsheet
                ? `Conectado a "${state.onlineSpreadsheet.name}"`
                : 'Sem planilha conectada'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={handleDownloadRawState}
            className="px-3.5 py-2 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--paper)] text-[var(--ink)] text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Estado Bruto (JSON)</span>
          </button>
          <button
            onClick={async () => {
              if (!state.onlineSpreadsheet?.webhookUrl) {
                showNotice('Nenhuma planilha/webhook conectado para buscar.');
                return;
              }
              showNotice('Buscando dados da planilha...');
              const ok = await fetchFromOnlineSpreadsheet(true);
              showNotice(ok ? 'Dados atualizados da planilha!' : 'Falha ao buscar da planilha.');
            }}
            className="px-3.5 py-2 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--paper)] text-[var(--ink)] text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Buscar Agora da Planilha</span>
          </button>
          <button
            onClick={handleCheckForUpdate}
            className="px-3.5 py-2 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--paper)] text-[var(--ink)] text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Revalida o service worker para carregar a versão mais recente do aplicativo"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Verificar Atualização</span>
          </button>
          <button
            onClick={handleResetDevConfig}
            className="px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Configurações do Desenvolvedor</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[var(--muted)] font-bold">
          <span className="px-2 py-0.5 rounded-md bg-[var(--bg)] border border-[var(--line)]">
            Versão: v{APP_VERSION}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-[var(--bg)] border border-[var(--line)]">
            Build: {APP_BUILD_DATE}
          </span>
          {GIT_COMMIT ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 font-mono">
              Git Ativo: {GIT_BRANCH ? `${GIT_BRANCH}@` : ''}
              {GIT_COMMIT}
            </span>
          ) : HAS_GIT ? (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Git Repositório Detectado
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Git não inicializado
            </span>
          )}
        </div>

        <p className="text-[10px] text-[var(--muted)] font-medium">
          Dica: para ocultar este menu novamente, limpe os dados locais ou apague a chave
          "escalapro_dev_mode" do armazenamento.
        </p>
      </div>
    </div>
  );
};
