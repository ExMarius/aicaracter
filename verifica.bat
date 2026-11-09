@echo off
setlocal
title GICU - verificare
cd /d "%~dp0"
chcp 65001 >nul

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Nu ai Node.js instalat. Descarca de la https://nodejs.org (butonul LTS).
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [..] Instalez componentele (prima data dureaza 1-2 minute)...
  call npm install
)

call npm run doctor
echo.
pause
