-- =============================================================================
-- 11. MESAS VIRTUAIS  ★ "Network da Fome" — salão social do site
--
-- Não confundir com a tabela "mesas" (lá em cima, seção 5): aquelas são as
-- mesas físicas da loja, ligadas a QR code/comanda/pedido local. Estas são
-- mesas 100% virtuais, onde clientes desconhecidos se sentam para conversar
-- por texto/voz enquanto comem — sem nenhuma relação com o salão físico.
-- =============================================================================
CREATE TABLE mesas_virtuais (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome        TEXT NOT NULL,
  capacidade  INTEGER NOT NULL CHECK (capacidade IN (2, 4, 6)),
  tema        TEXT CHECK (tema IN (
                'games', 'tecnologia', 'programacao', 'ciencia',
                'filmes_series', 'musica', 'livros', 'papo_livre'
              )),
  ativa       INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  criado_em   TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

-- Quem está sentado (ou já esteve) em cada mesa virtual. "Sentado agora" é
-- sempre "saiu_em IS NULL" — nunca apagamos a linha, só fechamos com a
-- saída, então a mesa guarda um histórico de quem passou por ela.
CREATE TABLE mesas_virtuais_participantes (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mesa_virtual_id  INTEGER NOT NULL REFERENCES mesas_virtuais(id) ON DELETE CASCADE,
  usuario_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  lugar_numero     INTEGER NOT NULL CHECK (lugar_numero > 0),
  entrou_em        TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  saiu_em          TEXT
);

CREATE INDEX idx_participantes_mesa_virtual ON mesas_virtuais_participantes(mesa_virtual_id);
CREATE INDEX idx_participantes_usuario ON mesas_virtuais_participantes(usuario_id);

-- Ninguém senta duas vezes no mesmo lugar de uma mesa ao mesmo tempo — é a
-- regra de negócio central de "Network da Fome", aplicada pelo próprio
-- banco (além da checagem que a rota faz antes de inserir).
CREATE UNIQUE INDEX idx_lugar_ocupado_por_mesa
  ON mesas_virtuais_participantes(mesa_virtual_id, lugar_numero) WHERE saiu_em IS NULL;

-- E ninguém está sentado em duas mesas virtuais ao mesmo tempo.
CREATE UNIQUE INDEX idx_usuario_sentado_uma_vez
  ON mesas_virtuais_participantes(usuario_id) WHERE saiu_em IS NULL;

-- Mensagens de texto do chat de cada mesa virtual. "removida" é usado pela
-- moderação (o texto continua no banco para auditoria, só some da tela).
CREATE TABLE mesas_virtuais_mensagens (
  id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mesa_virtual_id      INTEGER NOT NULL REFERENCES mesas_virtuais(id) ON DELETE CASCADE,
  usuario_id           INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto                TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 500),
  removida             INTEGER NOT NULL DEFAULT 0 CHECK (removida IN (0, 1)),
  removida_por_admin_id INTEGER REFERENCES administradores(id) ON DELETE SET NULL,
  criado_em            TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE INDEX idx_mensagens_mesa_virtual ON mesas_virtuais_mensagens(mesa_virtual_id, id);

-- Denúncias de um participante contra outro, dentro de uma mesa virtual.
CREATE TABLE mesas_virtuais_denuncias (
  id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mesa_virtual_id   INTEGER NOT NULL REFERENCES mesas_virtuais(id) ON DELETE CASCADE,
  denunciante_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  denunciado_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  motivo            TEXT NOT NULL CHECK (char_length(motivo) BETWEEN 1 AND 500),
  mensagem_id       INTEGER REFERENCES mesas_virtuais_mensagens(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'analisada')),
  criado_em         TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),

  CHECK (denunciante_id <> denunciado_id)
);

CREATE INDEX idx_denuncias_status ON mesas_virtuais_denuncias(status);

-- Bloqueios são só do lado de quem bloqueia: o bloqueado nunca sabe que foi
-- bloqueado, e as mensagens dele somem só da tela de quem bloqueou.
CREATE TABLE mesas_virtuais_bloqueios (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  bloqueado_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em     TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),

  UNIQUE (usuario_id, bloqueado_id),
  CHECK (usuario_id <> bloqueado_id)
);

CREATE INDEX idx_bloqueios_usuario ON mesas_virtuais_bloqueios(usuario_id);

-- Banimento do recurso social (não é um banimento da conta inteira — o
-- cliente continua podendo pedir hambúrguer normalmente).
CREATE TABLE mesas_virtuais_banidos (
  usuario_id      INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  motivo          TEXT,
  banido_por_id   INTEGER REFERENCES administradores(id) ON DELETE SET NULL,
  criado_em       TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);


-- Mesas virtuais de exemplo do salão "Network da Fome" (ajuste à vontade
-- pelo painel admin — quantidade, tema e capacidade não são fixos no código)
INSERT INTO mesas_virtuais (nome, capacidade, tema) VALUES
  ('Mesa 01', 2, 'tecnologia'),
  ('Mesa 02', 2, 'papo_livre'),
  ('Mesa 03', 4, 'programacao'),
  ('Mesa 04', 4, 'games'),
  ('Mesa 05', 4, 'ciencia'),
  ('Mesa 06', 6, 'filmes_series'),
  ('Mesa 07', 6, 'papo_livre'),
  ('Mesa 08', 6, 'musica'),
  ('Mesa 09', 4, 'livros'),
  ('Mesa 10', 2, NULL);
