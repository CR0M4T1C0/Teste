-- =============================================================================
-- MIGRAÇÃO 0002 — PROMOÇÕES
-- Conteúdo do banner de propaganda (home e cardápio). Não desconta nada
-- sozinha — só pode, opcionalmente, apontar para um cupom (migração 0001)
-- para anunciar "use tal código".
-- =============================================================================

CREATE TABLE promocoes (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titulo         TEXT NOT NULL,
  subtitulo      TEXT,
  imagem_url     TEXT NOT NULL,
  cupom_id       INTEGER REFERENCES cupons(id) ON DELETE SET NULL,
  ordem          INTEGER NOT NULL DEFAULT 0,
  ativo          INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  valido_de      TEXT,
  valido_ate     TEXT,
  criado_em      TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  atualizado_em  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TRIGGER trg_promocoes_atualizado
BEFORE UPDATE ON promocoes
FOR EACH ROW EXECUTE FUNCTION tocar_atualizado_em();

CREATE INDEX idx_promocoes_ativo ON promocoes(ativo);
CREATE INDEX idx_promocoes_cupom ON promocoes(cupom_id);
