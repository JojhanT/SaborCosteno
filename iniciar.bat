@echo off
chcp 65001 >nul
title Sabor Costeño · Sistema de pedidos
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   No se encontro Node.js en este equipo.
  echo   Descargalo e instalalo desde https://nodejs.org  ^(version 22 o superior^)
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo   Instalando dependencias por primera vez, espera un momento...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)

if not exist client\dist\index.html (
  echo.
  echo   Preparando la aplicacion...
  call npm run build
  if errorlevel 1 ( pause & exit /b 1 )
)

rem abre el navegador un par de segundos despues de arrancar el servidor
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
call npm start
pause
