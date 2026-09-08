-- =============================================================================
-- BURGER TECH — ESTRUTURA DO BANCO DE DADOS
-- Motor: PostgreSQL (Neon)
--
-- Migrado do schema original em SQLite (mantido em schema.sqlite.sql.bak,
-- lá tem os comentários mais longos sobre o "porquê" de cada tabela — este
-- arquivo comenta principalmente o que muda de motor pra motor).
--
-- Regras preservadas 1:1 da versão SQLite, sem exceção:
--   - índice único parcial que impede duas comandas abertas na mesma mesa;
--   - os triggers que ocupam/liberam a mesa sozinhos;
--   - todos os CHECK constraints (tipo de pedido, papel do administrador,
--     status de pedido/comanda/pagamento, etc.).
--
-- Diferente do SQLite, o Postgres aplica chave estrangeira sempre — não
-- existe equivalente a "PRAGMA foreign_keys = ON" aqui, então essa linha
-- não tem mais razão de existir (o db.py também não roda mais isso).
--
-- As colunas de data (*_em) continuam como TEXT no formato
-- "AAAA-MM-DD HH:MM:SS" (hora UTC), de propósito — é o mesmo formato que o
-- SQLite sempre devolveu, então nenhuma linha de Python ou TypeScript que
-- já lida com essas colunas precisou mudar por causa da troca de banco.
--
-- Valores monetários (preco, subtotal, total, taxa_entrega, valor) usam
-- DOUBLE PRECISION, não NUMERIC: a coluna era "NUMERIC" também no SQLite,
-- mas lá isso é só afinidade de tipo — o valor guardado e devolvido pelo
-- driver sempre foi float. O NUMERIC do Postgres é decimal de precisão
-- arbitrária de verdade, e o psycopg devolve isso como decimal.Decimal em
-- Python — incompatível com o resto do código (que soma esses valores com
-- float comum). DOUBLE PRECISION reproduz o comportamento float original.
-- =============================================================================


-- =============================================================================
-- 1. USUÁRIOS
-- =============================================================================
CREATE TABLE usuarios (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  senha_hash     TEXT NOT NULL,
  telefone       TEXT,
  criado_em      TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  atualizado_em  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

-- Função genérica reaproveitada por todo trigger "atualizado_em" deste
-- arquivo — no SQLite cada tabela tinha o seu próprio trigger repetindo a
-- mesma lógica; aqui vira uma função só, com um BEFORE UPDATE por tabela.
CREATE FUNCTION tocar_atualizado_em() RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_atualizado
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION tocar_atualizado_em();


-- =============================================================================
-- 1b. ADMINISTRADORES  ★ login de administração
-- =============================================================================
CREATE TABLE administradores (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  senha_hash     TEXT NOT NULL,
  papel          TEXT NOT NULL DEFAULT 'atendente'
                 CHECK (papel IN ('admin', 'atendente')),
  ativo          INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em      TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  atualizado_em  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TRIGGER trg_administradores_atualizado
BEFORE UPDATE ON administradores
FOR EACH ROW EXECUTE FUNCTION tocar_atualizado_em();

-- NÃO insira um administrador aqui no seed com senha de exemplo — crie o
-- primeiro admin com "python -m app.criar_admin".


-- =============================================================================
-- 1c. SESSÕES DE ADMINISTRADOR
-- =============================================================================
CREATE TABLE sessoes_administrador (
  id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  administrador_id  INTEGER NOT NULL REFERENCES administradores(id) ON DELETE CASCADE,
  token_hash        TEXT NOT NULL UNIQUE,
  criado_em         TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  expira_em         TEXT NOT NULL,
  revogado_em       TEXT
);

CREATE INDEX idx_sessoes_administrador ON sessoes_administrador(administrador_id);


-- =============================================================================
-- 2. ENDEREÇOS
-- =============================================================================
CREATE TABLE enderecos (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rua            TEXT NOT NULL,
  numero         TEXT NOT NULL,
  complemento    TEXT,
  bairro         TEXT NOT NULL,
  cidade         TEXT NOT NULL,
  estado         TEXT NOT NULL,
  cep            TEXT NOT NULL,
  padrao         INTEGER NOT NULL DEFAULT 0 CHECK (padrao IN (0, 1)),
  criado_em      TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE INDEX idx_enderecos_usuario ON enderecos(usuario_id);


-- =============================================================================
-- 3. CATEGORIAS
-- =============================================================================
CREATE TABLE categorias (
  id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug   TEXT NOT NULL UNIQUE
         CHECK (slug IN ('hamburguer', 'acompanhamento', 'bebida', 'sobremesa')),
  nome   TEXT NOT NULL,
  emoji  TEXT,
  ordem  INTEGER NOT NULL DEFAULT 0
);


-- =============================================================================
-- 4. PRODUTOS
-- =============================================================================
CREATE TABLE produtos (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  categoria_id   INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  nome           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  descricao      TEXT,
  preco          DOUBLE PRECISION NOT NULL CHECK (preco >= 0),
  calorias       INTEGER CHECK (calorias >= 0),
  imagem_url     TEXT,
  tag            TEXT,
  cor_badge      TEXT,
  disponivel     INTEGER NOT NULL DEFAULT 1 CHECK (disponivel IN (0, 1)),
  criado_em      TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  atualizado_em  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX idx_produtos_disponivel ON produtos(disponivel);

CREATE TRIGGER trg_produtos_atualizado
BEFORE UPDATE ON produtos
FOR EACH ROW EXECUTE FUNCTION tocar_atualizado_em();


-- =============================================================================
-- 5. MESAS  ★ sistema de mesas
-- =============================================================================
CREATE TABLE mesas (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero     INTEGER NOT NULL UNIQUE,
  capacidade INTEGER NOT NULL CHECK (capacidade > 0),
  status     TEXT NOT NULL DEFAULT 'livre'
             CHECK (status IN ('livre', 'ocupada', 'reservada', 'inativa')),
  qr_token   TEXT UNIQUE,
  criado_em  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);


-- =============================================================================
-- 6. COMANDAS  ★ sistema de mesas
-- =============================================================================
CREATE TABLE comandas (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mesa_id          INTEGER NOT NULL REFERENCES mesas(id) ON DELETE RESTRICT,
  usuario_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  aberta_por       INTEGER REFERENCES administradores(id) ON DELETE SET NULL,
  numero_pessoas   INTEGER CHECK (numero_pessoas > 0),
  status           TEXT NOT NULL DEFAULT 'aberta'
                   CHECK (status IN ('aberta', 'fechada', 'paga', 'cancelada')),
  aberta_em        TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  fechada_em       TEXT
);

CREATE INDEX idx_comandas_mesa ON comandas(mesa_id);

-- Regra de negócio: uma mesa não pode ter duas comandas abertas ao mesmo
-- tempo. Sintaxe idêntica à do SQLite — índice único parcial é suportado
-- nativamente pelos dois motores (o motivo de ter escolhido Postgres em
-- vez de MySQL pra essa migração: o MySQL não tem esse recurso).
CREATE UNIQUE INDEX idx_comanda_unica_aberta_por_mesa
  ON comandas(mesa_id) WHERE status = 'aberta';

CREATE FUNCTION comanda_aberta_ocupa_mesa() RETURNS TRIGGER AS $$
BEGIN
  UPDATE mesas SET status = 'ocupada' WHERE id = NEW.mesa_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Quando uma comanda é aberta, a mesa passa automaticamente para "ocupada"
CREATE TRIGGER trg_comanda_aberta_ocupa_mesa
AFTER INSERT ON comandas
FOR EACH ROW WHEN (NEW.status = 'aberta')
EXECUTE FUNCTION comanda_aberta_ocupa_mesa();

CREATE FUNCTION comanda_encerrada_libera_mesa() RETURNS TRIGGER AS $$
BEGIN
  UPDATE mesas SET status = 'livre' WHERE id = NEW.mesa_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Quando a comanda é fechada/paga/cancelada, a mesa volta a ficar "livre"
CREATE TRIGGER trg_comanda_encerrada_libera_mesa
AFTER UPDATE OF status ON comandas
FOR EACH ROW WHEN (NEW.status IN ('fechada', 'paga', 'cancelada'))
EXECUTE FUNCTION comanda_encerrada_libera_mesa();


-- =============================================================================
-- 7. CARRINHOS e ITENS DO CARRINHO
-- =============================================================================
CREATE TABLE carrinhos (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id     INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  sessao_id      TEXT,
  criado_em      TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  atualizado_em  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),

  CHECK (usuario_id IS NOT NULL OR sessao_id IS NOT NULL)
);

CREATE UNIQUE INDEX idx_carrinho_usuario ON carrinhos(usuario_id) WHERE usuario_id IS NOT NULL;
CREATE UNIQUE INDEX idx_carrinho_sessao ON carrinhos(sessao_id) WHERE sessao_id IS NOT NULL;

CREATE TRIGGER trg_carrinhos_atualizado
BEFORE UPDATE ON carrinhos
FOR EACH ROW EXECUTE FUNCTION tocar_atualizado_em();

CREATE TABLE itens_carrinho (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  carrinho_id  INTEGER NOT NULL REFERENCES carrinhos(id) ON DELETE CASCADE,
  produto_id   INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade   INTEGER NOT NULL CHECK (quantidade > 0),
  criado_em    TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),

  UNIQUE (carrinho_id, produto_id)
);

CREATE INDEX idx_itens_carrinho_carrinho ON itens_carrinho(carrinho_id);


-- =============================================================================
-- 8. PEDIDOS
-- =============================================================================
CREATE TABLE pedidos (
  id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id        INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
  tipo              TEXT NOT NULL DEFAULT 'entrega'
                    CHECK (tipo IN ('entrega', 'retirada', 'local')),
  endereco_id       INTEGER REFERENCES enderecos(id) ON DELETE RESTRICT,
  comanda_id        INTEGER REFERENCES comandas(id) ON DELETE RESTRICT,
  status            TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN (
                      'pendente', 'confirmado', 'em_preparo',
                      'saiu_para_entrega', 'pronto', 'entregue', 'cancelado'
                    )),
  metodo_pagamento  TEXT,
  subtotal          DOUBLE PRECISION NOT NULL CHECK (subtotal >= 0),
  taxa_entrega      DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (taxa_entrega >= 0),
  total             DOUBLE PRECISION NOT NULL CHECK (total >= 0),
  observacoes       TEXT,
  criado_em         TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  atualizado_em     TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),

  CHECK (
    (tipo = 'entrega'  AND endereco_id IS NOT NULL AND comanda_id IS NULL) OR
    (tipo = 'local'    AND comanda_id  IS NOT NULL AND endereco_id IS NULL) OR
    (tipo = 'retirada' AND endereco_id IS NULL     AND comanda_id  IS NULL)
  )
);

CREATE INDEX idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_comanda ON pedidos(comanda_id);

CREATE TRIGGER trg_pedidos_atualizado
BEFORE UPDATE ON pedidos
FOR EACH ROW EXECUTE FUNCTION tocar_atualizado_em();


-- =============================================================================
-- 9. ITENS DO PEDIDO
-- =============================================================================
CREATE TABLE itens_pedido (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pedido_id        INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id       INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
  nome_produto     TEXT NOT NULL,
  preco_unitario   DOUBLE PRECISION NOT NULL CHECK (preco_unitario >= 0),
  quantidade       INTEGER NOT NULL CHECK (quantidade > 0),
  subtotal         DOUBLE PRECISION NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX idx_itens_pedido_pedido ON itens_pedido(pedido_id);


-- =============================================================================
-- 10. PAGAMENTOS
-- =============================================================================
CREATE TABLE pagamentos (
  id                     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pedido_id              INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
  comanda_id             INTEGER REFERENCES comandas(id) ON DELETE CASCADE,
  metodo                 TEXT NOT NULL
                         CHECK (metodo IN ('cartao_credito', 'cartao_debito', 'pix', 'dinheiro')),
  status                 TEXT NOT NULL DEFAULT 'pendente'
                         CHECK (status IN ('pendente', 'aprovado', 'recusado', 'estornado')),
  valor                  DOUBLE PRECISION NOT NULL CHECK (valor >= 0),
  transacao_externa_id   TEXT,
  pago_em                TEXT,
  criado_em              TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),

  CHECK (
    (pedido_id IS NOT NULL AND comanda_id IS NULL) OR
    (pedido_id IS NULL AND comanda_id IS NOT NULL)
  )
);

CREATE INDEX idx_pagamentos_pedido ON pagamentos(pedido_id);
CREATE INDEX idx_pagamentos_comanda ON pagamentos(comanda_id);


-- =============================================================================
-- DADOS INICIAIS (SEED)
-- =============================================================================

INSERT INTO categorias (slug, nome, emoji, ordem) VALUES
  ('hamburguer',      'Hambúrgueres',      '🍔', 1),
  ('acompanhamento',  'Acompanhamentos',   '🍟', 2),
  ('bebida',          'Bebidas',           '🧃', 3),
  ('sobremesa',       'Sobremesas',        '🍦', 4);

-- Hambúrgueres
INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'GitHub Burger', 'github-burger',
  'Duas carnes ''commitadas'', queijo cheddar fundido na branch principal e molho open-source. O clássico que controla a versão da sua fome.',
  32.90, 720, 'MAIS PEDIDO', 'bg-primary'
FROM categorias WHERE slug = 'hamburguer';

INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'JavaScript Burger', 'javascript-burger',
  'Lanche dinâmico, servido de forma assíncrona, com bacon crocante e cebola caramelizada. await o sabor chegar.',
  29.90, 680, 'NOVO', 'bg-blue-500'
FROM categorias WHERE slug = 'hamburguer';

INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'HTML Burger', 'html-burger',
  'A base de tudo. Pão brioche, carne grelhada, alface, tomate e queijo prato. Estruturado desde a primeira camada.',
  24.90, 590, NULL, NULL
FROM categorias WHERE slug = 'hamburguer';

INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'CSS Burger', 'css-burger',
  'Bonito por fora, estilizado por dentro. Molho rosé, rúcula selvagem e queijo brie. display: flex de sabor.',
  27.90, 640, NULL, NULL
FROM categorias WHERE slug = 'hamburguer';

INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'C++ Burger', 'cpp-burger',
  'Compilado na brasa com jalapeño, queijo gouda e aioli de alho negro. Performance máxima, zero garbage.',
  34.90, 780, 'PICANTE 🌶', 'bg-red-600'
FROM categorias WHERE slug = 'hamburguer';

INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'Python Burger', 'python-burger',
  'Frango grelhado, pesto de manjericão e ricota temperada. Simples, poderoso e gostoso de ler.',
  28.90, 520, 'LEVE', 'bg-green-600'
FROM categorias WHERE slug = 'hamburguer';

-- Acompanhamentos
INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'Cache de Batatas', 'cache-de-batatas',
  'Batatas fritas crocantes carregadas em memória. Sal defumado e páprica. Hit rate: 100%.',
  12.90, 340, 'CLÁSSICO', NULL
FROM categorias WHERE slug = 'acompanhamento';

INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'Overflow de Anéis', 'overflow-de-aneis',
  'Anéis de cebola empilhados além do buffer. Crocantes, dourados, com molho de imersão especial.',
  14.90, 410, NULL, NULL
FROM categorias WHERE slug = 'acompanhamento';

INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'Stack de Nuggets', 'stack-de-nuggets',
  '8 nuggets artesanais na call stack. Frango 100% natural. Pop() um por um.',
  16.90, 480, NULL, NULL
FROM categorias WHERE slug = 'acompanhamento';

-- Bebidas
INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'Blue Screen of Death', 'blue-screen-of-death',
  'Limonada azul elétrica com blue curaçao, menta e espuma cítrica. Crash de tanto refrescar.',
  11.90, 180, 'ESPECIAL', NULL
FROM categorias WHERE slug = 'bebida';

INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'Null Pointer', 'null-pointer',
  'Água com gás artesanal, limão siciliano e ervas finas. Minimalista. Zero exception de sabor.',
  7.90, 30, NULL, NULL
FROM categorias WHERE slug = 'bebida';

INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'Dark Mode', 'dark-mode',
  'Café gelado com creme de baunilha e calda de chocolate amargo. Para quem só trabalha no escuro.',
  13.90, 220, 'FAVORITO', NULL
FROM categorias WHERE slug = 'bebida';

-- Sobremesas
INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'Cookie Overflow', 'cookie-overflow',
  'Cookie duplo de chocolate com Nutella transbordando além do buffer. Stack de satisfação.',
  10.90, 520, 'NOVO', NULL
FROM categorias WHERE slug = 'sobremesa';

INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'Ice Cream Compiler', 'ice-cream-compiler',
  'Sorvete artesanal compilado em 3 sabores: chocolate, baunilha e caramelo salgado.',
  12.90, 380, NULL, NULL
FROM categorias WHERE slug = 'sobremesa';

-- Mesas de exemplo (ajuste números/capacidades para o salão real da loja)
INSERT INTO mesas (numero, capacidade, qr_token) VALUES
  (1, 2, 'mesa-01-a1b2c3'),
  (2, 2, 'mesa-02-a1b2c4'),
  (3, 4, 'mesa-03-a1b2c5'),
  (4, 4, 'mesa-04-a1b2c6'),
  (5, 4, 'mesa-05-a1b2c7'),
  (6, 6, 'mesa-06-a1b2c8'),
  (7, 6, 'mesa-07-a1b2c9'),
  (8, 8, 'mesa-08-a1b2d0');
