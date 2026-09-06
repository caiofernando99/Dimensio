# ============================================================
#  Dimensio - abre o app localmente (modo dev) no navegador.
#  Uso: powershell -ExecutionPolicy Bypass -File abrir-local.ps1
# ============================================================

$ErrorActionPreference = 'Stop'
$Port = 3000
$Url = "http://localhost:$Port/"

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Host "[ERRO] npm.cmd nao encontrado. Instale o Node.js." -ForegroundColor Red
  exit 1
}

Write-Host "=== Dimensio - abrir localmente ===" -ForegroundColor Cyan
Write-Host "Iniciando servidor de desenvolvimento (vite) na porta $Port ..." -ForegroundColor Yellow

$serverJob = Start-Job -ScriptBlock {
  param($dir)
  Set-Location -LiteralPath $dir
  npm.cmd run dev
} -ArgumentList (Get-Location).Path

$up = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { $up = $true; break }
  } catch {}
}
if (-not $up) {
  Write-Host "[ERRO] O servidor nao respondeu em $Url." -ForegroundColor Red
  Receive-Job -Job $serverJob
  Stop-Job -Job $serverJob
  Remove-Job -Job $serverJob
  exit 1
}

Write-Host "Servidor online em $Url" -ForegroundColor Green
Write-Host "Abrindo no navegador padrao..." -ForegroundColor Yellow
Start-Process $Url

Write-Host ""
Write-Host "Para encerrar: pressione Ctrl+C, ou feche a janela."
Write-Host "Logs abaixo (Ctrl+C para parar):" -ForegroundColor Cyan

while ($true) {
  Start-Sleep -Seconds 1
  Receive-Job -Job $serverJob
  if ($serverJob.State -eq 'Completed' -or $serverJob.State -eq 'Failed') { break }
}