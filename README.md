# Empório & Café Grão da Serra

Exercício de Banco de Dados: **functions, procedures, views e triggers** (questões 1 a 15) e **interface conectada ao banco** (questão 16).

## O que tem aqui

| Arquivo / pasta | Para que serve |
|---|---|
| `sql/01_criacao_banco.sql` | Script do enunciado: cria o banco `grao_da_serra`, as tabelas e os dados de teste. |
| `sql/02_solucoes.sql` | **Questões 1 a 15**: 3 functions, 4 procedures, 4 views e 4 triggers. |
| `sql/03_extras.sql` | Extras usados pela interface (não fazem parte das questões): a view `vw_itens_pedido`, para mostrar a comanda, e um trigger que só deixa remover itens de pedidos ABERTOS. |
| `sql/04_testes.sql` | Roteiro de testes das questões 1 a 15, com os resultados esperados. |
| `server.js` | **Questão 16 (conexão)**: servidor intermediário em Node.js que liga a página ao MySQL. |
| `public/js/api.js` | **Questão 16**: módulo único de acesso a dados da interface (uma função por operação). |
| `public/index.html`, `public/css/style.css`, `public/js/app.js` | **Questão 16 (interface)**: telas, estilo e navegação. |
| `package.json` | Bibliotecas do servidor: express e mysql2. |
| `INSTALAR.bat`, `INICIAR.bat`, `PARAR-BANCO.bat`, `scripts/` | Atalhos para instalar e ligar tudo no Windows (opção A abaixo). |

## Como executar

Pré-requisitos: **MySQL Server 8** e **Node.js** (versão 18 ou mais nova).

### Opção A: automática (Windows)

Cria um banco só desta pasta (porta **3308**, usuário root sem senha). Não usa nem altera o MySQL que já estiver instalado no computador.

1. Dê dois cliques em **`INSTALAR.bat`** (só na primeira vez, ou para voltar os dados ao início).
2. Dê dois cliques em **`INICIAR.bat`**. O navegador abre em `http://localhost:3001`.
3. Para desligar: feche a janela do servidor e execute **`PARAR-BANCO.bat`**.

### Opção B: com um MySQL já instalado (Workbench)

1. No Workbench, execute `sql/01_criacao_banco.sql`, `sql/02_solucoes.sql` e `sql/03_extras.sql`, nessa ordem.
2. No começo do `server.js`, troque `port: 3308` pela porta do seu MySQL (normalmente `3306`) e coloque a senha do root em `password`.
3. Na pasta do projeto, rode `npm install` e depois `npm start`.
4. Abra `http://localhost:3001`.

## Resultados dos testes

Todos os testes do enunciado (`sql/04_testes.sql`) devolveram os valores esperados:

- `fn_total_pedido(1)`, `(3)` e `(99)`: 34.00, 57.90 e 0.00
- Desconto de fidelidade: 10 para a cliente 1, 5 para o cliente 2 e 0 para os demais
- `sp_abrir_pedido(5, 1, @novo)`: pedido 11, com status ABERTO
- `sp_finalizar_pedido(10)`: 5% de desconto e total 25.65. `sp_finalizar_pedido(9)`: 0% e 30.00
- `sp_reajustar_precos_categoria(1, 10)`: preços 6.60, 12.65 e 8.80
- Histórico de preços: 3 linhas por reajuste e nenhuma linha quando só o estoque muda
- Todas as recusas devolvem mensagem em português (`SIGNAL SQLSTATE '45000'`)

No Workbench, os comandos marcados como "ERRO ESPERADO" devem ser executados um de cada vez (Ctrl+Enter), porque um erro interrompe o script inteiro.

> **Observação sobre a questão 14:** dentro de um trigger, `CURRENT_USER()` devolve o *definer* do trigger, isto é, quem o criou (por exemplo, `root@localhost`), e não o usuário que fez o `UPDATE`. Foi usado `CURRENT_USER()` porque é o que o enunciado pede. Para registrar o usuário conectado, seria usado `USER()`.

## Como a conexão funciona

```
Página (api.js)  --fetch-->  server.js (Express + mysql2)  --SQL-->  MySQL grao_da_serra
                 <--JSON---                                <--------
```

O `server.js` usa três padrões:

- **View:** `GET /api/cardapio` executa `SELECT * FROM vw_cardapio`.
- **Procedure:** `POST /api/pedidos/:id/itens` executa `CALL sp_adicionar_item(?, ?, ?)`.
- **Procedure com parâmetro OUT:** `POST /api/pedidos` executa `CALL sp_abrir_pedido(?, ?, @id)` e depois `SELECT @id`.

Quando uma procedure ou um trigger recusa a operação com `SIGNAL`, o servidor devolve `{ erro: "mensagem" }`, e a tela mostra a mensagem no canto superior. Se o banco estiver desligado, a tela avisa "Sem conexão com o banco". Os triggers não aparecem no servidor: eles rodam sozinhos no banco quando um item é inserido ou removido, ou quando um preço ou pedido muda.

## Descrição da conexão

A interface foi feita como página web (HTML, CSS e JavaScript). Como o navegador não se conecta diretamente ao MySQL, foi criado um programa intermediário em **Node.js**, com o framework **Express** e o conector **mysql2**. Esse programa fica no arquivo `server.js`, que entrega a página e oferece rotas `/api/...`. Os dados de acesso ao banco (servidor, porta, usuário, senha e nome do banco `grao_da_serra`) ficam no começo do `server.js`, no `mysql.createPool`, e nunca chegam ao navegador. O pool foi configurado com uma única conexão, porque o parâmetro OUT de `sp_abrir_pedido` fica numa variável (`@id`) que só existe dentro da conexão que fez o `CALL`. Na página, todo o acesso a dados fica no módulo `public/js/api.js`, que tem uma função por operação e usa `fetch` para chamar o servidor. Por exemplo, para mostrar o cardápio, `listarCardapio()` pede `/api/cardapio`, e o servidor executa `SELECT * FROM vw_cardapio` e devolve as linhas em JSON. Para adicionar um item, `adicionarItem()` envia um POST para `/api/pedidos/:id/itens`, e o servidor executa `CALL sp_adicionar_item(?, ?, ?)` com os valores recebidos. Para abrir um pedido, o servidor executa `CALL sp_abrir_pedido(?, ?, @id)` e depois `SELECT @id`. Se uma procedure ou um trigger recusar a operação com `SIGNAL`, a mensagem em português volta para a página e é exibida na tela. Depois de cada operação, a tela recarrega os dados das views, porque os triggers mudam o estoque e a situação dos produtos.

## Versão completa

Esta é a versão simplificada. Existe também uma versão com usuário de banco de permissões restritas (`grao_app`), dados de acesso em arquivo `.env` e pool com várias conexões, no branch [`versao-completa`](https://github.com/Romulo-HZB/grao-da-serra/tree/versao-completa).

## Prompt usado para a interface (trechos preenchidos)

**TECNOLOGIA:** HTML + CSS + JavaScript no navegador, com servidor intermediário em Node.js (Express + mysql2).

**LAYOUT:** Sistema de caixa (PDV) de cafeteria, usado pelo atendente no balcão e pela gerência, no computador e no celular. Barra lateral cor de café torrado com as quatro telas; no celular, ela vira uma barra inferior com ícones. Área de trabalho clara, cor de leite, com laranja de torra nos botões principais e verde para "pago" e confirmações. Cada categoria do cardápio tem uma cor e um ícone próprios. Títulos com a fonte Bricolage Grotesque e textos com Manrope. Botões e campos grandes (48 px ou mais) para uso por toque. No "Novo pedido", cliente e atendente são escolhidos em cartões com as iniciais; os produtos aparecem em blocos com código, preço e situação, e a comanda fica ao lado com o número do pedido, os itens e o valor bruto. Ao finalizar, aparece um recibo com o desconto e o total. As mensagens do banco aparecem no canto superior da tela: vermelhas para recusas e verdes para confirmações.
