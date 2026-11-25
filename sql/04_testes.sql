-- =====================================================================
-- Empório & Café Grão da Serra — ROTEIRO DE TESTES (questões 1 a 15)
-- Execute logo após 01_criacao_banco.sql e 02_solucoes.sql, na ordem.
-- Os comandos marcados com "ERRO ESPERADO" devem devolver a mensagem
-- em português. No Workbench, executem-nos um a um (Ctrl+Enter), pois
-- um erro interrompe a execução do script inteiro.
-- =====================================================================
USE grao_da_serra;

-- Q1: esperado 34.00 | 57.90 | 0.00
SELECT fn_total_pedido(1), fn_total_pedido(3), fn_total_pedido(99);

-- Q2: 5, 7, 13 = REPOR | 8, 15 = ESGOTADO | demais = OK
SELECT id_produto, nome, estoque, estoque_minimo, fn_situacao_estoque(id_produto) AS situacao
  FROM produto;

-- Q3: cliente 1 = 10 | cliente 2 = 5 | 3, 4, 5 = 0
SELECT id_cliente, nome, fn_desconto_fidelidade(id_cliente) AS desconto FROM cliente;

-- Views com os dados iniciais (antes de alterar qualquer coisa)
-- Q8: 14 linhas
SELECT * FROM vw_cardapio ORDER BY categoria, produto;
-- Q9: pedidos 9 (30.00) e 10 (27.00)
SELECT * FROM vw_pedidos_detalhados WHERE status = 'ABERTO';
-- Q10: produtos 5, 7, 8 e 13
SELECT * FROM vw_produtos_para_repor;
-- Q11: Cafés 8/66.50 | Bebidas 2/18.00 | Salgados 12/74.00 | Doces 5/43.50 | Empório 2/61.90
SELECT * FROM vw_vendas_por_categoria;

-- Q4: esperado 11, com status ABERTO
CALL sp_abrir_pedido(5, 1, @novo);
SELECT @novo;
SELECT * FROM pedido WHERE id_pedido = @novo;

-- Q5: deve funcionar
CALL sp_adicionar_item(@novo, 2, 2);
-- Q5: ERRO ESPERADO (pedido pago)
CALL sp_adicionar_item(1, 1, 1);
-- Q5: ERRO ESPERADO (produto inativo)
CALL sp_adicionar_item(@novo, 15, 1);
-- Q5: ERRO ESPERADO (sem estoque)
CALL sp_adicionar_item(@novo, 8, 1);
-- Q5: ERRO ESPERADO (quantidade inválida)
CALL sp_adicionar_item(@novo, 1, 0);

-- Q6: pedido 10 -> PAGO, desconto 5.00, total 25.65
CALL sp_finalizar_pedido(10);
-- Q6: pedido 9 -> desconto 0.00, total 30.00
CALL sp_finalizar_pedido(9);
SELECT id_pedido, status, desconto_percentual, valor_total FROM pedido WHERE id_pedido IN (9, 10);
-- Q6: ERRO ESPERADO (pedido já pago)
CALL sp_finalizar_pedido(10);

-- Q12: estoque do produto 9 diminui 1 (25 -> 24)
SELECT estoque FROM produto WHERE id_produto = 9;
CALL sp_adicionar_item(@novo, 9, 1);
SELECT estoque FROM produto WHERE id_produto = 9;

-- Q13: estoque do produto 9 volta (24 -> 25)
DELETE FROM item_pedido WHERE id_pedido = @novo AND id_produto = 9;
SELECT estoque FROM produto WHERE id_produto = 9;

-- Q7 + Q14: reajuste de 10% em Cafés -> 6.60 | 12.65 | 8.80 (gera 3 linhas no histórico)
CALL sp_reajustar_precos_categoria(1, 10);
SELECT id_produto, nome, preco FROM produto WHERE id_categoria = 1;
-- Q14: +5% -> mais 3 linhas no histórico
CALL sp_reajustar_precos_categoria(1, 5);
SELECT * FROM historico_preco;
-- Q14: alterar só o estoque NÃO gera histórico
UPDATE produto SET estoque = 199 WHERE id_produto = 1;
SELECT COUNT(*) AS linhas_historico FROM historico_preco;
-- Q7: ERRO ESPERADO (percentual inválido) e (categoria inexistente)
CALL sp_reajustar_precos_categoria(1, -100);
CALL sp_reajustar_precos_categoria(99, 10);

-- Q15: ERRO ESPERADO (pedido pago não pode ser alterado)
UPDATE pedido SET valor_total = 1 WHERE id_pedido = 1;
-- Q15: pedido aberto ainda pode ser finalizado
CALL sp_finalizar_pedido(@novo);
SELECT * FROM vw_pedidos_detalhados WHERE id_pedido = @novo;
