@echo off
rem Liga a instancia MySQL do projeto (porta 3307) em uma janela minimizada.
call "%~dp0_config.bat" || (pause & exit /b 1)
if not exist "%DADOS%\mysql" (
  echo Banco ainda nao instalado. Execute primeiro scripts\instalar-banco.bat
  pause & exit /b 1
)
"%MYSQL_BIN%\mysqladmin.exe" -uroot -h127.0.0.1 -P%PORTA_DB% ping >nul 2>&1 && (
  echo MySQL do projeto ja esta ligado na porta %PORTA_DB%.
  exit /b 0
)
echo Ligando o MySQL do projeto na porta %PORTA_DB%...
start "MySQL Grao da Serra" /min "%MYSQL_BIN%\mysqld.exe" --defaults-file="%INI%" --console
for /l %%i in (1,1,30) do (
  "%MYSQL_BIN%\mysqladmin.exe" -uroot -h127.0.0.1 -P%PORTA_DB% ping >nul 2>&1 && (echo MySQL pronto! & exit /b 0)
  timeout /t 1 /nobreak >nul
)
echo [ERRO] O MySQL nao respondeu. Veja o log em mysql\mysql.err
exit /b 1
