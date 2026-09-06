# 🧩 Extensão Chrome do Dimensio — Guia de Instalação e Uso

Esta pasta contém o projeto completo da **Extensão Oficial do Dimensio para Google Chrome** (Manifest V3).

---

## 📌 Principais Recursos da Extensão
1. **Notificações Nativas em Segundo Plano:** Dispara alertas no sistema operacional (Windows/macOS/Linux) mesmo com a página do Dimensio fechada.
2. **Monitoramento via Service Worker:** Executa alarmes em segundo plano (`chrome.alarms`) a cada 5 minutos para checar trocas de turnos, pendências e alertas de intervalos.
3. **Painel Rápido (Popup):** Clique no ícone do Dimensio na barra do Chrome para ver o status da operação e abrir a aplicação com 1 clique.
4. **Integração com Google Planilhas (Content Script):** Permite sincronização rápida e atalhos operacionais quando você estiver navegando em planilhas do Google.

---

## 🛠️ Como Instalar no Google Chrome

1. Abra o navegador **Google Chrome**.
2. Acesse o endereço `chrome://extensions` na barra de navegação.
3. No canto superior direito, ative a opção **"Modo do desenvolvedor"** (Developer mode).
4. Clique no botão **"Carregar sem compactação"** (Load unpacked).
5. Selecione a pasta `chrome-extension` deste projeto.
6. Pronto! A extensão **Dimensio** aparecerá na sua lista de extensões e na barra superior do Chrome.

---

## 🧪 Como Testar Notificações em Segundo Plano

1. Clique no ícone do Dimensio na barra de ferramentas do Chrome.
2. Clique no botão **"🔔 Testar Notificação Chrome"**.
3. O sistema operacional exibirá uma notificação nativa da extensão, mesmo se a aba do Dimensio estiver fechada.
