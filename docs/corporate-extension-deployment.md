# Guia de Distribuição da Extensão Dimensio em Ambientes Corporativos Gerenciados

Este documento foi elaborado para administradores de TI, equipes de segurança da informação (SecOps) e gestores de infraestrutura de empresas que utilizam navegadores com perfis gerenciados (Active Directory GPO, Microsoft Intune, Google Workspace Admin Console ou Jamf).

---

## 1. O Desafio em Ambientes Gerenciados

Em muitas organizações, o **Modo de Desenvolvedor** do Google Chrome / Microsoft Edge (`chrome://extensions`) é bloqueado por políticas de segurança corporativas (ex: `ExtensionInstallBlocklist = *` ou restrição de extensões não empacotadas).

Esse bloqueio é uma boa prática de segurança para evitar que usuários instalem scripts maliciosos não auditados. No entanto, ele impede que o colaborador instale uma extensão descompactada manualmente.

Abaixo estão as **4 alternativas homologadas** para implantar a Extensão Dimensio em conformidade total com as políticas corporativas de segurança.

---

## Opção 1: Distribuição Forçada via Política de TI (Recomendado para Redes Windows/Mac)

O navegador Google Chrome e o Microsoft Edge suportam a política nativa `ExtensionInstallForcelist`. Com ela, o departamento de TI adiciona a extensão à lista de instalação obrigatória. A extensão é instalada e ativada automaticamente no navegador de todos os usuários do domínio, sem exigir nenhuma ação do colaborador e sem depender do Modo de Desenvolvedor.

### No Windows (Active Directory GPO ou Registro):
Adicione a chave no Registro do Windows ou crie um objeto GPO:

```reg
Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist]
"1"="[ID_DA_EXTENSAO];https://ais-pre-m46gb5dmwo4z3ulnbl5zpy-412144027959.us-east1.run.app/api/extension/updates.xml"

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\ExtensionInstallSources]
"1"="https://ais-pre-m46gb5dmwo4z3ulnbl5zpy-412144027959.us-east1.run.app/*"
```

### No Google Workspace Admin Console:
Se os funcionários logam no Chrome com contas `@empresa.com.br`:
1. Acesse o **Google Admin Console** (`admin.google.com`).
2. Vá em **Dispositivos > Chrome > Aplicativos e extensões > Usuários e navegadores**.
3. Selecione a Unidade Organizacional (ex: *Operações* ou *Logística*).
4. Clique no ícone de adição amarela `+` e selecione **Adicionar por ID**.
5. Insira o ID da extensão e a URL de atualização.
6. Em **Política de instalação**, selecione **Forçar instalação** (ou **Forçar instalação e fixar na barra de ferramentas**).

---

## Opção 2: Publicação Privada na Chrome Web Store (Recomendado para Google Workspace)

O Google permite publicar extensões na Chrome Web Store com visibilidade restrita exclusivamente aos usuários do domínio corporativo da sua empresa:

1. Acesse o [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
2. Faça o upload do arquivo `.zip` da pasta `/chrome-extension/`.
3. Na seção **Visibilidade da Distribuição**, selecione:
   - **Privado (Restrito à Organização)**: Escolha seu domínio corporativo Google Workspace.
4. **Vantagens:**
   - A extensão recebe a assinatura digital criptográfica do Google.
   - Não requer liberação de políticas de modo de desenvolvedor.
   - Atualizações automáticas de versão são gerenciadas de forma transparente pelos servidores do Google.
   - Apenas colaboradores com e-mail corporativo autenticado conseguem visualizar e instalar.

---

## Opção 3: Auto-Hospedagem Corporativa (`.crx` + `updates.xml`)

Para empresas que não utilizam o Google Workspace e desejam hospedar a extensão em sua própria infraestrutura:

1. O backend do Dimensio já disponibiliza o endpoint do manifesto de atualização:
   `GET /api/extension/updates.xml`
2. Empacota-se a pasta `/chrome-extension/` com uma chave privada corporativa (`key.pem`) gerando o binário `dimensio.crx`.
3. Na política corporativa de TI (`ExtensionInstallSources`), autoriza-se o domínio do Dimensio para instalação direta.

---

## Opção 4: Alternativa "Zero-Install" — Dimensio QuickTools Bookmarklet

Para operações onde a aprovação do departamento de TI leva tempo ou para computadores compartilhados/terceirizados onde não é possível alterar políticas de segurança, disponibilizamos o **Dimensio QuickTools Bookmarklet**:

- **Como funciona:**
  É um botão de favoritos no navegador contendo um loader assíncrono em JavaScript (`javascript:(function(){...})()`).
- **O que faz:**
  Ao ser clicado na tela de qualquer WMS, ERP ou Google Sheets, ele injeta o dock flutuante de preenchimento rápido, destaque de nomes de colaboradores e atalho do rádio PTT diretamente no DOM da página ativa.
- **Vantagem:**
  Funciona em 100% dos navegadores corporativos sem nenhuma instalação prévia, sem modo de desenvolvedor e sem exigir privilégios de administrador de máquina.

---

## Matriz Comparativa de Métodos de Implantação

| Método | Esforço do Usuário | Exige Modo Dev? | Nível de Segurança TI | Ideal para |
| :--- | :--- | :--- | :--- | :--- |
| **GPO / Force-Install** | Zero (Automático) | Não | Máximo (Homologado) | Empresas com parque de máquinas Windows/Intune gerenciado |
| **Web Store Privada** | 1 Clique no link | Não | Máximo (Certificado Google) | Empresas que utilizam Google Workspace |
| **Zero-Install Bookmarklet** | 1 Clique no favorito | Não | Alto (Apenas DOM local) | Pilotos rápidos, terceiros ou TI restritiva |
| **Modo Desenvolvedor** | Manual (Arrastar pasta)| Sim | Proibido em muitas empresas| Ambientes de teste locais do desenvolvedor |
