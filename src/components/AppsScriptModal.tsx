import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Code2,
  Copy,
  Check,
  X,
  ExternalLink,
  ShieldAlert,
  Zap,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Radio
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getAppsScriptCode } from '../utils/appsScriptCode';
import { APPS_SCRIPT_VERSION } from '../version';

interface AppsScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const APPS_SCRIPT_CODE = getAppsScriptCode();

export const AppsScriptModal: React.FC<AppsScriptModalProps> = ({ isOpen, onClose }) => {
  const { state, showNotice, testWebhookConnection } = useApp();
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  if (!isOpen) return null;

  const currentSheetUrl = state.onlineSpreadsheet?.url || '';
  const scriptCodeToUse = getAppsScriptCode(currentSheetUrl);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(scriptCodeToUse);
    setCopied(true);
    showNotice(`Código do Google Apps Script v${APPS_SCRIPT_VERSION} copiado com sucesso!`);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRunTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testWebhookConnection();
    setTestResult(result);
    setTesting(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-[var(--paper)] border border-[var(--line)] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-6"
          >
            {/* Header */}
            <div className="bg-emerald-950 text-white p-5 flex items-center justify-between border-b border-emerald-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <span>Guia Definitivo: Sincronização com Google Sheets</span>
                    <span className="px-2 py-0.5 bg-emerald-800 text-emerald-200 text-[10px] uppercase font-black rounded-md">
                      v{APPS_SCRIPT_VERSION} Universal
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-200 font-medium">
                    Conecte sua planilha como banco de dados em nuvem em menos de 2 minutos.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-emerald-300 hover:text-white hover:bg-emerald-800/50 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Copy Script CTA Box */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-700 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="text-xs font-black text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Código do Script Personalizado {currentSheetUrl ? '(Com Link da Sua Planilha Embutido)' : ''}</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                    {currentSheetUrl
                      ? 'Este código já vem pré-configurado com o link da sua planilha atual. Cole no Apps Script para sincronização garantida!'
                      : 'Copie o código universal e cole no editor do Google Apps Script.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Código Copiado!' : 'Copiar Código do Script'}</span>
                </button>
              </div>

              {/* Dimensio Talk Redeploy Callout */}
              <div className="bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-400 dark:border-sky-700 p-4 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-sky-600 dark:text-sky-300" />
                  <div className="text-xs font-black text-sky-950 dark:text-sky-100">
                    Dimensio Talk (rádio por canais) — precisa reimplantar o script atualizado
                  </div>
                </div>
                <p className="text-[11px] text-sky-900 dark:text-sky-200 font-medium leading-relaxed">
                  A presença ("0 online") e o áudio por canais dependem do script <strong>atualizado</strong> (bloco{' '}
                  <code className="bg-sky-200 dark:bg-sky-900 px-1 py-0.5 rounded text-[10px]">__SIGNAL__</code>).{' '}
                  <strong>Copie o código acima</strong> e:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-sky-900 dark:text-sky-200 font-semibold">
                  <li>
                    <strong>Se ainda não implantou:</strong> siga os passos 1 a 5 abaixo.
                  </li>
                  <li>
                    <strong>Se você tem um webhook já em uso (URL /exec):</strong> <strong className="text-rose-600 dark:text-rose-300">NÃO crie uma nova implantação</strong> — isso geraria uma URL nova e quebraria a conexão. Em vez disso, no Apps Script use{' '}
                    <strong>Implantar → Gerenciar implantações → ✏️ Editar → Versão: "Nova versão" → Implantar</strong>. A URL continua a mesma.
                  </li>
                </ul>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black">
                  <span className="px-2 py-1 rounded-lg bg-sky-600 text-white">Executar como: Eu</span>
                  <span className="px-2 py-1 rounded-lg bg-slate-800 text-white">Acesso: Qualquer pessoa</span>
                  <span className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
                    Aba __SIGNAL__ criada automaticamente na 1ª conexão
                  </span>
                </div>
              </div>

              {/* Step-by-step Guide */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-[var(--ink)] uppercase tracking-wider border-b border-[var(--line)] pb-2">
                  Passo a Passo Ilustrado (5 Passos Simples)
                </h4>

                <div className="space-y-3.5 text-xs text-[var(--ink)]">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3 p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs font-black flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-2">
                        <span>Abra sua Planilha no Google Sheets</span>
                        <a
                          href={currentSheetUrl || "https://sheets.new"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--primary)] font-extrabold underline hover:no-underline"
                        >
                          <span>{currentSheetUrl ? "Abrir Planilha Atual" : "Criar nova no Google Sheets"}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-[11px] text-[var(--muted)]">
                        Abra a planilha oficial da sua equipe do Google Drive.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3 p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs font-black flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold">Abra o Editor do Google Apps Script</div>
                      <p className="text-[11px] text-[var(--muted)]">
                        No menu superior da planilha, clique em <strong className="text-[var(--ink)]">Extensões</strong> → <strong className="text-[var(--ink)]">Apps Script</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3 p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs font-black flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div className="space-y-1.5 w-full">
                      <div className="font-bold flex items-center justify-between">
                        <span>Substitua todo o código no arquivo `Código.gs`</span>
                        <button
                          onClick={handleCopyCode}
                          className="text-[11px] text-[var(--primary)] font-extrabold hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copiar novamente</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-[var(--muted)]">
                        Apague qualquer texto que esteja no editor e cole o código copiado. Clique no ícone de <strong className="text-[var(--ink)]">Salvar (Ctrl + S)</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 - Crucial Step */}
                  <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                      4
                    </div>
                    <div className="space-y-2">
                      <div className="font-black text-amber-950 dark:text-amber-100 flex items-center gap-1.5 text-xs">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        <span>Implantar como App da Web (Ponto mais importante!)</span>
                      </div>
                      <div className="text-[11px] text-amber-900 dark:text-amber-200 space-y-1 font-medium">
                        <p>No canto superior direito do Apps Script, clique em <strong>Implantar</strong> → <strong>Nova Implantação</strong>.</p>
                        <ul className="list-disc list-inside space-y-1 pt-1">
                          <li>Tipo: Clique na engrenagem ⚙️ e escolha <strong>App da Web</strong>.</li>
                          <li>Executar como: Escolha <strong>Eu (seu email)</strong>.</li>
                          <li>
                            Quem tem acesso:{' '}
                            <strong className="bg-amber-200 dark:bg-amber-900 px-1.5 py-0.5 rounded text-amber-950 dark:text-amber-100 uppercase font-black">
                              "Qualquer pessoa" (Anyone)
                            </strong>
                          </li>
                        </ul>
                        <p className="text-[10px] text-amber-800 dark:text-amber-300 italic pt-1">
                          ⚠️ Se deixar em "Apenas eu", a planilha bloqueará o envio automático de dados do sistema!
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="flex items-start gap-3 p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                      5
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold">Copiar a URL do Webhook e Salvar</div>
                      <p className="text-[11px] text-[var(--muted)]">
                        Clique em <strong>Implantar</strong>, autorize o acesso da sua conta e copie a <strong className="text-emerald-600 dark:text-emerald-400 font-bold">URL do App da Web</strong> (deve terminar em <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">/exec</code>). Cole essa URL no campo de Webhook das Opções e salve!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Test Section inside Modal */}
              <div className="bg-[var(--bg)] border border-[var(--line)] p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-extrabold text-[var(--ink)]">Diagnóstico & Teste de Conexão</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunTest}
                    disabled={testing || !state.onlineSpreadsheet?.webhookUrl}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                    <span>{testing ? 'Testando...' : 'Testar Conexão Agora'}</span>
                  </button>
                </div>

                {testResult && (
                  <div className={`p-3 rounded-lg text-xs border ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-100 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-950 border-rose-300 dark:bg-rose-950/60 dark:text-rose-100 dark:border-rose-800'
                  }`}>
                    <div className="flex items-center gap-2 font-bold mb-1">
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                      <span>{testResult.message}</span>
                    </div>
                    {testResult.details && (
                      <p className="text-[11px] opacity-90 pl-6 leading-relaxed">
                        {testResult.details}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Code Viewer Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[var(--ink)]">Visualização do Código Fonte (.gs v{APPS_SCRIPT_VERSION})</span>
                  <button
                    onClick={handleCopyCode}
                    className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar código completo</span>
                  </button>
                </div>
                <div className="relative">
                  <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed border border-slate-800 select-all">
                    <code>{scriptCodeToUse}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[var(--bg)] border-t border-[var(--line)] flex items-center justify-between">
              <span className="text-xs text-[var(--muted)] font-semibold">
                Sincronia 100% automática a cada alteração na escala.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-[var(--primary)] text-white text-xs font-black rounded-xl hover:bg-[var(--primary-hover)] cursor-pointer shadow-xs"
              >
                Entendi / Fechar Guia
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
