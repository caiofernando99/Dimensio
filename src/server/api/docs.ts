import { Request, Response } from 'express';
import { API_VERSION } from './unifiedRouter';

export function getOpenApiSpec(baseUrl: string) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Dimensio Unified REST API',
      version: API_VERSION,
      description: `
API REST Unificada e Robusta da plataforma Dimensio.
Permite integração direta, bidirecional e simplificada com:
- **Presença & Ponto**: Marcações, faltas, atestados, webhooks de relógio de ponto e totens.
- **Equipe & Colaboradores**: Gestão de colaboradores, matrículas, turnos, turmas/escalas e cargos.
- **Postos & Dimensionamento**: Tarefas operacionais, linhas de montagem, docas e alocação de operadores.
- **Intervalos & Pausas**: Escala de horários de almoço, lanche e revezamentos ergonômicos NR-17.
- **Rotinas & Checklists**: Tarefas operacionais programadas, feedbacks de líderes e prazos.
- **Chamados & Apoio**: Pedidos de insumos, manutenção e solicitações operacionais com SLA.
- **Métricas & Telemetria**: Indicadores em tempo real capturados por sensores, robôs ou extensão Chrome.
- **Hub de Informações Multi-App**: Base compartilhável de avisos diários, atalhos rápidos e códigos.
- **Notificações**: Transmissão em tempo real de avisos operacionais para os aparelhos conectados.
      `.trim(),
      contact: {
        name: 'Dimensio Suporte & Integrações',
        url: 'https://dimensio.app',
      },
    },
    servers: [
      {
        url: baseUrl ? `${baseUrl}/api/v1` : '/api/v1',
        description: 'Servidor Atual (Produção / Dev)',
      },
      {
        url: baseUrl ? `${baseUrl}/api` : '/api',
        description: 'Endpoint Raiz Legado (Compatibilidade Total)',
      },
    ],
    tags: [
      { name: 'Geral', description: 'Visão geral da operação e totalizadores' },
      { name: 'Sistema & Saúde', description: 'Status operacional do servidor, uptime e versão da API' },
      { name: 'Presença & Ponto', description: 'Registro de ponto, lista de presença, faltas e webhooks' },
      { name: 'Equipe & Colaboradores', description: 'Cadastro e consulta de colaboradores' },
      { name: 'Postos & Dimensionamento', description: 'Alocação de operadores em postos e docas' },
      { name: 'Intervalos & NR-17', description: 'Escala de intervalos e revezamentos' },
      { name: 'Rotinas & Checklists', description: 'Rotinas operacionais, tarefas e feedbacks' },
      { name: 'Chamados & Suporte', description: 'Abertura e acompanhamento de chamados operacionais' },
      { name: 'Métricas & Telemetria', description: 'Indicadores operacionais e integração com sensores/extensão' },
      { name: 'Hub de Informações', description: 'Base multi-app de avisos, links e códigos de preenchimento rápido' },
      { name: 'Notificações', description: 'Broadcast de mensagens e alertas em tempo real' },
      { name: 'Sincronização Total', description: 'Importação/sincronização completa de estado' },
      { name: 'Banco de Dados Cloud SQL', description: 'Conexão e monitoramento com banco relacional PostgreSQL' },
      { name: 'Usuários & Permissões', description: 'Gestão de usuários autenticados via Firebase Auth e Cloud SQL' },
      { name: 'Autenticação & LGPD', description: 'Triggers de onboarding por e-mail e exclusão definitiva de contas (LGPD/GDPR)' },
      { name: 'Rádio PTT & Sinalização WebRTC', description: 'Barramento de sinalização peer-to-peer para áudio em tempo real' },
    ],
    paths: {
      '/overview': {
        get: {
          tags: ['Geral'],
          summary: 'Resumo operacional em tempo real',
          description: 'Retorna estatísticas consolidadas de colaboradores, presenças, postos de trabalho e capacidade ocupada.',
          parameters: [
            {
              name: 'date',
              in: 'query',
              required: false,
              description: 'Data no formato YYYY-MM-DD (padrão: data atual)',
              schema: { type: 'string', example: '2026-10-07' },
            },
          ],
          responses: {
            200: {
              description: 'Resumo operacional retornado com sucesso',
              content: {
                'application/json': {
                  example: {
                    success: true,
                    apiVersion: '1.6.0',
                    data: {
                      date: '2026-10-07',
                      stats: {
                        totalCollaborators: 24,
                        presentCount: 20,
                        absentCount: 4,
                        totalTasks: 8,
                        capacity: { required: 18, allocated: 19, fulfillmentRatePercent: 105.5 },
                        totalPendingRequests: 2,
                        totalScheduledRoutines: 5,
                      },
                      tasks: [
                        { id: 't-doca1', name: 'Doca 01', area: 'Recebimento', allocatedCount: 3, requiredCapacity: 2 },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/presence': {
        get: {
          tags: ['Presença & Ponto'],
          summary: 'Consultar lista de presenças e faltas da data',
          description: 'Lista registros de presença com suporte a filtros por turno, turma, status e busca textual. Suporta exportação JSON ou CSV.',
          parameters: [
            { name: 'date', in: 'query', description: 'Data (YYYY-MM-DD)', schema: { type: 'string' } },
            { name: 'shift', in: 'query', description: 'Turno (ex: T1, T2, Manhã, ALL)', schema: { type: 'string' } },
            { name: 'scale', in: 'query', description: 'Turma / Escala (ex: Alfa, Noturna, ALL)', schema: { type: 'string' } },
            { name: 'status', in: 'query', description: 'Status específico (presente, ausente, folga, atestado, ferias, etc.)', schema: { type: 'string' } },
            { name: 'search', in: 'query', description: 'Termo de busca (nome, login ou matrícula)', schema: { type: 'string' } },
            { name: 'format', in: 'query', description: 'Formato de retorno (json ou csv)', schema: { type: 'string', enum: ['json', 'csv'], default: 'json' } },
          ],
          responses: {
            200: { description: 'Lista de presença retornada com sucesso' },
          },
        },
        post: {
          tags: ['Presença & Ponto'],
          summary: 'Registrar ou atualizar presenças (individual ou em lote)',
          description: 'Insere ou atualiza registros de presença. Identifica colaboradores automaticamente por ID, Matrícula (RE), Login ou Nome.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: [
                  { name: 'Carlos Silva', status: 'presente', shift: 'T1' },
                  { registration: 'RE-1002', status: 'atraso', reason: 'Trânsito' },
                  { login: 'mariana.costa', status: 'atestado', reason: 'Atestado médico 2 dias' },
                ],
              },
            },
          },
          responses: {
            200: { description: 'Presenças processadas com sucesso' },
          },
        },
      },
      '/presence/webhook': {
        post: {
          tags: ['Presença & Ponto'],
          summary: 'Webhook instantâneo para relógio de ponto ou totem',
          description: 'Recebe batidas de ponto ópticas, biométricas ou de ERPs e atualiza o painel Dimensio em tempo real com difusão instantânea para os navegadores conectados.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  matricula: 'RE-1001',
                  nome: 'Carlos Silva',
                  status: 'presente',
                  app_name: 'Totem Portaria CD 01',
                },
              },
            },
          },
          responses: {
            200: { description: 'Ponto registrado com sucesso' },
          },
        },
      },
      '/presence/events': {
        get: {
          tags: ['Presença & Ponto'],
          summary: 'Consultar histórico de eventos e batidas de ponto',
          responses: { 200: { description: 'Histórico de eventos' } },
        },
      },
      '/collaborators': {
        get: {
          tags: ['Equipe & Colaboradores'],
          summary: 'Listar colaboradores da equipe',
          parameters: [
            { name: 'shift', in: 'query', description: 'Filtrar por turno', schema: { type: 'string' } },
            { name: 'role', in: 'query', description: 'Filtrar por cargo', schema: { type: 'string' } },
            { name: 'search', in: 'query', description: 'Busca por nome, RE ou login', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Lista de colaboradores' } },
        },
        post: {
          tags: ['Equipe & Colaboradores'],
          summary: 'Cadastrar ou atualizar colaborador',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  name: 'Ana Carolina Dias',
                  registration: 'RE-5002',
                  login: 'ana.dias',
                  role: 'Operador Logístico',
                  shift: 'T1',
                  scale: 'Alfa',
                },
              },
            },
          },
          responses: { 200: { description: 'Colaborador salvo com sucesso' } },
        },
      },
      '/collaborators/{id}': {
        get: {
          tags: ['Equipe & Colaboradores'],
          summary: 'Consultar detalhes de um colaborador',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Dados do colaborador' } },
        },
        delete: {
          tags: ['Equipe & Colaboradores'],
          summary: 'Remover colaborador da equipe',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Colaborador removido' } },
        },
      },
      '/tasks': {
        get: {
          tags: ['Postos & Dimensionamento'],
          summary: 'Listar postos de trabalho e dimensionamento',
          responses: { 200: { description: 'Lista de postos' } },
        },
        post: {
          tags: ['Postos & Dimensionamento'],
          summary: 'Criar ou atualizar posto de trabalho',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  name: 'Conferência de Cargas Doca 04',
                  area: 'Expedição',
                  requiredCapacity: 3,
                },
              },
            },
          },
          responses: { 200: { description: 'Posto salvo com sucesso' } },
        },
      },
      '/tasks/assign': {
        post: {
          tags: ['Postos & Dimensionamento'],
          summary: 'Alocar colaborador em um posto de trabalho',
          description: 'Localiza o colaborador e o posto por ID ou Nome e realiza a alocação instantânea.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  name: 'Carlos Silva',
                  taskName: 'Doca 01',
                },
              },
            },
          },
          responses: { 200: { description: 'Alocação realizada' } },
        },
      },
      '/tasks/unassign': {
        post: {
          tags: ['Postos & Dimensionamento'],
          summary: 'Desalocar colaborador de todos os postos',
          requestBody: {
            required: true,
            content: {
              'application/json': { example: { name: 'Carlos Silva' } },
            },
          },
          responses: { 200: { description: 'Desalocação realizada' } },
        },
      },
      '/breaks': {
        get: {
          tags: ['Intervalos & NR-17'],
          summary: 'Consultar horários de intervalos da data',
          parameters: [{ name: 'date', in: 'query', schema: { type: 'string' } }],
          responses: { 200: { description: 'Escala de intervalos' } },
        },
      },
      '/breaks/assign': {
        post: {
          tags: ['Intervalos & NR-17'],
          summary: 'Definir horário de intervalo para colaborador',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  name: 'Carlos Silva',
                  breakTime: '12:00 - 13:00',
                  date: '2026-10-07',
                },
              },
            },
          },
          responses: { 200: { description: 'Intervalo definido com sucesso' } },
        },
      },
      '/routines': {
        get: {
          tags: ['Rotinas & Checklists'],
          summary: 'Listar rotinas operacionais e checklists',
          responses: { 200: { description: 'Lista de rotinas' } },
        },
      },
      '/routines/tasks': {
        post: {
          tags: ['Rotinas & Checklists'],
          summary: 'Criar rotina ou agendamento de feedback',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  title: 'Auditoria de Equipamentos NR-12',
                  description: 'Checar travas das esteiras e botões de emergência',
                  dueDate: '2026-10-07',
                  dueTime: '15:00',
                  assigneeName: 'Carlos Líder',
                },
              },
            },
          },
          responses: { 200: { description: 'Rotina criada com sucesso' } },
        },
      },
      '/requests': {
        get: {
          tags: ['Chamados & Suporte'],
          summary: 'Listar pedidos de apoio e insumos operacionais',
          responses: { 200: { description: 'Lista de chamados' } },
        },
        post: {
          tags: ['Chamados & Suporte'],
          summary: 'Abrir chamado operacional ou pedido de insumo',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  title: 'Bobina de Etiqueta Térmica Acabando',
                  description: 'Necessário reposição na Doca 02 antes das 16h',
                  requesterName: 'Mariana Costa',
                  priority: 'alta',
                },
              },
            },
          },
          responses: { 200: { description: 'Chamado aberto com sucesso' } },
        },
      },
      '/metrics': {
        get: {
          tags: ['Métricas & Telemetria'],
          summary: 'Consultar definições de métricas e leituras',
          responses: { 200: { description: 'Métricas operacionais' } },
        },
      },
      '/metrics/readings': {
        post: {
          tags: ['Métricas & Telemetria'],
          summary: 'Enviar leitura de métrica de sensor ou extensão',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  metricId: 'caixas_hora',
                  value: 485,
                  source: 'Sensor Esteira 01',
                },
              },
            },
          },
          responses: { 200: { description: 'Leitura registrada com sucesso' } },
        },
      },
      '/info-hub': {
        get: {
          tags: ['Hub de Informações'],
          summary: 'Consultar base compartilhada (avisos, links e quick-fills)',
          parameters: [
            { name: 'workspace', in: 'query', description: 'Identificador do workspace (padrão: default ou all)', schema: { type: 'string' } },
            { name: 'type', in: 'query', description: 'Filtrar por recurso (all, reminders, links, quickfills)', schema: { type: 'string' } },
            { name: 'shift', in: 'query', description: 'Filtrar por turno', schema: { type: 'string' } },
            { name: 'search', in: 'query', description: 'Busca por texto', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Base de dados do Hub' } },
        },
      },
      '/info-hub/sync': {
        post: {
          tags: ['Hub de Informações'],
          summary: 'Sincronizar base compartilhada em lote',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  workspace: 'logistica',
                  reminders: [{ id: 'aviso-1', title: 'Reunião de Alinhamento 5S', message: 'Hoje às 17h' }],
                  links: [{ id: 'link-1', title: 'Sistema WMS', url: 'https://wms.empresa.com' }],
                },
              },
            },
          },
          responses: { 200: { description: 'Sincronização concluída' } },
        },
      },
      '/notifications/broadcast': {
        post: {
          tags: ['Notificações'],
          summary: 'Transmitir notificação instantânea para os operadores',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: {
                  title: 'Alerta Operacional',
                  message: 'Pausa para ginástica laboral iniciando agora no setor A.',
                  priority: 'alta',
                },
              },
            },
          },
          responses: { 200: { description: 'Notificação transmitida com sucesso' } },
        },
      },
      '/sync': {
        post: {
          tags: ['Sincronização Total'],
          summary: 'Sincronização completa de estado da aplicação',
          responses: { 200: { description: 'Estado sincronizado com sucesso' } },
        },
      },
      '/health': {
        get: {
          tags: ['Sistema & Saúde'],
          summary: 'Health check e uptime do servidor',
          responses: { 200: { description: 'Servidor operacional' } },
        },
      },
      '/version': {
        get: {
          tags: ['Sistema & Saúde'],
          summary: 'Versão da aplicação e metadados',
          responses: { 200: { description: 'Versão atual' } },
        },
      },
      '/cloudsql/status': {
        get: {
          tags: ['Banco de Dados Cloud SQL'],
          summary: 'Status da conexão com PostgreSQL (Cloud SQL)',
          responses: { 200: { description: 'Status da conexão retornado' } },
        },
      },
      '/users': {
        get: {
          tags: ['Usuários & Permissões'],
          summary: 'Listar usuários da organização',
          description: 'Requer cabeçalho Authorization: Bearer <Firebase_ID_Token>',
          responses: { 200: { description: 'Lista de usuários' } },
        },
      },
      '/users/sync': {
        post: {
          tags: ['Usuários & Permissões'],
          summary: 'Sincronizar dados do usuário autenticado para o Cloud SQL',
          description: 'Requer cabeçalho Authorization: Bearer <Firebase_ID_Token>',
          responses: { 200: { description: 'Usuário sincronizado com sucesso' } },
        },
      },
      '/auth/send-welcome-email': {
        post: {
          tags: ['Autenticação & LGPD'],
          summary: 'Disparar e-mail de boas-vindas e onboarding',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                example: { email: 'diretoria@empresa.com', companyName: 'Logística Alfa', displayName: 'Caio Costa' },
              },
            },
          },
          responses: { 200: { description: 'E-mail de onboarding disparado' } },
        },
      },
      '/auth/delete-account': {
        post: {
          tags: ['Autenticação & LGPD'],
          summary: 'Exclusão definitiva de conta de usuário (LGPD / GDPR compliant)',
          requestBody: {
            required: true,
            content: {
              'application/json': { example: { userId: 'uid_firebase_12345' } },
            },
          },
          responses: { 200: { description: 'Conta excluída com sucesso do Firebase Auth' } },
        },
      },
      '/signal': {
        get: {
          tags: ['Rádio PTT & Sinalização WebRTC'],
          summary: 'Consultar sinais pendentes de PTT/WebRTC',
          parameters: [
            { name: 'sinceSeq', in: 'query', schema: { type: 'integer' }, description: 'Último número de sequência recebido' },
          ],
          responses: { 200: { description: 'Mensagens de sinalização' } },
        },
        post: {
          tags: ['Rádio PTT & Sinalização WebRTC'],
          summary: 'Publicar sinal de voz, presença ou handshake PTT',
          responses: { 200: { description: 'Sinal recebido e distribuído' } },
        },
      },
      '/info-hub/reminders': {
        post: {
          tags: ['Hub de Informações'],
          summary: 'Criar lembrete ou aviso no Hub',
          requestBody: {
            required: true,
            content: {
              'application/json': { example: { title: 'Reunião DDS', message: 'Início às 08:00', priority: 'alta', shift: 'T1' } },
            },
          },
          responses: { 201: { description: 'Lembrete criado com sucesso' } },
        },
      },
      '/info-hub/links': {
        post: {
          tags: ['Hub de Informações'],
          summary: 'Adicionar link útil ou atalho no Hub',
          requestBody: {
            required: true,
            content: {
              'application/json': { example: { title: 'Portal SAP', url: 'https://sap.empresa.com', category: 'Sistemas' } },
            },
          },
          responses: { 201: { description: 'Link criado com sucesso' } },
        },
      },
      '/info-hub/quickfills': {
        post: {
          tags: ['Hub de Informações'],
          summary: 'Criar conjunto de preenchimentos rápidos (QuickFills)',
          responses: { 201: { description: 'QuickFill criado com sucesso' } },
        },
      },
    },
  };
}

export function renderApiDocsHtml(baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Dimensio — Documentação da API REST Unificada</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    :root {
      --bg-dark: #090d16;
      --card-dark: #121826;
      --primary: #4f46e5;
      --accent: #38bdf8;
      --line: #1e293b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg-dark);
      color: #f8fafc;
    }
    .topbar {
      background: var(--card-dark);
      padding: 1rem 2rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--line);
      gap: 1rem;
    }
    .brand-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .logo-badge {
      width: 34px;
      height: 34px;
      background: linear-gradient(135deg, #4f46e5, #3b82f6);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      color: #fff;
      font-size: 1.1rem;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }
    .topbar h1 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.02em;
    }
    .version-pill {
      font-size: 0.7rem;
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.8rem;
    }
    .nav-links a {
      color: #94a3b8;
      text-decoration: none;
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
      transition: all 0.15s;
    }
    .nav-links a:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.06);
    }
    .btn-action {
      background: var(--primary) !important;
      color: #fff !important;
    }
    .swagger-container {
      max-width: 1300px;
      margin: 1.5rem auto;
      padding: 0 1rem;
    }
    .swagger-ui {
      background: #ffffff;
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    .swagger-ui .info {
      margin-bottom: 2rem;
    }
    .swagger-ui .scheme-container {
      background: #f8fafc;
      border-radius: 12px;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand-group">
      <div class="logo-badge">D</div>
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <h1>Dimensio API REST Unificada</h1>
          <span class="version-pill">v${API_VERSION}</span>
        </div>
        <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">
          Gateway de Integração Oficial para WMS, ERPs, Relógio de Ponto e Telemetria
        </div>
      </div>
    </div>
    <nav class="nav-links">
      <a href="/api/v1/overview" target="_blank">GET /overview</a>
      <a href="/api/v1/presence" target="_blank">GET /presence</a>
      <a href="/api/openapi.json" target="_blank">OpenAPI JSON Spec ↗</a>
      <a href="/test-sandbox" target="_blank">Dev Sandbox ↗</a>
      <a href="/" class="btn-action">Abrir App Dimensio</a>
    </nav>
  </header>

  <main class="swagger-container">
    <div id="swagger-ui"></div>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: 'BaseLayout',
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: 'list',
        filter: true
      });
    };
  </script>
</body>
</html>`;
}
