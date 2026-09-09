-- =============================================================================
-- MIGRAÇÃO 0007 — IMAGENS NO BANCO
-- As fotos de produto eram gravadas no disco do contêiner e o banco guardava
-- só o caminho (/uploads/produtos/...). No Render o disco é efêmero: a cada
-- deploy ou hibernação ele é zerado, então o banco continuava apontando para
-- arquivos que já não existiam e o cardápio ficava sem imagem.
--
-- Guardar os bytes aqui resolve isso sem depender de serviço externo nem de
-- disco pago. Cabe porque o limite por arquivo é 5 MB e um cardápio tem
-- dezenas de fotos, não milhões — para um catálogo grande, o certo seria
-- armazenamento de objetos (S3/R2) com CDN na frente.
--
-- O id é um token aleatório, e não um número sequencial, porque ele aparece
-- na URL pública da imagem: sequencial deixaria qualquer visitante enumerar
-- todas as fotos, inclusive a de um produto ainda não publicado.
-- =============================================================================

CREATE TABLE imagens (
  id         TEXT PRIMARY KEY,
  mime       TEXT NOT NULL,
  conteudo   BYTEA NOT NULL,
  criado_em  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);
