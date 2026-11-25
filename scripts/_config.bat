@echo off
rem ==================================================================
rem Configuracao comum: localiza o MySQL instalado e gera o my.ini da
rem instancia propria do projeto (pasta mysql\, porta 3307).
rem ==================================================================
set "RAIZ=%~dp0.."
for %%I in ("%RAIZ%") do set "RAIZ=%%~fI"
set "PORTA_DB=3307"

set "MYSQL_BIN="
for %%V in (8.0 8.4 9.0 9.1 9.2 9.3 9.4 9.5) do (
  if not defined MYSQL_BIN if exist "C:\Program Files\MySQL\MySQL Server %%V\bin\mysqld.exe" set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server %%V\bin"
)
if not defined MYSQL_BIN (
  echo [ERRO] MySQL Server nao encontrado em "C:\Program Files\MySQL".
  echo        Instale o MySQL Server 8 ou ajuste MYSQL_BIN em scripts\_config.bat
  exit /b 1
)

set "DADOS=%RAIZ%\mysql\data"
set "INI=%RAIZ%\mysql\my.ini"
set "BASE_FWD=%MYSQL_BIN:\bin=%"
set "BASE_FWD=%BASE_FWD:\=/%"
set "RAIZ_FWD=%RAIZ:\=/%"

if not exist "%RAIZ%\mysql" mkdir "%RAIZ%\mysql"
(
  echo # Gerado automaticamente por scripts\_config.bat
  echo [mysqld]
  echo basedir="%BASE_FWD%"
  echo datadir="%RAIZ_FWD%/mysql/data"
  echo port=%PORTA_DB%
  echo bind-address=127.0.0.1
  echo mysqlx=OFF
  echo character-set-server=utf8mb4
  echo collation-server=utf8mb4_unicode_ci
  echo default-time-zone='-03:00'
  echo log-error="%RAIZ_FWD%/mysql/mysql.err"
  echo.
  echo [client]
  echo port=%PORTA_DB%
  echo default-character-set=utf8mb4
) > "%INI%"
exit /b 0
