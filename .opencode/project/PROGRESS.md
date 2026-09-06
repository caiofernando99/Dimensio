# Dimensio — Progress Summary

## Objective
- Aprimorar o sistema de sessão/sincronização para nunca mais perder dados (incidente crítico já corrigido) e implementar: dados do portal apenas durante a sessão (por padrão), modo "sempre conectado" (bloqueia edição offline), tela de login quando o acesso anônimo estiver desabilitado, métricas associadas a tarefas, e reescrever a extensão (seletor de elementos que funcione, sequências de cliques/fluxos, gatilhos de URL para preenchimento rápido).
- **Novo modelo de contagem (decisão do usuário)**: um posto (tarefa) NÃO é dividido por área — a mesma tarefa atende VÁRIAS áreas que "surgem sob demanda". Para medir o pendente por área, a extensão aplica filtros (fluxo) e conta as ocorrências de cada nome de área na página (estilo CTRL+F).
- **Menu de navegação na tela de Equipe/Cadastros** (estilo Configurações): seções longas demais, elementos escondidos no fundo; menu lateral sticky com scroll suave + scroll-spy.
- **Rádio PTT por canal selecionado**: ao trocar de canal e falar, a transmissão deve ir SÓ para o canal ativo (ex: canal da tarefa) — não para o canal geral — permitindo comunicação por tarefa entre operadores e com a direção sem poluir o canal geral.
- **Portal responsivo**: UI do Portal do Operador deve se adaptar a todos os tamanhos de tela (abas que não estouram, cards que quebram linha, altura de viewport móvel).

## Important Details
- Repo: `D:\Documentos\@PROJETO\Dimensio\dimensio`; React 19 + Tailwind v4 + motion. Verificação: `npx tsc --noEmit` limpo, `npx vitest run` (32 testes) OK, `npm run build` OK, `node --check` OK nos 3 JS da extensão.
- Decisões confirmadas pelo usuário (via question tool): (1) armazenamento = "Sessão por padrão + opção persistir" (sessionStorage por padrão; opção localStorage em Configurações); (2) login = reutilizar senhas atuais (`userPasswords`/`requireUserPassword`); (3) modo sempre conectado com conexão caída = bloquear edição (somente leitura). Para métricas↔tarefas: resumo por área no MetricManager E Portal do Operador; coleta via extensão + fallback manual; áreas definidas como termos de contagem (nomes que aparecem na página), não como campo da tarefa.
- Causa raiz do incidente de perda de dados: `fetchLatestCloudBackup` chamava `applyRemoteToLocal` sem guarda de novidade — um snapshot antigo da nuvem sobrescrevia edições locais mais novas (via polling em background, ~2s). Não havia backup de segurança antes da recuperação por backup de nuvem, e o push no carregamento era pulado (first-render skip). Dados antigos do usuário provavelmente irrecuperáveis.
- `SyncProvider` NÃO é montado (só `AppProvider` em App.tsx/main.tsx) — SyncContext.tsx é código morto; só as mudanças de storage no AppContext importam.
- `identifiedUser` passa a ser SEMPRE sessionStorage. Configurações do dispositivo (sessionOnly/alwaysOnline/allowAnonymousAccess) persistem em localStorage (`dimensio_session_config_v1`).
- STORAGE_KEY continua `people-scheduler-v3` (sem bump). Git continua corrompido (objeto `f83355ce...`) — não reparar/comitar sem aval.
- Extensão: dois pacotes MV3 — `public/extension/` (base, `<all_urls>`, distribuída via zip na Ajuda) e `chrome-extension/` (Notificações, só Google Sheets). A reescrita Automa foi feita APENAS na `public/extension` (não tocar o espelho chrome-extension para essas features).
- A extensão NÃO foi re-empacotada/distribuída ainda (zip da Ajuda via `downloadExtensionZip`/public/extension).

## Work State
### Completed
- **Correção crítica de sync (AppContext.tsx)**: `applyRemoteToLocal(remote, updatedAtMs, opts?)` com guarda de novidade + backup de segurança; `fetchLatestCloudBackup` nunca aplica backup mais antigo; aviso único quando a nuvem está mais antiga; bootstrap de sessão no mount.
- **Sistema de sessão (storage policy)**: `src/utils/storagePolicy.ts`; AppContext roteia estado/persistência/backups/caches/identidade; `sessionConfig`, `cloudOnline`, `isConnectionBlocked()`; `updateLocalState` bloqueia edição offline no modo sempre conectado.
- **Gate de sessão no App shell (App.tsx)**: `alwaysOnlineBlocked` → `<AlwaysOnlineOverlay>`; acesso anônimo bloqueado → `<LoginScreen>`. Novos: `src/components/AlwaysOnlineOverlay.tsx`, `src/components/LoginScreen.tsx`.
- **Seção "Sessão & Segurança do Dispositivo"** em SettingsView.tsx (aba editor_roles): modos de armazenamento, toggle "Modo sempre conectado", toggle "Bloquear acesso anônimo".
- **Modelo de contagem por ocorrência de texto (CTRL+F)**:
  - `types.ts`: **removido** `Task.area`. Novo `MetricCountTerm {id, area, selector?}`. `MetricDefinition` ganha `countTerms?`, `countScope?`, `countKind?` ('pending'|'processing'|'generic'). Mantidos `kind` ('generic'|'task_counts'), `flow?`, `MetricFlowStep`, `TaskAreaCount`, `InfoHubQuickFill.triggerUrl`.
  - `TaskModal`: campo "Área/Andar" removido.
  - AppContext: `ensureTaskCountMetric(taskId, kind?)` cria métrica por visão (Pendentes/Em processamento) com `countTerms: []`, `countScope`, `countKind`, `fields: []`; `getTaskAreaCounts()` agrega a leitura mais recente de cada métrica, somando por NOME de área (values chaveados por área) e roteando pendente/processando por `countKind`; novo handler `dimensio-metric-count-config-result` (persiste termos/escopo vindos da extensão); coleta agendada envia `mode:'count'` + `countTerms`/`countScope`/`flow`.
  - MetricManager: seleção de tipo no formulário ("Valores por campo" vs "Contagem de áreas (CTRL+F)"); editor de termos (nome + seletor opcional), escopo e visão filtrada; presets "Pendentes"/"Processando" por posto no cabeçalho do grupo; badges "N área(s)"; leitura manual por área; gráfico por área; lista de coletas legível.
  - Portal do Operador: painel "Tarefas por área" (supervisores) com texto atualizado.
- **Extensão (public/extension) reescrita — interface estilo Automa**:
  - `content.js`: **modo 'count'** em `runCollect` (roda o fluxo e conta ocorrências por termo com `countOccurrencesIn`, bordas de palavra, ignora nós `[data-dimensio-ui]`, escopo por termo ou `countScope`); `runCollect` mantém modo 'extract' para campos; DIMENSIO_COLLECT agora **substitui por metricId** (evita duplicados); gravação de fluxo também atualiza a coleta local; toolbar/badge mostram "N áreas" para contagens e esconde "Marcar" nesses casos.
  - `background.js`: relay de `countConfigResult` → `metricCountConfigResult` para o app.
  - `popup.js` + `popup.html`: cartões expansíveis (estilo Automa) por métrica — badges (Contagem/Coleta, passos, áreas), editor de passos do fluxo (tipo, parâmetros, ↑/↓/✕, adicionar), editor de áreas (nome + seletor + escopo + adicionar), botões "▶ Coletar aqui", "🎬 Gravar na página", "Limpar fluxo". Edições são persistidas localmente (chrome.storage.local) e enviadas ao app (debounce 600ms) via `flowResult`/`countConfigResult`.
- **Menu de navegação em TeamView (estilo Configurações)**: layout `lg:grid-cols-[240px_minmax(0,1fr)]`; sidebar sticky (`lg:top-[4.5rem]`) com botões: Gestão & Times, Turnos & Horários, Cargos, Categorias, Skills & Proficiências, Intervalos, Tarefas & Métricas, Lista Ativa, Lixeira (60 dias); scroll suave para âncoras (`scroll-mt-28`) + scroll-spy que destaca a seção ativa; botão Lixeira também troca `listMode` para 'trash'.
- **Correção do rádio — transmissão por canal selecionado (CommunicationContext.tsx)**:
  - Causa raiz: TODAS as conexões compartilhavam UMA única faixa de microfone (`micStreamRef`), então `startSpeaking`/`applyLocalSpeaking` habilitavam a faixa globalmente — o PTT transmitia para TODOS os canais inscritos, não só o canal ativo (poluía o canal geral).
  - Correção: faixas de microfone POR canal (`channelTracksRef: Record<channelId, MediaStreamTrack>`), clones da faixa base via `getChannelTrack()` (fallback para a faixa base se `clone()` falhar). `createPc`/`ensureConnection`/`attachMicToConnections` passam a anexar o clone do canal (com `new MediaStream([chTrack])` em `addTrack`); `applyLocalSpeaking()` habilita SOMENTE o clone do canal ativo (`activeChannelRef`) e desliga os demais; efeito re-roteia o mic quando `activeChannel` muda (troca de canal com PTT segurado muda a transmissão na hora); `startSpeaking`/`stopSpeaking`/`setTransmissionLocked` usam `applyLocalSpeaking`. Com `activeChannel` nulo, volta ao comportamento de transmitir em todos. Limpeza: `releaseChannelTrack` ao sair/fechar canal, `leaveAll` e ao desligar o rádio.
- **Portal do Operador responsivo**:
  - `Tabs` (componente compartilhado): container agora `flex-wrap max-w-full` — abas que não cabem QUEBRAM em várias linhas em vez de estourar a largura (beneficia todas as telas com abas).
  - Portal: raiz `min-h-dvh` (viewport móvel correta no Safari/Android); rodapé do card de membro alocado com `flex-wrap gap-1` (não estoura em telas estreitas); linha secundária do botão do operador com `truncate`.
- **HelpView**: docs atualizadas (seletor por campo, fluxo, contagem por área CTRL+F, gatilho de URL).
- **CRÍTICO — rádio "ao vivo" parando em segundo plano + notificações do portal (CommunicationContext.tsx)**:
  - Causas: (1) o keepalive usava um WAV de **5 min / 4,8MB** gerado sincronamente — demorava segundos para carregar/decodificar em coletor lento; a página era ocultada (e congelada pelo navegador) antes de qualquer áudio começar → rádio "aparecia transmitindo" mas ninguém ouvia; (2) o keepalive Web Audio (`keepaliveCtxRef`) era **código morto** — o contexto nunca era criado; (3) workers dedicados (sinalização e sync do AppContext) são estrangulados com a página oculta — a vida em background dependia 100% do áudio.
  - Correção: WAV curto de **2s (~32KB)** em loop (geração/decodificação instantâneas); keepalive Web Audio **contínuo** implementado (`startWebAudioKeepalive`: `AudioContext` + `AudioBufferSourceNode` em loop a ~-54dB, nunca dá gap) iniciado dentro do gesto do usuário e integrado a `startKeepalive`/`stopKeepalive`/`resumeAllAudio`; keepalive iniciado também em `startSpeaking` (gesto do PTT) e `setTransmissionLocked(true)`; `setEnabled(true)` reordenado para ligar o keepalive antes do `acquireMic`; no tick do worker e no `visibilitychange` → `resume` do contexto + `startKeepalive` + re-anexar mic + `retryConnections`. Mantidos dois fluxos de áudio (elemento `<audio>` + Web Audio) para máxima chance de o renderer não congelar em Android/iOS.

### Active
- Nenhum — todos os itens concluídos e verificados (tsc, 32 testes, build).

### Blocked
- Git corrompido (objeto `f83355ce...`) — não reparar/comitar sem aval.
- Dados perdidos do incidente do usuário: sem fonte de recuperação conhecida.
- Extensão base reescrita ainda não foi re-empacotada/distribuída (regenerar o .zip da Ajuda para os usuários instalarem).

## Next Move (sugestões)
1. **Teste manual do rádio em segundo plano (crítico)**: deixar o app em segundo plano por 30s+ com a trava PTT ativa em 2+ dispositivos (Honeywell/Android + desktop) e confirmar que a voz continua sendo transmitida e que as notificações do portal chegam mesmo com o app oculto.
2. Regerar/atualizar o .zip da extensão base para distribuição (Ajuda › Baixar Extensão).
3. Teste manual real da extensão: criar contagem "Pendentes"/"Processando" de um posto, gravar o fluxo de filtros na página do sistema, listar as áreas e coletar — conferir as ocorrências contadas e o resumo por área.
4. Teste manual real do rádio em 2+ dispositivos: trocar para o canal de uma tarefa e falar — confirmar que o canal geral NÃO recebe a voz e que os colegas do mesmo canal ouvem; conferir troca de canal durante transmissão contínua (trava PTT).
5. Se desejado: espelhar o motor de coleta/fluxo no `chrome-extension` (variante Notificações) — atualmente fica só na extensão base.
6. Considerar um widget de contagem por área na Home (hoje: MetricManager + Portal do Operador).

## Relevant Files
- `src/types.ts`: MetricCountTerm, MetricDefinition.countTerms/countScope/countKind, MetricFlowStep, TaskAreaCount, InfoHubQuickFill.triggerUrl (Task.area removido).
- `src/context/AppContext.tsx`: sync fixes, sessão/storage, getTaskAreaCounts (por nome de área), ensureTaskCountMetric(taskId, kind), handlers flow-result e count-config-result, coleta com mode count.
- `src/context/CommunicationContext.tsx`: rádio com faixa de microfone POR canal (`channelTracksRef`, `getChannelTrack`, `releaseChannelTrack`, `applyLocalSpeaking` por canal ativo) — PTT transmite só no canal selecionado; keepalive de background (WAV curto 2s + `startWebAudioKeepalive` contínuo) para o rádio não parar em segundo plano.
- `src/utils/storagePolicy.ts`: política de armazenamento da sessão.
- `src/components/LoginScreen.tsx`, `src/components/AlwaysOnlineOverlay.tsx`: gate de acesso.
- `src/App.tsx`: gates de sessão no MainLayout.
- `src/views/SettingsView.tsx`: seção "Sessão & Segurança do Dispositivo".
- `src/components/MetricManager.tsx`: tipo de coleta (campos vs contagem), editor de termos/escopo/visão, presets Pendentes/Processando, resumo por área, leitura manual e gráfico por área.
- `src/views/OperatorPortalView.tsx`: painel "Tarefas por área" para supervisores + ajustes responsivos.
- `src/components/ui/Tabs.tsx`: abas com `flex-wrap max-w-full` (responsivo em todas as telas).
- `src/views/TeamView.tsx`: menu lateral sticky (estilo Configurações) com âncoras + scroll-spy.
- `src/views/InfoHubView.tsx`: gatilho de URL no quick fill + envio de grupos completos à extensão.
- `public/extension/content.js` / `background.js` / `popup.js` / `popup.html`: modo de contagem (CTRL+F), editor de fluxo/áreas estilo Automa, relay de configuração.
- `chrome-extension/*`: variante Notificações (intacta — não tocar).
- `src/utils/extensionInstaller.ts`: isExtensionInstalled/downloadExtensionZip.
- `src/views/HelpView.tsx`: docs atualizadas.