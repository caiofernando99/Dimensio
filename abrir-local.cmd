@echo off
title Dimensio - Iniciar servidor local
cd /d "%~dp0"

echo ==========================================
echo   Dimensio - servidor local
echo   URL: http://localhost:3000/
echo ==========================================
echo.

echo Abrindo a janela do servidor (NAO feche essa janela do servidor enquanto estiver testando)...
start "Dimensio Dev Server - feche esta janela para parar" cmd /k "npm run dev"

echo Aguardando o servidor ficar pronto...
timeout /t 7 /nobreak >nul

echo Abrindo o app no navegador...
start "" "http://localhost:3000/"

echo.
echo Servidor iniciado em http://localhost:3000/
echo Para encerrar depois: feche a janela "Dimensio Dev Server" ou pressione Ctrl+C nela.
echo.
pause