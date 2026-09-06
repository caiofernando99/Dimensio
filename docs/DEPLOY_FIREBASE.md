# 🚀 Guia de Deploy Contínuo no Firebase Hosting com GitHub Actions

Este documento detalha o funcionamento e a configuração da esteira de CI/CD configurada em [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) para a aplicação **Dimensio**.

---

## 📋 Visão Geral do Workflow

Sempre que um novo commit for enviado (`git push`) para a branch principal (`main`), ou quando acionado manualmente via `workflow_dispatch`, o GitHub Actions executa os seguintes passos automaticamente:

1. **Checkout**: Baixa o código fonte da aplicação.
2. **Ambiente Node.js**: Prepara o ambiente com Node.js 20 e cache de dependências `npm`.
3. **Instalação**: Executa `npm ci` (ou `npm install`) de forma reprodutível.
4. **Build de Produção**: Executa `npm run build` gerando os artefatos estáticos otimizados na pasta `dist/` (com suporte a PWA e Service Worker).
5. **Deploy no Firebase Hosting**: Publica os arquivos no canal de produção (`live`) do projeto Firebase `dependable-campaign-wxhgq`.

---

## 🔑 Configuração do Segredo no GitHub (`FIREBASE_SERVICE_ACCOUNT`)

Para que o GitHub Actions tenha permissão para fazer o deploy no Firebase Hosting, é necessário cadastrar a credencial de conta de serviço (Service Account) como um segredo do repositório no GitHub.

### Passo a Passo:

### 1. Obter a Chave da Conta de Serviço no Google Cloud / Firebase Console
1. Acesse o [Firebase Console](https://console.firebase.google.com/).
2. Selecione o projeto **Dimensio** (`dependable-campaign-wxhgq`).
3. Clique no ícone de engrenagem no menu lateral e selecione **Configurações do projeto** (Project Settings).
4. Acesse a aba **Contas de serviço** (Service accounts).
5. Certifique-se de que a opção **Firebase Admin SDK** está selecionada e clique em **Gerar nova chave privada** (Generate new private key).
6. Um arquivo no formato `.json` será baixado no seu computador.
7. Abra este arquivo `.json` em um editor de texto e copie todo o seu conteúdo (ele contém campos como `type`, `project_id`, `private_key`, `client_email`, etc.).

> **Alternativa via Firebase CLI (se tiver a CLI instalada localmente):**
> ```bash
> npx firebase-tools init hosting:github
> ```
> O comando da CLI cria a conta de serviço com os papéis necessários e pode vincular diretamente ao seu repositório no GitHub.

---

### 2. Cadastrar o Segredo no Repositório do GitHub
1. Abra o seu repositório no GitHub.
2. Acesse a aba **Settings** (Configurações do repositório).
3. No menu lateral esquerdo, clique em **Secrets and variables** > **Actions**.
4. Clique no botão verde **New repository secret**.
5. No campo **Name**, digite exatamente:
   ```text
   FIREBASE_SERVICE_ACCOUNT
   ```
6. No campo **Secret**, cole o conteúdo completo do arquivo `.json` que você baixou no passo anterior.
7. Clique em **Add secret**.

---

## 🧪 Como Testar o Deploy

### Opção A: Fazer um Push na Branch `main`
```bash
git add .
git commit -m "ci: adiciona workflow de deploy no Firebase Hosting"
git push origin main
```
Ao enviar para a branch `main`, a aba **Actions** no seu repositório GitHub iniciará a execução da pipeline automaticamente.

### Opção B: Disparo Manual (Workflow Dispatch)
1. No seu repositório no GitHub, acesse a aba **Actions**.
2. Na coluna à esquerda, selecione o workflow **Deploy Dimensio to Firebase Hosting**.
3. Clique no menu suspenso **Run workflow**, selecione a branch `main` e clique no botão verde **Run workflow**.

---

## 🔍 Estrutura dos Arquivos de Configuração

- **`.github/workflows/deploy.yml`**: Definição da pipeline do GitHub Actions.
- **`firebase.json`**: Configura o diretório público de distribuição (`dist`), regras de reescrita para Single Page Application (`index.html`) e regras do Firestore (`firestore.rules`).
- **`.firebaserc`**: Define o ID padrão do projeto Firebase (`dependable-campaign-wxhgq`).
- **`firestore.rules`**: Regras de segurança do Firestore para sincronização em tempo real.
- **`dist/`**: Pasta gerada pelo comando `npm run build` onde ficam os arquivos HTML, JS, CSS, fontes e manifestos PWA.
