# ⚡ Dimensio

<div align="center">

**Plataforma Integrada de Dimensionamento, Escalas Operacionais, Gestão de Presença e Produtividade de Equipes**

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore_%26_Auth-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/features/actions)

</div>

---

## 📖 Visão Geral

O **Dimensio** é uma aplicação completa e moderna projetada para operações e centrais de atendimento que necessitam de rigor no controle de efetivo, alocação de postos, revezamento de turnos e acompanhamento em tempo real da equipe.

A aplicação unifica o **dimensionamento operacional**, o **controle de presença/absenteísmo**, a **gestão de intervalos**, a **distribuição de rotinas de trabalho** e a **comunicação de briefings**, eliminando planilhas manuais desconectadas e proporcionando uma experiência colaborativa com sincronização em nuvem e suporte nativo a dispositivos móveis (PWA).

---

## 🎯 Principais Módulos e Funcionalidades

### 👥 1. Gestão de Equipes e Colaboradores
- Cadastro centralizado de colaboradores com matrícula, cargo, turno, setor, habilidades e carga horária.
- Controle de disponibilidade e status individual de trabalho (Ativo, Em Pausa, Atestado, Férias, Folga).
- Gestão de múltiplos setores e possibilidade de suporte entre setores (apoio cruzado).

### 📊 2. Dimensionamento e Alocação de Postos
- Cálculo dinâmico do dimensionamento ideal versus real por turno e faixa de horário.
- Algoritmo de sugestão e distribuição automática de colaboradores para postos de trabalho.
- Balanceamento de carga para prevenção de furos de escala e sobrecarga operacional.
- Suporte a escalas de revezamento contínuo (6x2, 5x2, 12x36 e turnos customizáveis).

### ⏱️ 3. Controle de Presença e Absenteísmo em Tempo Real
- Registro ágil de presença, atrasos, atestados médicos, folgas e faltas justificadas/injustificadas.
- Cálculo automático das taxas de absenteísmo do turno com gráficos consolidados.
- Fechamento formal do turno com auditoria e preservação histórica de dados.

### ☕ 4. Escala e Rotação de Intervalos (Pausas)
- Geração automática e otimizada de janelas de refeição e pausas regulamentares.
- Distribuição equilibrada para garantir que o efetivo mínimo de atendimento seja mantido nos postos críticos.
- Monitoramento visual de quem está em pausa no momento e horários de retorno previstos.

### 📅 5. Calendário Operacional & Integração com Google Workspace
- Visão anual e mensal de escalas com marcação clara dos grupos/turmas de folga (Turmas A, B, C, D).
- **Google Calendar**: Integração direta via OAuth para visualização, criação e exclusão de eventos e reuniões corporativas.
- **Google Tasks**: Sincronização em um clique de tarefas do dia diretamente na lista de afazeres corporativa.

### 📋 6. Gestão de Rotinas, Checklists e Procedimentos
- Criação e acompanhamento de listas de rotinas diárias e periódicas por turno/setor.
- Definição de horários de início e término previstos, prioridades, responsáveis e subtarefas.
- Sinalização visual do status de execução e sincronização direta com o calendário do gestor.

### 📢 7. Briefing de Turno e Central de Informações (InfoHub)
- Registro de alinhamentos e passagens de turno entre gestores/líderes.
- Central de avisos, procedimentos operacionais padrão (POPs), documentação e links úteis.
- Central de chamados e solicitações de serviço com acompanhamento de SLA.

### 📱 8. Portal do Operador e Painel Individual (PWA)
- Interface simplificada e responsiva com foco na visualização do colaborador.
- Consulta rápida ao horário de início de turno, posto alocado, horários de intervalo e rotinas atribuídas.
- Pode ser instalado diretamente na tela inicial do celular ou desktop como um Progressive Web App (PWA).

### 📈 9. Relatórios, Métricas e Exportação
- Painel analítico com indicadores de performance, aderência à escala e índice de absenteísmo.
- Exportação dos relatórios e escalas em **PDF** formatado e planilhas **Excel (.xlsx)**.

---

## 🛠️ Tecnologias e Arquitetura

| Camada | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript | Interface de usuário moderna, tipada e orientada a componentes funcionais |
| **Estilização** | Tailwind CSS v4 | Design system limpo, responsivo, com suporte a temas e modo escuro |
| **Build & Dev** | Vite 6 | Compilação ultrarrápida com Hot Module Replacement otimizado |
| **Backend / API** | Node.js + Express | Servidor para proxies de serviços e execução local |
| **Persistência** | Firebase Firestore | Banco NoSQL em tempo real para sincronização colaborativa entre dispositivos |
| **Autenticação** | Firebase Auth | Autenticação corporativa integrada com Google Workspace |
| **Mobilidade** | VitePWA + Service Worker | Suporte offline, cache inteligente e instalação como aplicativo nativo |
| **CI / CD** | GitHub Actions | Esteira automatizada de build e deploy no Firebase Hosting |

---

## 📁 Estrutura de Pastas do Projeto

```text
dimensio/
├── .github/
│   └── workflows/
│       └── deploy.yml           # Pipeline de CI/CD para deploy automático no Firebase Hosting
├── chrome-extension/            # Extensão complementar do navegador
├── docs/
│   └── DEPLOY_FIREBASE.md       # Guia detalhado de configuração do deploy e secrets do GitHub
├── public/                      # Arquivos estáticos (ícones, manifesto PWA, favicon)
├── src/
│   ├── assets/                  # Imagens e logotipos da aplicação
│   ├── components/              # Componentes reutilizáveis de interface (Modais, Botões, Tabelas, etc.)
│   ├── context/                 # Contexto de estado global da aplicação (AppContext.tsx)
│   ├── lib/                     # Clientes de integração (Firebase Firestore, Auth e Google Workspace)
│   ├── utils/                   # Helpers, gerador de escalas, cálculos de intervalos e utilitários
│   ├── views/                   # Telas e módulos principais da aplicação
│   │   ├── AssignmentView.tsx   # Alocação de postos e dimensionamento
│   │   ├── BreaksView.tsx       # Gestão de intervalos e pausas
│   │   ├── BriefingView.tsx     # Registro de briefings pré-turno
│   │   ├── CalendarView.tsx     # Calendário operacional e Google Calendar
│   │   ├── EmployeePanelView.tsx# Painel individual do colaborador
│   │   ├── InfoHubView.tsx      # Base de conhecimento e links úteis
│   │   ├── OperatorPortalView.tsx# Portal simplificado do operador
│   │   ├── PresenceView.tsx     # Frequência, presença e absenteísmo
│   │   ├── ReportView.tsx       # Relatórios gerenciais e exportação
│   │   ├── RoutinesView.tsx     # Gestão de tarefas e checklists operacionais
│   │   ├── TeamView.tsx         # Gestão de colaboradores e setores
│   │   └── ...
│   ├── App.tsx                  # Roteamento e estrutura de layout da aplicação
│   ├── main.tsx                 # Ponto de entrada do React
│   └── types.ts                 # Definições completas de interfaces e tipos TypeScript
├── .firebaserc                  # Configuração de projeto do Firebase CLI
├── firebase.json                # Configuração de rotas e diretórios do Firebase Hosting
├── firestore.rules              # Regras de segurança do banco de dados Firestore
├── package.json                 # Dependências e scripts do projeto
├── server.ts                    # Servidor local Node.js / Express
└── vite.config.ts               # Configuração do Vite, Tailwind CSS e VitePWA
```

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão **20.x** ou superior.
- Gerenciador de pacotes `npm` instalado.

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/dimensio.git
cd dimensio
```

### 2. Instalar as dependências
```bash
npm install
```

### 3. Configurar as variáveis de ambiente (opcional)
Caso deseje conectar recursos de inteligência artificial ou banco externo, crie um arquivo `.env` com base no `.env.example`:
```bash
cp .env.example .env
```

### 4. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```
Acesse a aplicação no seu navegador em: **`http://localhost:3000`**

> **Dica para Windows**: Você também pode inicializar o app com duplo clique em `abrir-local.cmd` ou executando `./abrir-local.ps1` no PowerShell.

---

## ⚙️ Scripts Disponíveis no `package.json`

- **`npm run dev`**: Inicia o servidor de desenvolvimento local na porta 3000.
- **`npm run build`**: Gera a versão de produção otimizada para web na pasta `dist/`.
- **`npm run start`**: Inicia o servidor Node.js com os artefatos compilados de produção.
- **`npm run lint`**: Executa a checagem de tipos estáticos do TypeScript (`tsc --noEmit`).
- **`npm test`**: Executa os testes automatizados da aplicação com Vitest.
- **`npm run clean`**: Limpa as pastas temporárias de build (`dist/`).

---

## 🌐 Deploy Contínuo no Firebase Hosting (CI/CD)

O projeto está configurado com um fluxo automatizado no GitHub Actions:

- Sempre que houver um commit na branch `main`, o arquivo [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compila a aplicação e realiza o deploy no **Firebase Hosting**.
- Para ativar o deploy em seu repositório do GitHub, configure o secret `FIREBASE_SERVICE_ACCOUNT` nas configurações do repositório.
- Para instruções detalhadas e passo a passo de como gerar a chave no Firebase Console, consulte o [**Guia de Deploy no Firebase Hosting**](docs/DEPLOY_FIREBASE.md).

---

## 📄 Licença

Este projeto é desenvolvido para gestão e dimensionamento de operações. Todos os direitos reservados.
