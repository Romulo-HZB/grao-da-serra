@echo off
rem ==================================================================
rem Instala TUDO do zero:
rem  1) cria a instancia MySQL do projeto (pasta mysql\data, porta 3307)
rem  2) cria o banco grao_da_serra com os dados de teste
rem  3) instala functions, procedures, views e triggers (questoes 1-15)
rem  4) instala os extras da interface e o usuario grao_app
rem  5) instala as dependencias do servidor Node (npm install)
rem Pode ser executado de novo para voltar ao estado inicial.
rem ==================================================================
call "%~dp0_config.bat" || (pause & exit /b 1)
cd /d "%RAIZ%"

if not exist "%DADOS%\mysql" (
  echo [1/5] Criando a instancia MySQL do projeto...
  "%MYSQL_BIN%\mysqld.exe" --defaults-file="%INI%" --initialize-insecure || (echo Falha ao inicializar. & pause & exit /b 1)
) else (
  echo [1/5] Instancia MySQL ja existe.
)

call "%~dp0iniciar-banco.bat" || (pause & exit /b 1)

set "CLI="%MYSQL_BIN%\mysql.exe" -uroot -h127.0.0.1 -P%PORTA_DB% --default-character-set=utf8mb4"
echo [2/5] Criando o banco e os dados de teste...
%CLI% < "sql\01_criacao_banco.sql" || (pause & exit /b 1)
echo [3/5] Instalando functions, procedures, views e triggers...
%CLI% < "sql\02_solucoes.sql" || (pause & exit /b 1)
echo [4/5] Instalando extras da interface e usuario grao_app...
%CLI% < "sql\03_extras_interface.sql" || (pause & exit /b 1)

echo [5/5] Instalando dependencias do servidor (npm install)...
call npm install --no-fund --no-audit || (pause & exit /b 1)

echo.
echo Tudo pronto! Agora execute INICIAR-SISTEMA.bat
pause
