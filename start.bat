@echo off
setlocal
title GICU - personaj AI pentru Minecraft
cd /d "%~dp0"
chcp 65001 >nul

echo ==================================================
echo    GICU - personaj AI pentru Minecraft 1.21.4
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Nu ai Node.js instalat.
  echo.
  echo     Deschide https://nodejs.org si apasa butonul verde "LTS".
  echo     Instaleaza-l (Next, Next, Finish), apoi inchide si redeschide
  echo     acest fisier.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODEVER=%%v
echo [ok] Node.js %NODEVER% gasit.

if not exist "node_modules" (
  echo.
  echo [..] Prima pornire: instalez componentele. Dureaza 1-2 minute.
  echo      Poti sa lasi fereastra sa lucreze.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [!] Instalarea a esuat. Verifica daca ai internet si ruleaza din nou.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  echo.
  echo [..] Nu exista fisierul de configurare .env - il creez acum.
  copy ".env.example" ".env" >nul
  echo.
  echo   ==========================================================
  echo    SE DESCHIDE NOTEPAD. Completeaza 3 randuri:
  echo   ==========================================================
  echo.
  echo      MC_HOST=localhost        (serverul; localhost = propriul PC)
  echo      MC_OWNER=NumeleTau        (numele tau din Minecraft)
  echo      LLM_API_KEY=...          (cheia AI; vezi GHID-RAPID.md)
  echo.
  echo    Salveaza cu Ctrl+S, inchide Notepad, apoi apasa o tasta aici.
  echo.
  start notepad ".env"
  pause
)

echo.
echo [..] Pornesc Gicu. Lasa fereastra asta deschisa cat joci.
echo      Ca sa il opresti: Ctrl+C sau inchide fereastra.
echo.
call npm start

echo.
echo Gicu s-a oprit. Daca a aparut o eroare mai sus, ruleaza verifica.bat
pause
