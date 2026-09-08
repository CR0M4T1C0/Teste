-- =============================================================================
-- MIGRAÇÃO 0003 — COMBOS
-- Um combo é um item vendável por preço próprio (normalmente mais barato do
-- que comprar os produtos avulsos) que junta produtos de categorias
-- diferentes. "combo_itens" descreve o que tem dentro, pra cozinha saber o
-- que preparar e o relatório continuar contando produto avulso e combo
-- separadamente.
--
-- Nota: "itens_carrinho"/"carrinhos" (tabelas 7 do schema.sql) não são
-- usadas por nenhuma rota da API hoje — o carrinho de verdade vive só no
-- front-end (useCart.ts), em memória. Por isso esta migração não mexe
-- nelas, só em "itens_pedido", que é a tabela que a API realmente usa.
-- =============================================================================

CREATE TABLE combos (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  descricao      TEXT,
  preco          DOUBLE PRECISION NOT NULL CHECK (preco >= 0),
  imagem_url     TEXT,
  disponivel     INTEGER NOT NULL DEFAULT 1 CHECK (disponivel IN (0, 1)),
  criado_em      TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  atualizado_em  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TRIGGER trg_combos_atualizado
BEFORE UPDATE ON combos
FOR EACH ROW EXECUTE FUNCTION tocar_atualizado_em();

CREATE INDEX idx_combos_disponivel ON combos(disponivel);


CREATE TABLE combo_itens (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  combo_id    INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  produto_id  INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade  INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),

  UNIQUE (combo_id, produto_id)
);

CREATE INDEX idx_combo_itens_combo ON combo_itens(combo_id);


-- Uma linha de pedido agora é OU um produto avulso OU um combo — o CHECK
-- só proíbe os dois ao mesmo tempo; os dois podem ficar NULL ao mesmo tempo
-- quando o produto/combo original é apagado depois (ON DELETE SET NULL),
-- igual já acontecia com produto_id sozinho antes desta migração.
ALTER TABLE itens_pedido
  ADD COLUMN combo_id INTEGER REFERENCES combos(id) ON DELETE SET NULL,
  ADD CONSTRAINT itens_pedido_produto_ou_combo CHECK (produto_id IS NULL OR combo_id IS NULL);

CREATE INDEX idx_itens_pedido_combo ON itens_pedido(combo_id);
