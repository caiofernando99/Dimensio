// Dimensio Extension Popup Controller

document.addEventListener('DOMContentLoaded', () => {
  const openAppBtn = document.getElementById('openAppBtn');
  const testNotifBtn = document.getElementById('testNotifBtn');
  const statusText = document.getElementById('statusText');

  // Open Dimensio Web App
  openAppBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://dimensio.app/' });
  });

  // Trigger test background notification via extension background service worker
  testNotifBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage(
      {
        action: 'TEST_BACKGROUND_NOTIFICATION',
        title: 'Dimensio — Notificação Extensão',
        message: 'A extensão para Chrome do Dimensio está enviando alertas em segundo plano com sucesso!'
      },
      (response) => {
        if (response && response.success) {
          statusText.textContent = 'Notificação disparada com sucesso!';
          setTimeout(() => {
            statusText.textContent = 'Notificações em Segundo Plano Ativas';
          }, 3000);
        }
      }
    );
  });
});
