@echo off
rem Desliga a instancia MySQL do projeto.
call "%~dp0_config.bat" || exit /b 1
"%MYSQL_BIN%\mysqladmin.exe" -uroot -h127.0.0.1 -P%PORTA_DB% shutdown && echo MySQL do projeto desligado.
