-- =====================================================================
-- Empório & Café Grão da Serra
-- EXTRAS usados pela interface (Questão 16) — não fazem parte das
-- questões 1 a 15.
-- Pré-requisito: 01_criacao_banco.sql e 02_solucoes.sql já executados.
-- =====================================================================

USE grao_da_serra;

-- ---------------------------------------------------------------------
-- vw_itens_pedido
-- A tela "Novo pedido" precisa listar os itens do pedido em andamento.
-- Com esta view o servidor só faz SELECT: o JOIN e o subtotal ficam
-- no banco, como o resto das regras.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_itens_pedido AS
SELECT i.id_pedido,
       i.id_produto,
       p.nome                          AS produto,
       i.quantidade,
       i.preco_unitario,
       i.quantidade * i.preco_unitario AS subtotal
  FROM item_pedido i
  JOIN produto p ON p.id_produto = i.id_produto;

-- ---------------------------------------------------------------------
-- trg_item_bloqueia_exclusao
-- Remover item só faz sentido em pedido ABERTO. Sem esta trava, um
-- DELETE em item de pedido PAGO devolveria estoque (trigger da Q13) e
-- deixaria o valor_total do pedido diferente dos itens.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_item_bloqueia_exclusao;

DELIMITER $$
CREATE TRIGGER trg_item_bloqueia_exclusao
BEFORE DELETE ON item_pedido
FOR EACH ROW
BEGIN
    IF (SELECT status FROM pedido WHERE id_pedido = OLD.id_pedido) <> 'ABERTO' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Só é possível remover itens de pedidos ABERTOS.';
    END IF;
END $$
DELIMITER ;
