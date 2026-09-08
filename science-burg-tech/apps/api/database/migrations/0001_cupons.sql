-- =============================================================================
-- MIGRAÇÃO 0001 — CUPONS
-- O único mecanismo que de fato muda o preço de um pedido (percentual ou
-- valor fixo). "Promoções" (migração 0002) só divulgam um cupom — não
-- descontam nada sozinhas.
-- =============================================================================

CREATE TABLE cupons (
  id                       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo                   TEXT NOT NULL UNIQUE,
  tipo_desconto            TEXT NOT NULL CHECK (tipo_desconto IN ('percentual', 'fixo')),
  valor                    DOUBLE PRECISION NOT NULL CHECK (valor > 0),
  valor_minimo_pedido      DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (valor_minimo_pedido >= 0),
  limite_uso_total         INTEGER CHECK (limite_uso_total > 0),
  limite_uso_por_usuario   INTEGER CHECK (limite_uso_por_usuario > 0),
  valido_de                TEXT,
  valido_ate               TEXT,
  ativo                    INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em                TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  atualizado_em            TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),

  -- Um cupom percentual acima de 100% não faz sentido (fixo não tem teto
  -- aqui de propósito — a API ainda garante que o desconto nunca deixa o
  -- pedido negativo, truncando o desconto no valor do subtotal).
  CHECK (tipo_desconto <> 'percentual' OR valor <= 100)
);

CREATE TRIGGER trg_cupons_atualizado
BEFORE UPDATE ON cupons
FOR EACH ROW EXECUTE FUNCTION tocar_atualizado_em();

CREATE INDEX idx_cupons_ativo ON cupons(ativo);


-- Um registro por pedido que usou cupom — é o que permite aplicar os
-- limites de uso (total e por cliente) sem precisar recontar nada na mão.
CREATE TABLE cupons_uso (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cupom_id    INTEGER NOT NULL REFERENCES cupons(id) ON DELETE CASCADE,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  pedido_id   INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  usado_em    TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),

  UNIQUE (pedido_id)
);

CREATE INDEX idx_cupons_uso_cupom ON cupons_uso(cupom_id);
CREATE INDEX idx_cupons_uso_usuario ON cupons_uso(usuario_id);


-- O pedido guarda qual cupom usou (se usou) e quanto foi descontado — o
-- "total" continua sendo subtotal + taxa_entrega, só que agora menos o
-- desconto. Guardar o valor do desconto (em vez de só o cupom_id) preserva
-- o histórico correto mesmo que o cupom seja editado ou apagado depois.
ALTER TABLE pedidos
  ADD COLUMN cupom_id INTEGER REFERENCES cupons(id) ON DELETE SET NULL,
  ADD COLUMN desconto DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (desconto >= 0);
