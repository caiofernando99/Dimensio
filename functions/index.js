/**
 * Firebase Cloud Functions - Dimensio Triggers
 * Trigger disparado automaticamente após o cadastro de um novo usuário no Firebase Auth
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Trigger onCreate: Envia e-mail de boas-vindas e próximos passos para o novo gestor
 */
exports.sendWelcomeEmailOnUserCreate = functions.auth.user().onCreate(async (user) => {
  const email = user.email;
  const displayName = user.displayName || email ? email.split('@')[0] : 'Gestor';

  console.log(`[Dimensio Trigger] Novo usuário registrado: ${email} (${displayName})`);

  // Gera o HTML amigável de boas-vindas com os próximos passos da empresa
  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%); padding: 32px 24px; color: #ffffff; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
          .content { padding: 32px 24px; }
          .step { display: flex; margin-bottom: 20px; align-items: flex-start; }
          .step-num { width: 32px; height: 32px; border-radius: 50%; background: #e0e7ff; color: #4338ca; font-weight: 800; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 16px; margin-top: 2px; }
          .step-text h4 { margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #1e293b; }
          .step-text p { margin: 0; font-size: 13px; color: #64748b; line-height: 1.5; }
          .cta-container { text-align: center; margin: 32px 0 16px 0; }
          .cta-btn { display: inline-block; background: #4f46e5; color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px; }
          .footer { padding: 20px 24px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>Bem-vindo ao Dimensio! 👋</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Sua plataforma de dimensionamento, escalas e rádio operacional PTT</p>
          </div>
          <div class="content">
            <p style="font-size: 14px; line-height: 1.6; margin-top: 0;">
              Olá, <strong>${displayName}</strong>! Ficamos muito felizes em ter você conosco. Seu ambiente de trabalho em nuvem já está ativo e pronto para uso.
            </p>
            <p style="font-size: 14px; font-weight: 700; color: #334155; margin: 24px 0 16px 0;">
              Confira os próximos 4 passos para colocar sua operação para rodar:
            </p>
            
            <div class="step">
              <div class="step-num">1</div>
              <div class="step-text">
                <h4>Defina os Turnos & Postos da sua Empresa</h4>
                <p>Acesse as Configurações para cadastrar os horários dos turnos (ex: Manhã, Tarde, T1, T2) e os postos de trabalho (docas, balanças, linhas de produção).</p>
              </div>
            </div>

            <div class="step">
              <div class="step-num">2</div>
              <div class="step-text">
                <h4>Cadastre ou Importe a sua Equipe</h4>
                <p>Na aba Equipe, insira seus operadores e líderes (nome, RE/matrícula e cargo). Você também pode importar rapidamente via planilha ou CSV.</p>
              </div>
            </div>

            <div class="step">
              <div class="step-num">3</div>
              <div class="step-text">
                <h4>Monte a Escala Diária e Ative as Pausas</h4>
                <p>Distribua os operadores nos postos, defina o revezamento NR-17 e controle a presença em tempo real pelo painel.</p>
              </div>
            </div>

            <div class="step">
              <div class="step-num">4</div>
              <div class="step-text">
                <h4>Compartilhe o Link com sua Equipe</h4>
                <p>Os operadores podem acessar o Portal do Operador diretamente pelo celular ou totem para bipar tarefas e falar no Rádio PTT.</p>
              </div>
            </div>

            <div class="cta-container">
              <a href="https://ais-pre-m46gb5dmwo4z3ulnbl5zpy-412144027959.us-east1.run.app" class="cta-btn">
                Acessar meu Painel Dimensio →
              </a>
            </div>
          </div>
          <div class="footer">
            Dimensio Gestão Operacional & Escalas · Suporte e documentação inclusos.<br>
            Se precisar de ajuda ou tiver dúvidas, consulte a central de ajuda dentro da plataforma.
          </div>
        </div>
      </body>
    </html>
  `;

  // Registra o evento de boas-vindas no Firestore para auditoria
  try {
    const db = admin.firestore();
    await db.collection('dimensio_welcome_emails').add({
      userId: user.uid,
      email: user.email,
      displayName: displayName,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'dispatched',
    });
  } catch (err) {
    console.error('[Dimensio Trigger] Erro ao gravar registro de e-mail no Firestore:', err);
  }

  return { success: true };
});
