// =====================================================================
// Servidor intermediário (Node.js + Express) do Grão da Serra
//
// O navegador não conversa direto com o MySQL. A página chama as rotas
// /api/... abaixo; cada rota apenas executa um SELECT em uma view ou um
// CALL em uma procedure e devolve o resultado em JSON. Nenhuma regra de
// negócio é implementada aqui: ela está toda no banco.
// =====================================================================
const path = require('path');
const os = require('os');
const express = require('express');
const pool = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Transforma uma função assíncrona em rota e trata os erros do banco.
// Erros disparados por SIGNAL (SQLSTATE 45000) são regras de negócio:
// a mensagem em português vai direto para a interface exibir.
const rota = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    if (err.sqlState === '45000') {
      return res.status(400).json({ erro: err.sqlMessage });
    }
    console.error(err);
    const msg = err.code === 'ECONNREFUSED'
      ? 'Não foi possível conectar ao banco de dados. Ele está ligado?'
      : `Erro no banco de dados: ${err.sqlMessage || err.message}`;
    res.status(500).json({ erro: msg });
  }
};

// Executa um comando e devolve só as linhas
async function consultar(sql, params = []) {
  const [linhas] = await pool.query(sql, params);
  return linhas;
}

// ------------------------------- Cadastros ---------------------------
app.get('/api/clientes', rota(() =>
  consultar('SELECT id_cliente, nome, cpf FROM cliente ORDER BY nome')));

app.get('/api/funcionarios', rota(() =>
  consultar('SELECT id_funcionario, nome, cargo FROM funcionario ORDER BY nome')));

app.get('/api/categorias', rota(() =>
  consultar('SELECT id_categoria, nome FROM categoria ORDER BY id_categoria')));

// ------------------------------- Cardápio ----------------------------
app.get('/api/cardapio', rota(() =>
  consultar('SELECT * FROM vw_cardapio ORDER BY categoria, produto')));

// ------------------------------- Pedidos -----------------------------
app.get('/api/pedidos', rota((req) => {
  const { status } = req.query;
  if (status) {
    return consultar(
      'SELECT * FROM vw_pedidos_detalhados WHERE status = ? ORDER BY id_pedido DESC', [status]);
  }
  return consultar('SELECT * FROM vw_pedidos_detalhados ORDER BY id_pedido DESC');
}));

app.get('/api/pedidos/:id', rota(async (req) => {
  const [pedido] = await consultar(
    'SELECT * FROM vw_pedidos_detalhados WHERE id_pedido = ?', [req.params.id]);
  return pedido || null;
}));

app.get('/api/pedidos/:id/itens', rota((req) =>
  consultar('SELECT * FROM vw_itens_pedido WHERE id_pedido = ? ORDER BY produto', [req.params.id])));

// sp_abrir_pedido devolve o número em um parâmetro OUT. A variável @id
// só existe na sessão, por isso o CALL e o SELECT usam a MESMA conexão.
app.post('/api/pedidos', rota(async (req) => {
  const { id_cliente, id_funcionario } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.query('CALL sp_abrir_pedido(?, ?, @id_pedido)', [id_cliente, id_funcionario]);
    const [[linha]] = await conn.query('SELECT @id_pedido AS id_pedido');
    return linha;
  } finally {
    conn.release();
  }
}));

app.post('/api/pedidos/:id/itens', rota(async (req) => {
  const { id_produto, quantidade } = req.body;
  await consultar('CALL sp_adicionar_item(?, ?, ?)', [req.params.id, id_produto, quantidade]);
  return { ok: true };
}));

app.delete('/api/pedidos/:id/itens/:idProduto', rota(async (req) => {
  const r = await consultar('DELETE FROM item_pedido WHERE id_pedido = ? AND id_produto = ?',
    [req.params.id, req.params.idProduto]);
  return { removidos: r.affectedRows };
}));

app.post('/api/pedidos/:id/finalizar', rota(async (req) => {
  await consultar('CALL sp_finalizar_pedido(?)', [req.params.id]);
  // Devolve o pedido já finalizado (desconto e total gravados pelo banco)
  const [pedido] = await consultar(
    'SELECT * FROM vw_pedidos_detalhados WHERE id_pedido = ?', [req.params.id]);
  return pedido;
}));

// ------------------------------- Gerência ----------------------------
app.get('/api/repor', rota(() =>
  consultar('SELECT * FROM vw_produtos_para_repor ORDER BY faltam DESC, produto')));

app.get('/api/vendas', rota(() =>
  consultar('SELECT * FROM vw_vendas_por_categoria ORDER BY faturamento DESC')));

app.post('/api/reajuste', rota(async (req) => {
  const { id_categoria, percentual } = req.body;
  await consultar('CALL sp_reajustar_precos_categoria(?, ?)', [id_categoria, percentual]);
  return { ok: true };
}));

app.get('/api/historico', rota(() =>
  consultar(`SELECT h.id_historico, h.id_produto, p.nome AS produto,
                    h.preco_antigo, h.preco_novo, h.data_alteracao, h.usuario
               FROM historico_preco h
               JOIN produto p ON p.id_produto = h.id_produto
              ORDER BY h.id_historico DESC`)));

// ------------------------------- Inicialização -----------------------
const PORTA = Number(process.env.PORT || 3000);
app.listen(PORTA, '0.0.0.0', () => {
  console.log('\n  Grão da Serra no ar!');
  console.log(`  Neste computador:  http://localhost:${PORTA}`);
  // Endereços para abrir no celular (mesma rede Wi-Fi)
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const end of lista || []) {
      if (end.family === 'IPv4' && !end.internal) {
        console.log(`  Na rede (celular): http://${end.address}:${PORTA}`);
      }
    }
  }
  console.log('');
});
