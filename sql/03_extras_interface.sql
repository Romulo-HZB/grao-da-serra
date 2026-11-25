-- =====================================================================
-- Empório & Café Grão da Serra
-- EXTRAS para a interface (Questão 16) — não fazem parte das questões 1-15
-- Pré-requisito: 01_criacao_banco.sql e 02_solucoes.sql já executados.
-- =====================================================================

USE grao_da_serra;

-- ---------------------------------------------------------------------
-- vw_itens_pedido
-- A tela "Novo pedido" precisa listar os itens do pedido em andamento.
-- Assim a interface não faz JOIN nem calcula subtotal: só faz SELECT.
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
-- mudaria o valor bruto de um registro financeiro já encerrado.
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

-- ---------------------------------------------------------------------
-- Usuário de banco usado pelo servidor da interface.
-- Ele só enxerga o que a interface precisa: views, procedures e as
-- tabelas de apoio (clientes, funcionários, categorias, histórico).
-- ---------------------------------------------------------------------
DROP USER IF EXISTS 'grao_app'@'localhost';
CREATE USER 'grao_app'@'localhost' IDENTIFIED BY 'grao123';

GRANT SELECT ON grao_da_serra.vw_cardapio             TO 'grao_app'@'localhost';
GRANT SELECT ON grao_da_serra.vw_pedidos_detalhados   TO 'grao_app'@'localhost';
GRANT SELECT ON grao_da_serra.vw_produtos_para_repor  TO 'grao_app'@'localhost';
GRANT SELECT ON grao_da_serra.vw_vendas_por_categoria TO 'grao_app'@'localhost';
GRANT SELECT ON grao_da_serra.vw_itens_pedido         TO 'grao_app'@'localhost';
GRANT SELECT ON grao_da_serra.cliente                 TO 'grao_app'@'localhost';
GRANT SELECT ON grao_da_serra.funcionario             TO 'grao_app'@'localhost';
GRANT SELECT ON grao_da_serra.categoria               TO 'grao_app'@'localhost';
GRANT SELECT ON grao_da_serra.historico_preco         TO 'grao_app'@'localhost';
GRANT SELECT, DELETE ON grao_da_serra.item_pedido     TO 'grao_app'@'localhost';
GRANT EXECUTE ON grao_da_serra.*                      TO 'grao_app'@'localhost';
-- O histórico mostra o nome do produto: liberamos só as colunas id e nome
-- (estoque e preço continuam acessíveis apenas pelas views).
GRANT SELECT (id_produto, nome) ON grao_da_serra.produto TO 'grao_app'@'localhost';
