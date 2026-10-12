import React from 'react';
import { useApp } from '../../context/AppContext';
import { RoleAccessLevel } from '../../types';
import {
  Award,
  Lock,
  ShieldCheck,
  Check,
  Database,
  Wifi,
  UserCheck,
} from 'lucide-react';

interface EditorRolesSettingsPanelProps {
  checkPermissionOrAlert: (requireAdmin?: boolean) => boolean;
}

export const EditorRolesSettingsPanel: React.FC<EditorRolesSettingsPanelProps> = ({
  checkPermissionOrAlert,
}) => {
  const {
    state,
    setRolePermission,
    setRequireUserPassword,
    sessionConfig,
    setSessionConfig,
    cloudOnline,
    identifiedUser,
    logoutUser,
    showNotice,
  } = useApp();

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
        <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm border-b border-[var(--line)] pb-3">
          <Award className="w-5 h-5 text-[var(--primary)]" />
          <h3>Configuração de Níveis de Acesso por Cargo</h3>
        </div>
        <p className="text-xs text-[var(--muted)] font-medium leading-relaxed">
          Defina as permissões de acesso para cada cargo. Colaboradores da base terão acesso restrito de acordo com o nível configurado.
        </p>

        <div className="space-y-3 pt-2">
          {state.roles.map((role) => {
            const currentLevel: RoleAccessLevel =
              state.rolePermissions?.[role] ||
              (role === 'TL' || role === 'Admin' ? 'admin' : role === 'PS' ? 'editor' : 'portal');
            return (
              <div
                key={role}
                className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] space-y-3"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <Award className="w-4 h-4 text-[var(--primary)]" />
                    <span className="text-sm font-black text-[var(--ink)]">{role}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                      currentLevel === 'admin'
                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400'
                        : currentLevel === 'editor'
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                        : currentLevel === 'viewer'
                        ? 'bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400'
                        : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {currentLevel === 'admin' && 'Administrador (Acesso Total)'}
                    {currentLevel === 'editor' && 'Editor (Gestão e Edição)'}
                    {currentLevel === 'viewer' && 'Visualizador (Apenas Leitura)'}
                    {currentLevel === 'portal' && 'Só Portal (Restrito à Base)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'portal', label: 'Só Portal', desc: 'Acesso restrito ao Portal Operacional (coletores)' },
                    { id: 'viewer', label: 'Visualizador', desc: 'Apenas leitura do painel de gestão' },
                    { id: 'editor', label: 'Editor', desc: 'Gerenciar escalas, tarefas e relatórios' },
                    { id: 'admin', label: 'Administrador', desc: 'Acesso total e configurações' },
                  ].map((lvl) => {
                    const isSelected = currentLevel === lvl.id;
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => {
                          if (!checkPermissionOrAlert(true)) return;
                          setRolePermission(role, lvl.id as RoleAccessLevel);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-extrabold'
                            : 'bg-[var(--paper)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
                        }`}
                      >
                        <div className="text-xs font-black">{lvl.label}</div>
                        <div
                          className={`text-[9.5px] mt-1 leading-tight font-medium ${
                            isSelected ? 'text-white/80' : 'text-[var(--muted)]'
                          }`}
                        >
                          {lvl.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* POLÍTICA DE SENHA DO SETOR (EXIGÊNCIA DE SENHA) */}
      <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm">
            <Lock className="w-5 h-5 text-[var(--primary)]" />
            <h3>Política de Senha do Setor (Identificação)</h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
              state.requireUserPassword
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {state.requireUserPassword ? '🔒 Senha Obrigatória' : '🔓 Senha Opcional'}
          </span>
        </div>
        <p className="text-xs text-[var(--muted)] font-medium leading-relaxed">
          Defina se todos os colaboradores do setor devem obrigatoriamente possuir e digitar uma senha ao se identificar no sistema, ou se a identificação pode ser direta (opcional).
        </p>

        {/* Mode Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              if (!checkPermissionOrAlert(true)) return;
              setRequireUserPassword(false);
              showNotice('Política de identificação atualizada: Senha Opcional.');
            }}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
              !state.requireUserPassword
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-extrabold ring-2 ring-[var(--primary)]/30'
                : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-black flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Identificação Direta (Senha Opcional)</span>
              </div>
              {!state.requireUserPassword && <Check className="w-4 h-4" />}
            </div>
            <p
              className={`text-[11px] leading-relaxed font-medium ${
                !state.requireUserPassword ? 'text-white/85' : 'text-[var(--muted)]'
              }`}
            >
              Colaboradores podem se identificar selecionando o nome diretamente na lista sem senha obrigatória.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!checkPermissionOrAlert(true)) return;
              setRequireUserPassword(true);
              showNotice('Política de identificação atualizada: Senha Obrigatória para todos.');
            }}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
              state.requireUserPassword
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-extrabold ring-2 ring-[var(--primary)]/30'
                : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-black flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span>Identificação Protegida (Senha Obrigatória)</span>
              </div>
              {state.requireUserPassword && <Check className="w-4 h-4" />}
            </div>
            <p
              className={`text-[11px] leading-relaxed font-medium ${
                state.requireUserPassword ? 'text-white/85' : 'text-[var(--muted)]'
              }`}
            >
              Exige que todo colaborador tenha senha cadastrada para acessar suas tarefas e painéis na base.
            </p>
          </button>
        </div>
      </div>

      {/* POLÍTICA DE ARMAZENAMENTO & ISOLAMENTO */}
      <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm">
            <Database className="w-5 h-5 text-[var(--primary)]" />
            <h3>Política de Armazenamento e Isolamento de Dados</h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
              sessionConfig.sessionOnly
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
            }`}
          >
            {sessionConfig.sessionOnly ? '🔒 Somente na Sessão' : '💾 Persistente Local'}
          </span>
        </div>
        <p className="text-xs text-[var(--muted)] font-medium leading-relaxed">
          Defina se os dados locais do aplicativo devem ser mantidos apenas enquanto a aba estiver aberta ou salvos persistentemente no navegador.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              if (!checkPermissionOrAlert(true)) return;
              setSessionConfig({ sessionOnly: true });
              showNotice('Armazenamento de sessão ativado: nenhum dado fica gravado neste navegador.');
            }}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
              sessionConfig.sessionOnly
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-extrabold ring-2 ring-[var(--primary)]/30'
                : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-black flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Somente na sessão (Recomendado)</span>
              </div>
              {sessionConfig.sessionOnly && <Check className="w-4 h-4" />}
            </div>
            <p
              className={`text-[11px] leading-relaxed font-medium ${
                sessionConfig.sessionOnly ? 'text-white/85' : 'text-[var(--muted)]'
              }`}
            >
              Dados de equipe e identidade ficam só na memória da sessão e somem ao fechar a aba. A próxima pessoa não vê nada seu e não consegue usar sua conta.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!checkPermissionOrAlert(true)) return;
              setSessionConfig({ sessionOnly: false });
              showNotice(
                'Persistência local ativada: os dados passarão a ser gravados neste navegador. Exporte um backup antes de trocar de política.'
              );
            }}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
              !sessionConfig.sessionOnly
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-extrabold ring-2 ring-[var(--primary)]/30'
                : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-black flex items-center gap-2">
                <Database className="w-4 h-4" />
                <span>Persistir neste navegador</span>
              </div>
              {!sessionConfig.sessionOnly && <Check className="w-4 h-4" />}
            </div>
            <p
              className={`text-[11px] leading-relaxed font-medium ${
                !sessionConfig.sessionOnly ? 'text-white/85' : 'text-[var(--muted)]'
              }`}
            >
              Mantém os dados salvos neste navegador (localStorage). Use apenas se o dispositivo não é compartilhado. A identidade do usuário continua sendo sempre por sessão.
            </p>
          </button>
        </div>

        {/* Modo sempre conectado */}
        <div className="flex items-start justify-between gap-4 bg-[var(--bg)] border border-[var(--line)] rounded-2xl p-4">
          <div className="space-y-1">
            <div className="text-xs font-black text-[var(--ink)] flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-600" />
              Modo sempre conectado
            </div>
            <p className="text-[11px] text-[var(--muted)] font-medium leading-relaxed">
              Quando ativo, o portal opera somente online com a planilha compartilhada. Sem conexão, nada pode ser alterado (somente leitura) até reconectar — eliminando o risco de divergência e sobrescrita entre local e online.
            </p>
            <p className="text-[10px] text-[var(--muted)]/80 font-bold">
              Status atual:{' '}
              <span className={cloudOnline ? 'text-emerald-600' : 'text-amber-600'}>
                {cloudOnline ? 'Conexão ativa' : 'Sem conexão'}
              </span>{' '}
              {state.onlineSpreadsheet?.webhookUrl ? '' : '• Nenhuma planilha conectada'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={sessionConfig.alwaysOnline}
            onClick={() => {
              if (!checkPermissionOrAlert(true)) return;
              setSessionConfig({ alwaysOnline: !sessionConfig.alwaysOnline });
              showNotice(
                sessionConfig.alwaysOnline
                  ? 'Modo sempre conectado desativado.'
                  : 'Modo sempre conectado ativado: o portal exigirá conexão para permitir alterações.'
              );
            }}
            className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer shrink-0 ${
              sessionConfig.alwaysOnline ? 'bg-emerald-600' : 'bg-[var(--line)]'
            }`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
                sessionConfig.alwaysOnline ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Acesso anônimo */}
        <div className="flex items-start justify-between gap-4 bg-[var(--bg)] border border-[var(--line)] rounded-2xl p-4">
          <div className="space-y-1">
            <div className="text-xs font-black text-[var(--ink)] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-600" />
              Bloquear acesso anônimo
            </div>
            <p className="text-[11px] text-[var(--muted)] font-medium leading-relaxed">
              Quando ativo, o portal exige uma <strong>tela de login</strong> ao abrir. A pessoa escolhe seu usuário (colaborador/TL/administrador) e digita a senha cadastrada. Cada sessão termina ao fechar a aba — ninguém herda o acesso de outra pessoa.
            </p>
            {identifiedUser && (
              <p className="text-[10px] text-[var(--muted)]/80 font-bold">
                Sessão atual: {identifiedUser.name} (
                <button
                  type="button"
                  onClick={() => {
                    logoutUser();
                    showNotice('Sessão encerrada. Na próxima abertura o login será solicitado.');
                  }}
                  className="underline cursor-pointer text-amber-600 hover:text-amber-700"
                >
                  encerrar
                </button>
                )
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={sessionConfig.allowAnonymousAccess === false}
            onClick={() => {
              if (!checkPermissionOrAlert(true)) return;
              const block = sessionConfig.allowAnonymousAccess !== false;
              setSessionConfig({ allowAnonymousAccess: !block });
              showNotice(
                block
                  ? 'Acesso anônimo bloqueado: será solicitado login ao abrir o portal.'
                  : 'Acesso anônimo liberado novamente.'
              );
            }}
            className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer shrink-0 ${
              sessionConfig.allowAnonymousAccess === false ? 'bg-amber-600' : 'bg-[var(--line)]'
            }`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
                sessionConfig.allowAnonymousAccess === false
                  ? 'left-[calc(100%-1.625rem)]'
                  : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
