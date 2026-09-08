-- =============================================================================
-- BURGER TECH — ESTRUTURA DO BANCO DE DADOS
-- Motor: SQLite 3
--
-- Este arquivo só cria o banco de dados. Nada aqui foi ligado ao
-- front-end (React) ainda — isso fica para uma próxima etapa.
--
-- IMPORTANTE: o SQLite só aplica as regras de chave estrangeira (FOREIGN
-- KEY) se a conexão pedir isso explicitamente. Sempre que o backend abrir
-- uma conexão com este banco, ele precisa rodar:
--     PRAGMA foreign_keys = ON;
-- Sem isso, o banco aceita, por exemplo, um pedido apontando para um
-- produto que não existe, sem reclamar.
-- =============================================================================

PRAGMA foreign_keys = ON;


-- =============================================================================
-- 1. USUÁRIOS
-- Só clientes (quem compra). É aqui que o LoginPage e o RegistoPage do
-- front-end público vão se conectar. A equipe da loja (administradores e
-- atendentes) fica numa tabela separada, a ADMINISTRADORES logo abaixo —
-- de propósito: são dois logins diferentes, para duas telas diferentes
-- (o site de delivery/mesas de um lado, o painel interno do outro), e
-- assim nunca existe risco de um endpoint de cliente devolver dado de
-- funcionário por engano.
-- =============================================================================
CREATE TABLE usuarios (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nome           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  senha_hash     TEXT NOT NULL,               -- nunca guardar a senha em texto puro, só o hash (ex.: bcrypt/passlib)
  telefone       TEXT,
  criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Mantém "atualizado_em" sempre em dia sozinho, sem o backend precisar lembrar disso
CREATE TRIGGER trg_usuarios_atualizado
AFTER UPDATE ON usuarios
BEGIN
  UPDATE usuarios SET atualizado_em = datetime('now') WHERE id = NEW.id;
END;


-- =============================================================================
-- 1b. ADMINISTRADORES  ★ login de administração
-- A equipe da loja: quem entra no painel interno (pedidos de todas as
-- mesas + delivery, gestão do cardápio, das mesas, etc.). "papel" separa
-- quem pode tudo ("admin") de quem só opera o salão no dia a dia
-- ("atendente") — a regra de quem pode ver/fazer o quê é decidida no
-- backend a partir desta coluna.
-- =============================================================================
CREATE TABLE administradores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nome           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  senha_hash     TEXT NOT NULL,
  papel          TEXT NOT NULL DEFAULT 'atendente'
                 CHECK (papel IN ('admin', 'atendente')),
  ativo          INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),  -- desativar em vez de apagar quando alguém sai da equipe
  criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER trg_administradores_atualizado
AFTER UPDATE ON administradores
BEGIN
  UPDATE administradores SET atualizado_em = datetime('now') WHERE id = NEW.id;
END;

-- NÃO insira um administrador aqui no seed com senha de exemplo — o hash
-- ficaria fixo e público no repositório. Crie o primeiro admin por um
-- script do próprio backend (ele gera o hash de verdade na hora).


-- =============================================================================
-- 1c. SESSÕES DE ADMINISTRADOR
-- Guarda os tokens de login da equipe (não dos clientes) para permitir
-- "deslogar de todo lugar" ou revogar o acesso de alguém na hora — algo
-- que um JWT sozinho, sem estado nenhum no banco, não permite fazer.
-- =============================================================================
CREATE TABLE sessoes_administrador (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  administrador_id  INTEGER NOT NULL REFERENCES administradores(id) ON DELETE CASCADE,
  token_hash        TEXT NOT NULL UNIQUE,   -- hash do refresh token, nunca o token em texto puro
  criado_em         TEXT NOT NULL DEFAULT (datetime('now')),
  expira_em         TEXT NOT NULL,
  revogado_em       TEXT
);

CREATE INDEX idx_sessoes_administrador ON sessoes_administrador(administrador_id);


-- =============================================================================
-- 2. ENDEREÇOS
-- Endereços de entrega de um cliente. Só é usado quando o pedido é do
-- tipo "entrega" (veja a tabela PEDIDOS lá embaixo).
-- =============================================================================
CREATE TABLE enderecos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rua            TEXT NOT NULL,
  numero         TEXT NOT NULL,
  complemento    TEXT,
  bairro         TEXT NOT NULL,
  cidade         TEXT NOT NULL,
  estado         TEXT NOT NULL,
  cep            TEXT NOT NULL,
  padrao         INTEGER NOT NULL DEFAULT 0 CHECK (padrao IN (0, 1)),  -- 1 = endereço padrão do cliente
  criado_em      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_enderecos_usuario ON enderecos(usuario_id);


-- =============================================================================
-- 3. CATEGORIAS
-- Corresponde ao tipo "Cat" e ao array "CATS" do arquivo src/app/types.ts
-- e src/app/data/menu.tsx do front-end.
-- =============================================================================
CREATE TABLE categorias (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  slug   TEXT NOT NULL UNIQUE
         CHECK (slug IN ('hamburguer', 'acompanhamento', 'bebida', 'sobremesa')),
  nome   TEXT NOT NULL,
  emoji  TEXT,
  ordem  INTEGER NOT NULL DEFAULT 0    -- ordem de exibição no cardápio
);


-- =============================================================================
-- 4. PRODUTOS
-- Corresponde ao tipo "Item" do front-end (src/app/types.ts). Cada linha
-- é um item do cardápio (hambúrguer, bebida, etc.).
-- =============================================================================
CREATE TABLE produtos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id   INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  nome           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  descricao      TEXT,
  preco          NUMERIC NOT NULL CHECK (preco >= 0),
  calorias       INTEGER CHECK (calorias >= 0),
  imagem_url     TEXT,
  tag            TEXT,                        -- selo tipo "NOVO", "MAIS PEDIDO" etc (pode ser nulo)
  cor_badge      TEXT,                         -- classe de cor do selo (ex.: "bg-primary")
  disponivel     INTEGER NOT NULL DEFAULT 1 CHECK (disponivel IN (0, 1)),  -- 0 = esgotado/fora do cardápio
  criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX idx_produtos_disponivel ON produtos(disponivel);

CREATE TRIGGER trg_produtos_atualizado
AFTER UPDATE ON produtos
BEGIN
  UPDATE produtos SET atualizado_em = datetime('now') WHERE id = NEW.id;
END;


-- =============================================================================
-- 5. MESAS  ★ sistema de mesas
-- Cada linha é uma mesa física da loja. O "status" é o que o pessoal do
-- salão vê em tempo real: livre, ocupada, reservada ou inativa
-- (ex.: mesa quebrada, fora de uso).
-- =============================================================================
CREATE TABLE mesas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  numero     INTEGER NOT NULL UNIQUE,          -- número impresso na mesa, ex.: "Mesa 7"
  capacidade INTEGER NOT NULL CHECK (capacidade > 0),  -- quantas pessoas sentam nela
  status     TEXT NOT NULL DEFAULT 'livre'
             CHECK (status IN ('livre', 'ocupada', 'reservada', 'inativa')),
  qr_token   TEXT UNIQUE,                      -- código único do QR code colado na mesa
  criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);


-- =============================================================================
-- 6. COMANDAS  ★ sistema de mesas
-- Isto é o "coração" do atendimento em mesa: representa UMA visita de um
-- cliente (ou de um grupo) a uma mesa, do momento em que ela é aberta até
-- o momento em que a conta é fechada e paga.
--
-- Por que uma tabela separada, e não só ligar o pedido direto na mesa?
-- Porque, num restaurante de verdade, o cliente costuma pedir em "rodadas"
-- (pede o hambúrguer, depois pede uma sobremesa, depois mais uma bebida).
-- A COMANDA é o "balde" que junta todos esses pedidos da mesma visita,
-- para fechar a conta uma vez só no final. Cada pedido feito durante a
-- visita vira uma linha em PEDIDOS apontando para essa comanda (veja
-- pedidos.comanda_id mais abaixo).
-- =============================================================================
CREATE TABLE comandas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  mesa_id          INTEGER NOT NULL REFERENCES mesas(id) ON DELETE RESTRICT,
  usuario_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,  -- cliente responsável, se ele estiver logado (pode ficar em branco)
  aberta_por       INTEGER REFERENCES administradores(id) ON DELETE SET NULL,  -- atendente responsável pela mesa nessa visita (opcional)
  numero_pessoas   INTEGER CHECK (numero_pessoas > 0),
  status           TEXT NOT NULL DEFAULT 'aberta'
                   CHECK (status IN ('aberta', 'fechada', 'paga', 'cancelada')),
  aberta_em        TEXT NOT NULL DEFAULT (datetime('now')),
  fechada_em       TEXT
);

CREATE INDEX idx_comandas_mesa ON comandas(mesa_id);

-- Regra de negócio importante: uma mesa não pode ter duas comandas
-- abertas ao mesmo tempo. Este índice único "parcial" garante isso no
-- próprio banco, sem depender do backend lembrar de checar.
CREATE UNIQUE INDEX idx_comanda_unica_aberta_por_mesa
  ON comandas(mesa_id) WHERE status = 'aberta';

-- Quando uma comanda é aberta, a mesa passa automaticamente para "ocupada"
CREATE TRIGGER trg_comanda_aberta_ocupa_mesa
AFTER INSERT ON comandas
WHEN NEW.status = 'aberta'
BEGIN
  UPDATE mesas SET status = 'ocupada' WHERE id = NEW.mesa_id;
END;

-- Quando a comanda é fechada/paga/cancelada, a mesa volta a ficar "livre"
CREATE TRIGGER trg_comanda_encerrada_libera_mesa
AFTER UPDATE OF status ON comandas
WHEN NEW.status IN ('fechada', 'paga', 'cancelada')
BEGIN
  UPDATE mesas SET status = 'livre' WHERE id = NEW.mesa_id;
END;


-- =============================================================================
-- 7. CARRINHOS e ITENS DO CARRINHO
-- Hoje o carrinho do site (hook useCart.ts) vive só na memória do
-- navegador e some ao recarregar a página. Estas duas tabelas guardam o
-- carrinho de verdade — usadas para pedidos de entrega/retirada online
-- (o pedido feito numa mesa não passa por aqui, ele vai direto para
-- PEDIDOS + COMANDAS).
-- =============================================================================
CREATE TABLE carrinhos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id     INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  sessao_id      TEXT,                          -- identifica o carrinho de um visitante não logado
  criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em  TEXT NOT NULL DEFAULT (datetime('now')),

  CHECK (usuario_id IS NOT NULL OR sessao_id IS NOT NULL)
);

CREATE UNIQUE INDEX idx_carrinho_usuario ON carrinhos(usuario_id) WHERE usuario_id IS NOT NULL;
CREATE UNIQUE INDEX idx_carrinho_sessao ON carrinhos(sessao_id) WHERE sessao_id IS NOT NULL;

CREATE TRIGGER trg_carrinhos_atualizado
AFTER UPDATE ON carrinhos
BEGIN
  UPDATE carrinhos SET atualizado_em = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE itens_carrinho (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  carrinho_id  INTEGER NOT NULL REFERENCES carrinhos(id) ON DELETE CASCADE,
  produto_id   INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade   INTEGER NOT NULL CHECK (quantidade > 0),
  criado_em    TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE (carrinho_id, produto_id)
);

CREATE INDEX idx_itens_carrinho_carrinho ON itens_carrinho(carrinho_id);


-- =============================================================================
-- 8. PEDIDOS
-- Um pedido "fechado". Corresponde à página "Meus Pedidos"
-- (MeusPedidosPage.tsx), que hoje só mostra o carrinho atual.
--
-- O campo "tipo" decide o resto: um pedido de ENTREGA usa endereco_id,
-- um pedido feito numa MESA usa comanda_id, e um pedido de RETIRADA no
-- balcão não usa nenhum dos dois. O CHECK no final garante que só a
-- combinação certa é aceita — impossível salvar um pedido de mesa com
-- um endereço de entrega junto, por exemplo.
-- =============================================================================
CREATE TABLE pedidos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id        INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,  -- pode ficar em branco num pedido de mesa feito por visitante
  tipo              TEXT NOT NULL DEFAULT 'entrega'
                    CHECK (tipo IN ('entrega', 'retirada', 'local')),   -- 'local' = pedido feito numa mesa
  endereco_id       INTEGER REFERENCES enderecos(id) ON DELETE RESTRICT,
  comanda_id        INTEGER REFERENCES comandas(id) ON DELETE RESTRICT,  -- ★ sistema de mesas
  status            TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN (
                      'pendente', 'confirmado', 'em_preparo',
                      'saiu_para_entrega', 'pronto', 'entregue', 'cancelado'
                    )),
  metodo_pagamento  TEXT,
  subtotal          NUMERIC NOT NULL CHECK (subtotal >= 0),
  taxa_entrega      NUMERIC NOT NULL DEFAULT 0 CHECK (taxa_entrega >= 0),
  total             NUMERIC NOT NULL CHECK (total >= 0),
  observacoes       TEXT,
  criado_em         TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em     TEXT NOT NULL DEFAULT (datetime('now')),

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
AFTER UPDATE ON pedidos
BEGIN
  UPDATE pedidos SET atualizado_em = datetime('now') WHERE id = NEW.id;
END;


-- =============================================================================
-- 9. ITENS DO PEDIDO
-- O nome e o preço do produto são "fotografados" aqui no momento da
-- compra, para que o histórico do pedido nunca mude mesmo que o preço do
-- produto seja alterado (ou o produto seja removido) depois.
-- =============================================================================
CREATE TABLE itens_pedido (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id        INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id       INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
  nome_produto     TEXT NOT NULL,
  preco_unitario   NUMERIC NOT NULL CHECK (preco_unitario >= 0),
  quantidade       INTEGER NOT NULL CHECK (quantidade > 0),
  subtotal         NUMERIC NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX idx_itens_pedido_pedido ON itens_pedido(pedido_id);


-- =============================================================================
-- 10. PAGAMENTOS
-- Um pagamento pode fechar UM pedido (entrega/retirada) OU a COMANDA
-- inteira de uma mesa de uma vez (o jeito mais comum de fechar a conta
-- num restaurante: paga tudo o que a mesa consumiu na visita, não pedido
-- por pedido). O CHECK garante que é sempre um OU outro, nunca os dois.
-- =============================================================================
CREATE TABLE pagamentos (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id              INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
  comanda_id             INTEGER REFERENCES comandas(id) ON DELETE CASCADE,  -- ★ sistema de mesas
  metodo                 TEXT NOT NULL
                         CHECK (metodo IN ('cartao_credito', 'cartao_debito', 'pix', 'dinheiro')),
  status                 TEXT NOT NULL DEFAULT 'pendente'
                         CHECK (status IN ('pendente', 'aprovado', 'recusado', 'estornado')),
  valor                  NUMERIC NOT NULL CHECK (valor >= 0),
  transacao_externa_id   TEXT,
  pago_em                TEXT,
  criado_em              TEXT NOT NULL DEFAULT (datetime('now')),

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

-- Mesmas categorias e produtos que já existem hoje, fixos, em
-- src/app/data/menu.tsx — só que agora vindo do banco.
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
