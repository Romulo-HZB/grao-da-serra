@echo off
rem ==================================================================
rem Instala tudo do zero (pode rodar de novo para voltar ao inicio):
rem  1) cria o banco proprio desta pasta (pasta banco\, porta 3308)
rem  2) executa os scripts SQL 01, 02 e 03
rem  3) instala as bibliotecas do servidor (npm install)
rem ==================================================================
cd /d "%~dp0"
call scripts\config.bat || (pause & exit /b 1)

if not exist "%DADOS%\mysql" (
  echo [1/3] Criando o banco...
  "%MYSQL_BIN%\mysqld.exe" --defaults-file="%INI%" --initialize-insecure || (echo Falha ao criar o banco. & pause & exit /b 1)
) else (
  echo [1/3] Banco ja existe.
)
call scripts\ligar-banco.bat || (pause & exit /b 1)

echo [2/3] Executando os scripts SQL...
%CLI% < sql\01_criacao_banco.sql || (pause & exit /b 1)
%CLI% < sql\02_solucoes.sql      || (pause & exit /b 1)
%CLI% < sql\03_extras.sql        || (pause & exit /b 1)

echo [3/3] Instalando as bibliotecas do servidor...
call npm install --no-fund --no-audit || (pause & exit /b 1)

echo.
echo Tudo pronto! Agora execute o INICIAR.bat
pause
