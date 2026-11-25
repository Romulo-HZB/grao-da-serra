@echo off
rem ==================================================================
rem Configuracao usada pelos outros scripts:
rem  - acha o MySQL instalado no computador
rem  - gera o banco\my.ini do banco proprio desta pasta (porta 3308)
rem ==================================================================
set "RAIZ=%~dp0.."
for %%I in ("%RAIZ%") do set "RAIZ=%%~fI"
set "PORTA_DB=3308"

set "MYSQL_BIN="
for %%V in (8.0 8.4 9.0 9.1 9.2 9.3 9.4 9.5) do (
  if not defined MYSQL_BIN if exist "C:\Program Files\MySQL\MySQL Server %%V\bin\mysqld.exe" set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server %%V\bin"
)
if not defined MYSQL_BIN (
  echo [ERRO] MySQL Server nao encontrado em "C:\Program Files\MySQL".
  exit /b 1
)

set "DADOS=%RAIZ%\banco\data"
set "INI=%RAIZ%\banco\my.ini"
set "BASE_FWD=%MYSQL_BIN:\bin=%"
set "BASE_FWD=%BASE_FWD:\=/%"
set "RAIZ_FWD=%RAIZ:\=/%"
set "CLI="%MYSQL_BIN%\mysql.exe" -uroot -h127.0.0.1 -P%PORTA_DB% --default-character-set=utf8mb4"
set "ADMIN="%MYSQL_BIN%\mysqladmin.exe" -uroot -h127.0.0.1 -P%PORTA_DB%"

if not exist "%RAIZ%\banco" mkdir "%RAIZ%\banco"
(
  echo [mysqld]
  echo basedir="%BASE_FWD%"
  echo datadir="%RAIZ_FWD%/banco/data"
  echo port=%PORTA_DB%
  echo bind-address=127.0.0.1
  echo mysqlx=OFF
  echo character-set-server=utf8mb4
  echo collation-server=utf8mb4_unicode_ci
  echo default-time-zone='-03:00'
  echo log-error="%RAIZ_FWD%/banco/mysql.err"
) > "%INI%"
exit /b 0
