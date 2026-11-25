@echo off
rem Liga o banco proprio desta pasta (porta 3308) numa janela minimizada.
call "%~dp0config.bat" || exit /b 1
if not exist "%DADOS%\mysql" (
  echo Banco ainda nao instalado. Execute primeiro o INSTALAR.bat
  exit /b 1
)
%ADMIN% ping >nul 2>&1 && (echo Banco ja esta ligado na porta %PORTA_DB%. & exit /b 0)
echo Ligando o banco na porta %PORTA_DB%...
start "Banco Grao da Serra (nao feche)" /min "%MYSQL_BIN%\mysqld.exe" --defaults-file="%INI%" --console
for /l %%i in (1,1,30) do (
  %ADMIN% ping >nul 2>&1 && (echo Banco pronto! & exit /b 0)
  timeout /t 1 /nobreak >nul
)
echo [ERRO] O banco nao respondeu. Veja o arquivo banco\mysql.err
exit /b 1
