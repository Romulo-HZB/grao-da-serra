// =====================================================================
// api.js — MÓDULO ÚNICO DE ACESSO A DADOS
//
// Toda comunicação da interface com o banco passa por este arquivo.
// Cada função chama uma rota do servidor intermediário (server/server.js),
// que executa um SELECT em uma view ou um CALL em uma procedure.
// As funções devolvem os dados com os mesmos nomes de colunas do banco.
// =====================================================================

const API = (() => {
  // Faz a requisição e devolve o JSON. Se o banco recusar a operação
  // (SIGNAL nas procedures/triggers), lança um Error com a mensagem
  // em português, que a interface exibe na área de mensagens.
  async function requisitar(url, metodo = 'GET', corpo) {
    let resposta;
    try {
      resposta = await fetch(url, {
        method: metodo,
        headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
        body: corpo ? JSON.stringify(corpo) : undefined
      });
    } catch {
      throw new Error('Sem comunicação com o servidor. Verifique se ele está ligado.');
    }
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || 'Erro inesperado no servidor.');
    return dados;
  }

  return {
    // ---- Cardápio: SELECT * FROM vw_cardapio
    // colunas: id_produto, categoria, produto, preco, situacao
    listarCardapio: () => requisitar('/api/cardapio'),

    // ---- Cadastros de apoio
    listarClientes: () => requisitar('/api/clientes'),          // id_cliente, nome, cpf
    listarFuncionarios: () => requisitar('/api/funcionarios'),  // id_funcionario, nome, cargo
    listarCategorias: () => requisitar('/api/categorias'),      // id_categoria, nome

    // ---- CALL sp_abrir_pedido(cliente, funcionario, @id) -> { id_pedido }
    abrirPedido: (idCliente, idFuncionario) =>
      requisitar('/api/pedidos', 'POST', { id_cliente: idCliente, id_funcionario: idFuncionario }),

    // ---- CALL sp_adicionar_item(pedido, produto, quantidade)
    adicionarItem: (idPedido, idProduto, quantidade) =>
      requisitar(`/api/pedidos/${idPedido}/itens`, 'POST', { id_produto: idProduto, quantidade }),

    // ---- DELETE FROM item_pedido WHERE id_pedido = ? AND id_produto = ?
    removerItem: (idPedido, idProduto) =>
      requisitar(`/api/pedidos/${idPedido}/itens/${idProduto}`, 'DELETE'),

    // ---- CALL sp_finalizar_pedido(pedido) -> linha de vw_pedidos_detalhados
    finalizarPedido: (idPedido) =>
      requisitar(`/api/pedidos/${idPedido}/finalizar`, 'POST'),

    // ---- SELECT * FROM vw_pedidos_detalhados [WHERE status = ?]
    // colunas: id_pedido, data_pedido, status, cliente, atendente, qtd_itens,
    //          valor_bruto, desconto_percentual, valor_total
    listarPedidos: (status = '') =>
      requisitar('/api/pedidos' + (status ? `?status=${encodeURIComponent(status)}` : '')),

    // ---- Um pedido de vw_pedidos_detalhados e seus itens (vw_itens_pedido)
    obterPedido: (idPedido) => requisitar(`/api/pedidos/${idPedido}`),
    listarItensPedido: (idPedido) => requisitar(`/api/pedidos/${idPedido}/itens`),

    // ---- SELECT * FROM vw_produtos_para_repor
    // colunas: id_produto, produto, categoria, estoque, estoque_minimo, faltam
    listarProdutosParaRepor: () => requisitar('/api/repor'),

    // ---- SELECT * FROM vw_vendas_por_categoria
    // colunas: categoria, unidades, faturamento
    listarVendasPorCategoria: () => requisitar('/api/vendas'),

    // ---- CALL sp_reajustar_precos_categoria(categoria, percentual)
    reajustarPrecos: (idCategoria, percentual) =>
      requisitar('/api/reajuste', 'POST', { id_categoria: idCategoria, percentual }),

    // ---- SELECT ... FROM historico_preco
    // colunas: id_historico, id_produto, produto, preco_antigo, preco_novo,
    //          data_alteracao, usuario
    listarHistoricoPrecos: () => requisitar('/api/historico')
  };
})();
