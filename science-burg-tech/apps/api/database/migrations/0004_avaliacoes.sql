-- =============================================================================
-- MIGRAÇÃO 0004 — AVALIAÇÕES
-- Um cliente pode avaliar a loja uma vez por pedido entregue (não uma vez
-- na vida) — por isso o UNIQUE é em pedido_id, não em usuario_id. Toda
-- avaliação nasce pendente ("aprovado = 0") e só aparece publicamente
-- depois que um administrador aprova.
-- =============================================================================

CREATE TABLE avaliacoes (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  pedido_id   INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  nota        INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario  TEXT,
  aprovado    INTEGER NOT NULL DEFAULT 0 CHECK (aprovado IN (0, 1)),
  criado_em   TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),

  UNIQUE (pedido_id)
);

CREATE INDEX idx_avaliacoes_usuario ON avaliacoes(usuario_id);
CREATE INDEX idx_avaliacoes_aprovado ON avaliacoes(aprovado);
