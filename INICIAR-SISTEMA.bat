@echo off
rem Liga o banco (se preciso) e o servidor da interface web.
title Grao da Serra - servidor
call "%~dp0scripts\iniciar-banco.bat" || (pause & exit /b 1)
cd /d "%~dp0"
if not exist node_modules call npm install --no-fund --no-audit
start "" http://localhost:3000
node server\server.js
pause
