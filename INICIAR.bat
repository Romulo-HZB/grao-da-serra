@echo off
rem Liga o banco (se preciso) e o servidor, e abre o site no navegador.
rem Para desligar o servidor, feche esta janela. Para desligar o banco,
rem execute o PARAR-BANCO.bat.
title Grao da Serra - servidor (nao feche)
cd /d "%~dp0"
call scripts\ligar-banco.bat || (pause & exit /b 1)
if not exist node_modules call npm install --no-fund --no-audit
start "" http://localhost:3001
node server.js
pause
