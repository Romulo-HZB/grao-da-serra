# Empório & Café Grão da Serra

Exercício prático de Banco de Dados: **functions, procedures, views e triggers** (questões 1 a 15) e **interface conectada ao banco** (questão 16).

## Onde está cada questão

| Questões | Arquivo |
|---|---|
| **1 a 15** | [`sql/02_solucoes.sql`](sql/02_solucoes.sql): 3 functions, 4 procedures, 4 views e 4 triggers |
| 16 (interface) | [`public/`](public) (telas) e [`server/`](server) (servidor intermediário) |
| 16 (descrição da conexão) | seção [Descrição da conexão](#descrição-da-conexão), mais abaixo |

### Todos os arquivos

| Arquivo / pasta | Para que serve |
|---|---|
| `sql/01_criacao_banco.sql` | Script fornecido no enunciado: cria o banco `grao_da_serra`, as 7 tabelas e os dados de teste. |
| `sql/02_solucoes.sql` | Soluções das questões 1 a 15. Pode ser executado mais de uma vez. |
| `sql/03_extras_interface.sql` | Extras usados pela interface: view `vw_itens_pedido`, trigger que impede remover item de pedido encerrado e o usuário `grao_app`. |
| `sql/04_testes.sql` | Todos os testes do enunciado, na ordem, com os resultados esperados. |
| `server/` | Servidor em Node.js (Express + mysql2). |
| `public/` | Interface web (HTML, CSS e JavaScript). `public/js/api.js` é o módulo único de acesso a dados. |
| `.env` | Dados de acesso ao banco usados pelo servidor. |
| `INSTALAR.bat`, `INICIAR-SISTEMA.bat`, `scripts/` | Scripts para instalar e ligar tudo no Windows. |

## Como executar

Pré-requisitos: **MySQL Server 8** e **Node.js** (versão 18 ou mais nova).

### Opção A: automática (Windows)

1. Dê dois cliques em **`INSTALAR.bat`**. Ele cria uma instância MySQL própria do projeto na pasta `mysql\` (porta **3307**, sem precisar de administrador), executa os scripts `01`, `02` e `03` e instala as dependências (`npm install`).
2. Dê dois cliques em **`INICIAR-SISTEMA.bat`**. O navegador abre em `http://localhost:3000`.

Para abrir essa instância no Workbench: host `127.0.0.1`, porta `3307`, usuário `root`, sem senha.

### Opção B: com um MySQL já instalado (porta 3306)

1. No MySQL Workbench, execute em ordem: `sql/01_criacao_banco.sql`, `sql/02_solucoes.sql` e `sql/03_extras_interface.sql`.
2. No arquivo `.env`, troque `DB_PORT=3307` por `DB_PORT=3306`.
3. Em um terminal, na pasta do projeto:
   ```bash
   npm install
   npm start
   ```
4. Abra `http://localhost:3000`.

Para testar as questões 1 a 15 no Workbench, use `sql/04_testes.sql`. Os comandos marcados como "ERRO ESPERADO" devem ser executados um de cada vez (Ctrl+Enter), porque um erro interrompe a execução do script inteiro.

## Resultados dos testes

Todos os testes do enunciado devolveram os valores esperados:

- `fn_total_pedido(1)`, `(3)` e `(99)`: 34.00, 57.90 e 0.00
- Desconto de fidelidade: 10 para a cliente 1, 5 para o cliente 2 e 0 para os demais
- `sp_abrir_pedido(5, 1, @novo)`: pedido 11, com status ABERTO
- `sp_finalizar_pedido(10)`: 5% de desconto e total 25.65. `sp_finalizar_pedido(9)`: 0% e 30.00
- `sp_reajustar_precos_categoria(1, 10)`: preços 6.60, 12.65 e 8.80
- Histórico de preços: 3 linhas por reajuste e nenhuma linha quando só o estoque muda
- Todas as recusas devolvem mensagem em português (`SIGNAL SQLSTATE '45000'`)

> **Observação sobre a questão 14:** dentro de um trigger, `CURRENT_USER()` devolve o *definer* do trigger, isto é, quem o criou (por exemplo, `root@localhost`), e não o usuário que fez o `UPDATE`. Foi usado `CURRENT_USER()` porque é o que o enunciado pede. Para registrar o usuário conectado, seria usado `USER()`.

## Interface

Quatro telas, que funcionam no computador e no celular:

- **Cardápio:** dados da view `vw_cardapio`, agrupados por categoria. Produtos esgotados aparecem desabilitados e os que precisam de reposição mostram "Últimas unidades".
- **Novo pedido:** escolha de cliente e atendente, `sp_abrir_pedido`, `sp_adicionar_item`, remoção de item (`DELETE` em `item_pedido`) e `sp_finalizar_pedido`, com recibo mostrando o desconto e o total gravados pelo banco.
- **Pedidos:** view `vw_pedidos_detalhados` com filtro por status. Pedidos abertos podem ser retomados.
- **Gerência:** views `vw_produtos_para_repor` e `vw_vendas_por_categoria`, reajuste de preços (`sp_reajustar_precos_categoria`) e histórico de preços.

A interface não calcula totais, descontos nem estoque. Ela exibe o que as views devolvem e chama as procedures. As mensagens de erro das procedures e dos triggers aparecem no canto superior da tela.

## Descrição da conexão

A interface foi feita como página web (HTML, CSS e JavaScript), e como o navegador não consegue se conectar diretamente ao MySQL, foi criado um programa intermediário em **Node.js** com o framework **Express** e o conector **mysql2**. O servidor (`server/server.js`) entrega a página e oferece rotas `/api/...`; cada rota apenas executa um comando no banco e devolve o resultado em JSON, sem nenhuma regra de negócio. Os dados de acesso (host, porta, usuário `grao_app`, senha e nome do banco) ficam no arquivo `.env`, lido pelo módulo `server/db.js`, que cria um pool de conexões. O usuário `grao_app` só pode ler as views e as tabelas de apoio e executar as procedures, então a interface não altera as tabelas diretamente. No navegador, todo o acesso a dados fica no módulo `public/js/api.js`, que tem uma função por operação. Por exemplo, para mostrar o cardápio, `listarCardapio()` faz um `fetch` para `/api/cardapio`, e o servidor executa `SELECT * FROM vw_cardapio`. Para abrir um pedido, `abrirPedido()` envia um POST para `/api/pedidos`, e o servidor executa `CALL sp_abrir_pedido(?, ?, @id_pedido)` seguido de `SELECT @id_pedido` na mesma conexão, para ler o parâmetro OUT. Quando uma procedure ou trigger recusa a operação com `SIGNAL`, o servidor devolve a mensagem em português e a interface a exibe na área de mensagens. Depois de cada operação, a tela é recarregada a partir das views, porque os triggers mudam o estoque e a situação dos produtos.

## Prompt usado para a interface (trechos preenchidos)

**TECNOLOGIA:** HTML + CSS + JavaScript no navegador, com servidor intermediário em Node.js (Express + mysql2).

**LAYOUT:** Sistema de caixa (PDV) de cafeteria, usado pelo atendente no balcão e pela gerência, no computador e no celular. Barra lateral cor de café torrado com as quatro telas; no celular, ela vira uma barra inferior com ícones. Área de trabalho clara, cor de leite, com laranja de torra nos botões principais e verde para "pago" e confirmações. Cada categoria do cardápio tem uma cor e um ícone próprios. Títulos com a fonte Bricolage Grotesque e textos com Manrope. Botões e campos grandes (48 px ou mais) para uso por toque. No "Novo pedido", cliente e atendente são escolhidos em cartões com as iniciais; os produtos aparecem em blocos com código, preço e situação, e a comanda fica ao lado com o número do pedido, os itens e o valor bruto. Ao finalizar, aparece um recibo com o desconto e o total. As mensagens do banco aparecem no canto superior da tela: vermelhas para recusas e verdes para confirmações.
