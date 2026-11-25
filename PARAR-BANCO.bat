@echo off
rem Desliga o banco proprio desta pasta.
cd /d "%~dp0"
call scripts\config.bat || (pause & exit /b 1)
%ADMIN% shutdown && echo Banco desligado.
