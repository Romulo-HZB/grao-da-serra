-- =====================================================================
-- Empório & Café Grão da Serra
-- SOLUÇÕES: Functions, Procedures, Views e Triggers (Questões 1 a 15)
-- MySQL 8
--
-- Pré-requisito: ter executado o script 01_criacao_banco.sql.
-- Este arquivo pode ser executado várias vezes: cada objeto é removido
-- (DROP ... IF EXISTS) antes de ser criado novamente.
-- =====================================================================

USE grao_da_serra;

-- =====================================================================
-- 5. FUNCTIONS
-- =====================================================================

DELIMITER $$

-- ---------------------------------------------------------------------
-- Questão 1 — fn_total_pedido
-- Soma quantidade × preco_unitario dos itens do pedido.
-- Pedido sem itens (ou inexistente) devolve 0, e não NULL.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_total_pedido $$
CREATE FUNCTION fn_total_pedido(p_id_pedido INT)
RETURNS DECIMAL(10,2)
READS SQL DATA
BEGIN
    DECLARE v_total DECIMAL(10,2);

    SELECT COALESCE(SUM(quantidade * preco_unitario), 0)
      INTO v_total
      FROM item_pedido
     WHERE id_pedido = p_id_pedido;

    RETURN v_total;
END $$

-- ---------------------------------------------------------------------
-- Questão 2 — fn_situacao_estoque
-- 'ESGOTADO' : estoque = 0
-- 'REPOR'    : 0 < estoque <= estoque_minimo
-- 'OK'       : demais casos
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_situacao_estoque $$
CREATE FUNCTION fn_situacao_estoque(p_id_produto INT)
RETURNS VARCHAR(10)
READS SQL DATA
BEGIN
    DECLARE v_estoque        INT;
    DECLARE v_estoque_minimo INT;

    SELECT estoque, estoque_minimo
      INTO v_estoque, v_estoque_minimo
      FROM produto
     WHERE id_produto = p_id_produto;

    -- Produto inexistente: não há situação a informar.
    IF v_estoque IS NULL THEN
        RETURN NULL;
    END IF;

    IF v_estoque <= 0 THEN
        RETURN 'ESGOTADO';
    ELSEIF v_estoque <= v_estoque_minimo THEN
        RETURN 'REPOR';
    ELSE
        RETURN 'OK';
    END IF;
END $$

-- ---------------------------------------------------------------------
-- Questão 3 — fn_desconto_fidelidade
-- 4 ou mais pedidos PAGOS -> 10% | 2 ou 3 -> 5% | menos de 2 -> 0%
-- Pedidos ABERTOS e CANCELADOS não contam.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_desconto_fidelidade $$
CREATE FUNCTION fn_desconto_fidelidade(p_id_cliente INT)
RETURNS DECIMAL(4,2)
READS SQL DATA
BEGIN
    DECLARE v_qtd_pagos INT;

    SELECT COUNT(*)
      INTO v_qtd_pagos
      FROM pedido
     WHERE id_cliente = p_id_cliente
       AND status = 'PAGO';

    IF v_qtd_pagos >= 4 THEN
        RETURN 10.00;
    ELSEIF v_qtd_pagos >= 2 THEN
        RETURN 5.00;
    ELSE
        RETURN 0.00;
    END IF;
END $$

-- =====================================================================
-- 6. PROCEDURES
-- =====================================================================

-- ---------------------------------------------------------------------
-- Questão 4 — sp_abrir_pedido
-- Cria um pedido ABERTO (data e status com os valores padrão) e devolve
-- o número gerado no parâmetro OUT.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_abrir_pedido $$
CREATE PROCEDURE sp_abrir_pedido(
    IN  p_id_cliente     INT,
    IN  p_id_funcionario INT,
    OUT p_id_pedido      INT
)
BEGIN
    -- Validações com mensagens em português (em vez do erro de FK em inglês)
    IF NOT EXISTS (SELECT 1 FROM cliente WHERE id_cliente = p_id_cliente) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cliente não encontrado. Selecione um cliente cadastrado.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM funcionario WHERE id_funcionario = p_id_funcionario) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Funcionário não encontrado. Selecione um funcionário cadastrado.';
    END IF;

    INSERT INTO pedido (id_cliente, id_funcionario)
    VALUES (p_id_cliente, p_id_funcionario);

    SET p_id_pedido = LAST_INSERT_ID();
END $$

-- ---------------------------------------------------------------------
-- Questão 5 — sp_adicionar_item
-- Valida e insere o item. O preço vem SEMPRE da tabela produto.
-- A baixa do estoque é feita pelo trigger trg_item_baixa_estoque (Q12).
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_adicionar_item $$
CREATE PROCEDURE sp_adicionar_item(
    IN p_id_pedido  INT,
    IN p_id_produto INT,
    IN p_quantidade INT
)
BEGIN
    DECLARE v_status  VARCHAR(10);
    DECLARE v_ativo   BOOLEAN;
    DECLARE v_estoque INT;
    DECLARE v_preco   DECIMAL(8,2);

    -- 1) O pedido precisa existir e estar ABERTO
    SELECT status INTO v_status
      FROM pedido
     WHERE id_pedido = p_id_pedido;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pedido não encontrado.';
    END IF;

    IF v_status <> 'ABERTO' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Não é possível adicionar itens: o pedido não está ABERTO (já foi pago ou cancelado).';
    END IF;

    -- 2) O produto precisa existir e estar ativo
    SELECT ativo, estoque, preco
      INTO v_ativo, v_estoque, v_preco
      FROM produto
     WHERE id_produto = p_id_produto;

    IF v_ativo IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Produto não encontrado.';
    END IF;

    IF v_ativo = FALSE THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Produto inativo: ele está fora do cardápio e não pode ser vendido.';
    END IF;

    -- 3) A quantidade precisa ser maior que zero
    IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Quantidade inválida: informe um valor maior que zero.';
    END IF;

    -- 4) Precisa haver estoque suficiente
    IF v_estoque < p_quantidade THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Estoque insuficiente para a quantidade pedida.';
    END IF;

    -- (o item_pedido tem PK composta: o mesmo produto não pode entrar duas vezes)
    IF EXISTS (SELECT 1 FROM item_pedido
                WHERE id_pedido = p_id_pedido AND id_produto = p_id_produto) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Este produto já está no pedido. Remova o item e adicione novamente com a quantidade total.';
    END IF;

    -- Passou por todas as validações: insere com o preço ATUAL do produto
    INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario)
    VALUES (p_id_pedido, p_id_produto, p_quantidade, v_preco);
END $$

-- ---------------------------------------------------------------------
-- Questão 6 — sp_finalizar_pedido
-- Calcula o valor (fn_total_pedido), aplica o desconto de fidelidade
-- (fn_desconto_fidelidade) e marca o pedido como PAGO, tudo de uma vez.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_finalizar_pedido $$
CREATE PROCEDURE sp_finalizar_pedido(IN p_id_pedido INT)
BEGIN
    DECLARE v_status     VARCHAR(10);
    DECLARE v_id_cliente INT;
    DECLARE v_bruto      DECIMAL(10,2);
    DECLARE v_desconto   DECIMAL(4,2);

    SELECT status, id_cliente
      INTO v_status, v_id_cliente
      FROM pedido
     WHERE id_pedido = p_id_pedido;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pedido não encontrado.';
    END IF;

    IF v_status <> 'ABERTO' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Somente pedidos ABERTOS podem ser finalizados.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM item_pedido WHERE id_pedido = p_id_pedido) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Não é possível finalizar um pedido sem itens.';
    END IF;

    -- Reaproveitamento das functions das questões 1 e 3
    SET v_bruto    = fn_total_pedido(p_id_pedido);
    SET v_desconto = fn_desconto_fidelidade(v_id_cliente);

    UPDATE pedido
       SET desconto_percentual = v_desconto,
           valor_total         = ROUND(v_bruto * (1 - v_desconto / 100), 2),
           status              = 'PAGO'
     WHERE id_pedido = p_id_pedido;
END $$

-- ---------------------------------------------------------------------
-- Questão 7 — sp_reajustar_precos_categoria
-- Aplica um percentual (positivo = aumento, negativo = redução) a todos
-- os produtos da categoria. Cada alteração gera histórico pelo trigger
-- trg_produto_historico_preco (Q14).
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_reajustar_precos_categoria $$
CREATE PROCEDURE sp_reajustar_precos_categoria(
    IN p_id_categoria INT,
    IN p_percentual   DECIMAL(5,2)
)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM categoria WHERE id_categoria = p_id_categoria) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Categoria não encontrada.';
    END IF;

    IF p_percentual IS NULL OR p_percentual <= -100 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Percentual inválido: ele deve ser maior que -100.';
    END IF;

    UPDATE produto
       SET preco = ROUND(preco * (1 + p_percentual / 100), 2)
     WHERE id_categoria = p_id_categoria;
END $$

DELIMITER ;

-- =====================================================================
-- 7. VIEWS
-- =====================================================================

-- ---------------------------------------------------------------------
-- Questão 8 — vw_cardapio
-- Somente produtos ativos; não expõe estoque nem estoque mínimo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_cardapio AS
SELECT p.id_produto,
       c.nome                            AS categoria,
       p.nome                            AS produto,
       p.preco,
       fn_situacao_estoque(p.id_produto) AS situacao
  FROM produto p
  JOIN categoria c ON c.id_categoria = p.id_categoria
 WHERE p.ativo = TRUE;

-- ---------------------------------------------------------------------
-- Questão 9 — vw_pedidos_detalhados
-- Uma linha por pedido (inclusive pedidos sem itens, com qtd_itens = 0).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_pedidos_detalhados AS
SELECT pe.id_pedido,
       pe.data_pedido,
       pe.status,
       c.nome                         AS cliente,
       f.nome                         AS atendente,
       (SELECT COUNT(*)
          FROM item_pedido i
         WHERE i.id_pedido = pe.id_pedido) AS qtd_itens,
       fn_total_pedido(pe.id_pedido)  AS valor_bruto,
       pe.desconto_percentual,
       pe.valor_total
  FROM pedido pe
  JOIN cliente     c ON c.id_cliente     = pe.id_cliente
  JOIN funcionario f ON f.id_funcionario = pe.id_funcionario;

-- ---------------------------------------------------------------------
-- Questão 10 — vw_produtos_para_repor
-- Produtos ativos com estoque <= estoque mínimo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_produtos_para_repor AS
SELECT p.id_produto,
       p.nome                        AS produto,
       c.nome                        AS categoria,
       p.estoque,
       p.estoque_minimo,
       p.estoque_minimo - p.estoque  AS faltam
  FROM produto p
  JOIN categoria c ON c.id_categoria = p.id_categoria
 WHERE p.ativo = TRUE
   AND p.estoque <= p.estoque_minimo;

-- ---------------------------------------------------------------------
-- Questão 11 — vw_vendas_por_categoria
-- Considera somente itens de pedidos PAGOS. Categorias sem vendas
-- aparecem com zero (LEFT JOIN + COALESCE).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_vendas_por_categoria AS
SELECT c.nome                                                  AS categoria,
       COALESCE(SUM(v.quantidade), 0)                          AS unidades,
       COALESCE(SUM(v.quantidade * v.preco_unitario), 0.00)    AS faturamento
  FROM categoria c
  LEFT JOIN produto p
         ON p.id_categoria = c.id_categoria
  LEFT JOIN (SELECT i.id_produto, i.quantidade, i.preco_unitario
               FROM item_pedido i
               JOIN pedido pe ON pe.id_pedido = i.id_pedido
              WHERE pe.status = 'PAGO') v
         ON v.id_produto = p.id_produto
 GROUP BY c.id_categoria, c.nome;

-- =====================================================================
-- 8. TRIGGERS
-- =====================================================================

DELIMITER $$

-- ---------------------------------------------------------------------
-- Questão 12 — trg_item_baixa_estoque
-- Vendeu, baixou: ao inserir um item, subtrai a quantidade do estoque.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_item_baixa_estoque $$
CREATE TRIGGER trg_item_baixa_estoque
AFTER INSERT ON item_pedido
FOR EACH ROW
BEGIN
    UPDATE produto
       SET estoque = estoque - NEW.quantidade
     WHERE id_produto = NEW.id_produto;
END $$

-- ---------------------------------------------------------------------
-- Questão 13 — trg_item_devolve_estoque
-- Ao remover um item, devolve a quantidade ao estoque (usa OLD).
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_item_devolve_estoque $$
CREATE TRIGGER trg_item_devolve_estoque
AFTER DELETE ON item_pedido
FOR EACH ROW
BEGIN
    UPDATE produto
       SET estoque = estoque + OLD.quantidade
     WHERE id_produto = OLD.id_produto;
END $$

-- ---------------------------------------------------------------------
-- Questão 14 — trg_produto_historico_preco
-- Registra no histórico somente quando o PREÇO mudou de fato.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_produto_historico_preco $$
CREATE TRIGGER trg_produto_historico_preco
AFTER UPDATE ON produto
FOR EACH ROW
BEGIN
    IF NEW.preco <> OLD.preco THEN
        INSERT INTO historico_preco (id_produto, preco_antigo, preco_novo, usuario)
        VALUES (NEW.id_produto, OLD.preco, NEW.preco, CURRENT_USER());
    END IF;
END $$

-- ---------------------------------------------------------------------
-- Questão 15 — trg_pedido_bloqueia_alteracao
-- BEFORE UPDATE: impede qualquer alteração em pedidos PAGOS ou
-- CANCELADOS (olha o OLD.status, a situação antes da mudança).
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_pedido_bloqueia_alteracao $$
CREATE TRIGGER trg_pedido_bloqueia_alteracao
BEFORE UPDATE ON pedido
FOR EACH ROW
BEGIN
    IF OLD.status IN ('PAGO', 'CANCELADO') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pedido encerrado (PAGO ou CANCELADO) não pode ser alterado.';
    END IF;
END $$

DELIMITER ;
