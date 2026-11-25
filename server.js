// =====================================================================
// Servidor intermediário do Grão da Serra (Node.js + Express + mysql2)
//
// O navegador não consegue falar direto com o MySQL. Por isso a página
// chama as rotas /api/... abaixo, e cada rota só executa um SELECT em uma
// view ou um CALL em uma procedure e devolve o resultado em JSON.
// Nenhuma regra de negócio fica aqui: ela está toda no banco.
// =====================================================================
const express = require('express');
const mysql = require('mysql2');

const app = express();
app.use(express.json());                        // lê o JSON enviado pela página
app.use(express.static(__dirname + '/public')); // entrega as telas (HTML/CSS/JS)

// ---------------------------------------------------------------------
// DADOS DE ACESSO AO BANCO (ficam só aqui no servidor; o navegador não vê)
// Porta 3308 = banco criado pelo INSTALAR.bat desta pasta (root sem senha).
// Para usar um MySQL já instalado (Workbench), troque a porta para 3306
// e coloque a senha do root em password.
//
// createPool com connectionLimit: 1 = uma conexão só, que se reconecta
// sozinha se o banco cair. Ser uma só é o que faz o @id do OUT funcionar
// (a variável @id existe apenas dentro da conexão que fez o CALL).
// ---------------------------------------------------------------------
const banco = mysql.createPool({
  host: '127.0.0.1',
  port: 3308,
  user: 'root',
  password: '',
  database: 'grao_da_serra',
  connectionLimit: 1,
  decimalNumbers: true, // preços chegam como número (6.5) e não como texto ("6.50")
  dateStrings: true     // datas chegam como texto, do jeito que estão no banco
}).promise();

// Executa um comando SQL e devolve só as linhas do resultado.
// Os "?" são trocados pelos valores com segurança (evita SQL injection).
async function sql(comando, valores = []) {
  const [linhas] = await banco.query(comando, valores);
  return linhas;
}

// Transforma uma função em rota e devolve os erros para a tela.
function rota(funcao) {
  return async (req, res) => {
    try {
      res.json(await funcao(req));
    } catch (erro) {
      // Recusa do banco (SIGNAL nas procedures/triggers): mensagem em português
      if (erro.sqlState === '45000') {
        return res.status(400).json({ erro: erro.message });
      }
      // Banco desligado
      if (erro.code === 'ECONNREFUSED') {
        return res.status(500).json({ erro: 'Não foi possível conectar ao banco de dados. Ele está ligado?' });
      }
      // Qualquer outro problema
      res.status(500).json({ erro: 'Erro no banco de dados: ' + erro.message });
    }
  };
}

// ============================ SELECT (views e tabelas) ================
app.get('/api/cardapio', rota(() =>
  sql('SELECT * FROM vw_cardapio ORDER BY categoria, produto')));

app.get('/api/clientes', rota(() =>
  sql('SELECT id_cliente, nome, cpf FROM cliente ORDER BY nome')));

app.get('/api/funcionarios', rota(() =>
  sql('SELECT id_funcionario, nome, cargo FROM funcionario ORDER BY nome')));

app.get('/api/categorias', rota(() =>
  sql('SELECT id_categoria, nome FROM categoria ORDER BY id_categoria')));

// Lista de pedidos, com filtro opcional por status (?status=PAGO)
app.get('/api/pedidos', rota((req) => {
  if (req.query.status) {
    return sql('SELECT * FROM vw_pedidos_detalhados WHERE status = ? ORDER BY id_pedido DESC',
      [req.query.status]);
  }
  return sql('SELECT * FROM vw_pedidos_detalhados ORDER BY id_pedido DESC');
}));

// Um pedido só (cabeçalho da comanda)
app.get('/api/pedidos/:id', rota(async (req) => {
  const [pedido] = await sql('SELECT * FROM vw_pedidos_detalhados WHERE id_pedido = ?',
    [req.params.id]);
  return pedido || null;
}));

// Itens de um pedido (para mostrar a comanda) — view extra do 03_extras.sql
app.get('/api/pedidos/:id/itens', rota((req) =>
  sql('SELECT * FROM vw_itens_pedido WHERE id_pedido = ? ORDER BY produto', [req.params.id])));

app.get('/api/repor', rota(() =>
  sql('SELECT * FROM vw_produtos_para_repor ORDER BY faltam DESC, produto')));

app.get('/api/vendas', rota(() =>
  sql('SELECT * FROM vw_vendas_por_categoria ORDER BY faturamento DESC')));

app.get('/api/historico', rota(() =>
  sql(`SELECT h.id_historico, h.id_produto, p.nome AS produto,
              h.preco_antigo, h.preco_novo, h.data_alteracao, h.usuario
         FROM historico_preco h
         JOIN produto p ON p.id_produto = h.id_produto
        ORDER BY h.id_historico DESC`)));

// ============================ CALL (procedures) =======================
// Abrir pedido: o número volta no parâmetro OUT. Ele fica guardado na
// variável @id da conexão, e logo depois um SELECT lê essa variável.
app.post('/api/pedidos', rota(async (req) => {
  await sql('CALL sp_abrir_pedido(?, ?, @id)', [req.body.id_cliente, req.body.id_funcionario]);
  const [linha] = await sql('SELECT @id AS id_pedido');
  return linha; // { id_pedido: 11 }
}));

app.post('/api/pedidos/:id/itens', rota((req) =>
  sql('CALL sp_adicionar_item(?, ?, ?)',
    [req.params.id, req.body.id_produto, req.body.quantidade])));

// Finalizar: depois do CALL, devolve o pedido com o desconto e o total
// que o próprio banco calculou e gravou.
app.post('/api/pedidos/:id/finalizar', rota(async (req) => {
  await sql('CALL sp_finalizar_pedido(?)', [req.params.id]);
  const [pedido] = await sql('SELECT * FROM vw_pedidos_detalhados WHERE id_pedido = ?',
    [req.params.id]);
  return pedido;
}));

app.post('/api/reajuste', rota((req) =>
  sql('CALL sp_reajustar_precos_categoria(?, ?)',
    [req.body.id_categoria, req.body.percentual])));

// ============================ DELETE (remover item) ===================
// O trigger da questão 13 devolve o estoque sozinho, e o trigger extra
// do 03_extras.sql recusa a remoção se o pedido não estiver ABERTO.
app.delete('/api/pedidos/:id/itens/:idProduto', rota((req) =>
  sql('DELETE FROM item_pedido WHERE id_pedido = ? AND id_produto = ?',
    [req.params.id, req.params.idProduto])));

// ============================ Ligar o servidor ========================
app.listen(3001, () => console.log('Grão da Serra no ar: http://localhost:3001'));
