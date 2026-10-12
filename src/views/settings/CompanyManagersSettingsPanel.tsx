import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  activeOwners,
  revokedManagers,
  matchActiveManager,
} from '../../utils/companyManagers';
import { ConfirmModal } from '../../components/ConfirmModal';
import {
  KeyRound,
  Lock,
  Plus,
  Users,
  History,
  RotateCcw,
  Key,
  ShieldAlert,
  Trash2,
} from 'lucide-react';

interface CompanyManagersSettingsPanelProps {
  checkPermissionOrAlert: (requireAdmin?: boolean) => boolean;
}

export const CompanyManagersSettingsPanel: React.FC<CompanyManagersSettingsPanelProps> = ({
  checkPermissionOrAlert,
}) => {
  const {
    state,
    identifiedUser,
    addCompanyManager,
    setCompanyManagerRole,
    revokeCompanyManager,
    reactivateCompanyManager,
    transferCompanyOwnership,
    claimCompanyOwnership,
    setUserPassword,
    deleteCurrentUserAccount,
    showNotice,
  } = useApp();

  const [mgrName, setMgrName] = useState('');
  const [mgrEmail, setMgrEmail] = useState('');
  const [mgrRole, setMgrRole] = useState<'owner' | 'admin'>('admin');
  const [mgrCollab, setMgrCollab] = useState('');
  const [mgrNotes, setMgrNotes] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [masterPassAdmin, setMasterPassAdmin] = useState('');
  const [masterPassSuper, setMasterPassSuper] = useState('');
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);

  const managers = state.companyManagers || [];
  const owners = activeOwners(managers);
  const revoked = revokedManagers(managers);
  const actives = managers.filter((m) => m.status === 'active');
  const myMgr = identifiedUser
    ? managers.find((m) => m.id === (identifiedUser.managerId || '')) ||
      matchActiveManager(managers, {
        email: identifiedUser.email,
        firebaseUid: identifiedUser.firebaseUid,
        collaboratorId: identifiedUser.collaboratorId,
        id: identifiedUser.id,
      })
    : null;
  const iAmMaster =
    identifiedUser?.isSuperAdmin === true || identifiedUser?.id === 'super_admin';
  const iAmOwner =
    iAmMaster ||
    (myMgr?.status === 'active' && myMgr.role === 'owner') ||
    identifiedUser?.isCompanyOwner === true;
  const canView = Boolean(
    identifiedUser &&
      (identifiedUser.isAdmin || identifiedUser.isSuperAdmin || myMgr?.status === 'active')
  );

  const roleBadge = (role: string) =>
    role === 'owner' ? (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase border bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400">
        👑 Dono
      </span>
    ) : (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase border bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400">
        🛠️ Gestor
      </span>
    );

  if (!canView) {
    return (
      <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm">
          <Lock className="w-5 h-5 text-[var(--primary)]" />
          <h3>Gestores da Empresa</h3>
        </div>
        <p className="text-xs text-[var(--muted)] font-medium leading-relaxed mt-2">
          Identifique-se como gestor/administrador para ver quem administra esta empresa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[var(--line)] pb-3">
          <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm">
            <KeyRound className="w-5 h-5 text-[var(--primary)]" />
            <h3>Gestores da Empresa</h3>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black">
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              {owners.length} dono(s)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
              {actives.length - owners.length} gestor(es)
            </span>
            {revoked.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-slate-500/15 text-[var(--muted)] border border-[var(--line)]">
                {revoked.length} revogado(s)
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-[var(--muted)] font-medium leading-relaxed">
          A empresa não tem dono único: <strong>donos</strong> gerenciam outros gestores e transferem a titularidade;{' '}
          <strong>gestores</strong> administram a operação. Sempre existe ao menos um dono ativo — o sistema bloqueia a
          remoção do último. Revogar um acesso <strong>nunca apaga dados</strong> (equipe, escalas, histórico): só encerra o
          acesso administrativo, com backup automático de segurança.
        </p>

        {myMgr && (
          <p className="text-[11px] font-bold text-[var(--muted)]">
            Sua situação: {roleBadge(myMgr.role)} <span className="ml-1">{myMgr.name}</span>
            {myMgr.status === 'revoked' && <span className="ml-1 text-rose-500">(acesso revogado)</span>}
          </p>
        )}

        {owners.length === 0 && (
          <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="text-xs font-black text-amber-800 dark:text-amber-200">
                Nenhum dono ativo na empresa
              </div>
              <div className="text-[11px] text-[var(--muted)] font-medium">
                Como você está identificado como administrador, pode assumir a titularidade para recuperar a gestão.
              </div>
            </div>
            <button
              type="button"
              onClick={() => claimCompanyOwnership()}
              className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer"
            >
              Assumir titularidade
            </button>
          </div>
        )}
      </div>

      {iAmOwner && (
        <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm border-b border-[var(--line)] pb-3">
            <Plus className="w-5 h-5 text-[var(--primary)]" />
            <h3>Adicionar gestor</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              value={mgrName}
              onChange={(e) => setMgrName(e.target.value)}
              placeholder="Nome do gestor *"
              className="p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
            />
            <input
              value={mgrEmail}
              onChange={(e) => setMgrEmail(e.target.value)}
              placeholder="E-mail de login (Google/conta) *"
              type="email"
              className="p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
            />
            <select
              value={mgrRole}
              onChange={(e) => setMgrRole(e.target.value as 'owner' | 'admin')}
              className="p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
            >
              <option value="admin">🛠️ Gestor (opera a empresa)</option>
              <option value="owner">👑 Dono (gerencia gestores)</option>
            </select>
            <select
              value={mgrCollab}
              onChange={(e) => setMgrCollab(e.target.value)}
              className="p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
            >
              <option value="">Vincular colaborador (opcional)</option>
              {(state.collaborators || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} • {c.role}
                </option>
              ))}
            </select>
          </div>
          <input
            value={mgrNotes}
            onChange={(e) => setMgrNotes(e.target.value)}
            placeholder="Observação (opcional): ex. responsável pelo turno da noite"
            className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
          />
          <button
            type="button"
            onClick={() => {
              const r = addCompanyManager({
                name: mgrName,
                email: mgrEmail || undefined,
                collaboratorId: mgrCollab || undefined,
                role: mgrRole,
                notes: mgrNotes || undefined,
              });
              if (r.success) {
                setMgrName('');
                setMgrEmail('');
                setMgrRole('admin');
                setMgrCollab('');
                setMgrNotes('');
              }
            }}
            className="px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-black cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Cadastrar gestor
          </button>
        </div>
      )}

      <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-3 shadow-2xs">
        <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm border-b border-[var(--line)] pb-3">
          <Users className="w-5 h-5 text-[var(--primary)]" />
          <h3>Quadro atual ({actives.length})</h3>
        </div>
        {actives.length === 0 && (
          <p className="text-xs text-[var(--muted)] italic">Nenhum gestor ativo. Cadastre o primeiro acima.</p>
        )}
        <div className="space-y-2">
          {actives.map((m) => {
            const isSelf = myMgr?.id === m.id;
            return (
              <div
                key={m.id}
                className="p-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)] flex flex-wrap items-center gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-[var(--ink)]">{m.name}</span>
                    {roleBadge(m.role)}
                    {isSelf && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        você
                      </span>
                    )}
                  </div>
                  <div className="text-[10.5px] text-[var(--muted)] font-medium mt-0.5 truncate">
                    {[m.email, m.addedByName ? `indicado por ${m.addedByName}` : null]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                </div>
                {iAmOwner && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {m.role === 'admin' ? (
                      <button
                        type="button"
                        title="Promover a dono"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Promover "${m.name}" a DONO da empresa? Donos podem gerenciar gestores.`
                            )
                          ) {
                            setCompanyManagerRole(m.id, 'owner');
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer"
                      >
                        ↑ Virar dono
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Rebaixar a gestor"
                        onClick={() => {
                          if (window.confirm(`Rebaixar "${m.name}" de dono para gestor?`)) {
                            setCompanyManagerRole(m.id, 'admin');
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 cursor-pointer"
                      >
                        ↓ Virar gestor
                      </button>
                    )}
                    <button
                      type="button"
                      title="Revogar acesso (sem apagar dados)"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Revogar o acesso de "${m.name}"?${
                              isSelf ? ' ATENÇÃO: este é o SEU acesso — sua sessão será encerrada.' : ''
                            } Nenhum dado da empresa será apagado e um backup de segurança será criado.`
                          )
                        ) {
                          revokeCompanyManager(m.id);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 cursor-pointer"
                    >
                      Revogar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {iAmOwner && (
        <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm border-b border-[var(--line)] pb-3">
            <KeyRound className="w-5 h-5 text-[var(--primary)]" />
            <h3>Transferir titularidade (passar o bastão)</h3>
          </div>
          <p className="text-xs text-[var(--muted)] font-medium leading-relaxed">
            Selecione outro gestor para assumir a titularidade principal. Ele continuará como dono.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              className="flex-1 p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
            >
              <option value="">Escolha quem receberá a titularidade...</option>
              {actives
                .filter((m) => m.id !== myMgr?.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email || 'sem e-mail'}) • {m.role === 'owner' ? 'já é dono' : 'gestor'}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!transferTo}
              onClick={() => {
                const target = actives.find((m) => m.id === transferTo);
                if (
                  window.confirm(
                    `Transferir titularidade para "${target?.name || 'gestor'}"? Um backup de segurança será gerado automaticamente.`
                  )
                ) {
                  const r = transferCompanyOwnership(transferTo);
                  if (r.success) setTransferTo('');
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-black cursor-pointer"
            >
              Transferir
            </button>
          </div>
        </div>
      )}

      {revoked.length > 0 && (
        <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-3 shadow-2xs opacity-90">
          <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm border-b border-[var(--line)] pb-3">
            <History className="w-5 h-5 text-[var(--muted)]" />
            <h3>Acessos revogados ({revoked.length})</h3>
          </div>
          <div className="space-y-2">
            {revoked.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)] flex flex-wrap items-center gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-[var(--muted)] line-through">{m.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase border bg-slate-500/15 border-[var(--line)] text-[var(--muted)]">
                      revogado
                    </span>
                  </div>
                  <div className="text-[10.5px] text-[var(--muted)] font-medium mt-0.5">
                    {[m.email, m.revokedByName ? `revogado por ${m.revokedByName}` : null]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                </div>
                {iAmOwner && (
                  <button
                    type="button"
                    onClick={() => reactivateCompanyManager(m.id)}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Reativar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {iAmOwner && (
        <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm border-b border-[var(--line)] pb-3">
            <Key className="w-5 h-5 text-[var(--primary)]" />
            <h3>Senhas mestras locais</h3>
          </div>
          <p className="text-xs text-[var(--muted)] font-medium leading-relaxed">
            As contas <code className="px-1 rounded bg-[var(--surface-2)]">admin</code> e{' '}
            <code className="px-1 rounded bg-[var(--surface-2)]">super_admin</code> entram com senha compartilhada, fora do
            quadro acima. Quando um gestor sair, <strong>troque essas senhas</strong> para que ele não entre mais por elas.
            Estado atual: admin ({state.userPasswords?.['admin'] ? 'definida' : 'não definida'}) • super_admin (
            {state.userPasswords?.['super_admin'] ? 'definida' : 'não definida'}).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <input
                value={masterPassAdmin}
                onChange={(e) => setMasterPassAdmin(e.target.value)}
                placeholder="Nova senha da conta admin"
                type="password"
                className="flex-1 p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
              />
              <button
                type="button"
                onClick={() => {
                  if (masterPassAdmin.trim().length < 4) {
                    showNotice('A nova senha da conta admin deve ter ao menos 4 caracteres.');
                    return;
                  }
                  if (!checkPermissionOrAlert(true)) return;
                  setUserPassword('admin', masterPassAdmin.trim());
                  setMasterPassAdmin('');
                }}
                className="px-3 py-2.5 rounded-xl bg-[var(--paper)] border border-[var(--line)] text-xs font-black text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer"
              >
                Salvar
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={masterPassSuper}
                onChange={(e) => setMasterPassSuper(e.target.value)}
                placeholder="Nova senha da conta super_admin"
                type="password"
                className="flex-1 p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
              />
              <button
                type="button"
                onClick={() => {
                  if (masterPassSuper.trim().length < 4) {
                    showNotice('A nova senha da conta super_admin deve ter ao menos 4 caracteres.');
                    return;
                  }
                  if (!checkPermissionOrAlert(true)) return;
                  setUserPassword('super_admin', masterPassSuper.trim());
                  setMasterPassSuper('');
                }}
                className="px-3 py-2.5 rounded-xl bg-[var(--paper)] border border-[var(--line)] text-xs font-black text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exclusão de Conta & Privacidade LGPD/GDPR */}
      <div className="bg-red-50/70 dark:bg-red-950/25 border border-red-200 dark:border-red-900/60 p-5 rounded-2xl space-y-3 shadow-2xs">
        <div className="flex items-center gap-2 text-red-900 dark:text-red-200 font-black text-sm border-b border-red-200 dark:border-red-900/40 pb-3">
          <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h3>Exclusão de Conta & Privacidade (LGPD / GDPR)</h3>
        </div>
        <p className="text-xs text-red-800 dark:text-red-300 font-medium leading-relaxed">
          Ao excluir sua conta, suas credenciais de login no Firebase Authentication e seu perfil em nuvem? Esta ação não pode ser desfeita. Digite EXCLUIR para confirmar.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-[11px] text-[var(--muted)]">
            Usuário conectado: <span className="font-bold text-[var(--ink)]">{identifiedUser?.name || 'Gestor'}</span> ({identifiedUser?.email || 'Login local'})
          </div>
          <button
            type="button"
            onClick={() => setIsDeleteAccountModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Excluir Minha Conta
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteAccountModalOpen}
        onClose={() => setIsDeleteAccountModalOpen(false)}
        onConfirm={async () => {
          setIsDeleteAccountModalOpen(false);
          await deleteCurrentUserAccount();
        }}
        title="Excluir Minha Conta e Credenciais"
        description="Tem certeza de que deseja excluir permanentemente sua conta de gestor do Firebase Authentication e seu perfil em nuvem? Esta ação não pode ser desfeita. Digite EXCLUIR para confirmar."
        confirmText="Excluir Permanentemente"
        requireKeyword="EXCLUIR"
      />
    </div>
  );
};
