@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   Esto desconecta TODOS los equipos y permite crear o restablecer
echo   la cuenta del administrador desde este computador.
echo   Los pedidos, el menu, las fotos y los demas usuarios NO se borran.
echo.
set /p OK=  Escribe SI para continuar:
if /I not "%OK%"=="SI" exit /b 0
node --disable-warning=ExperimentalWarning server/scripts/reset-claves.js
pause
