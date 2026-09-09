-- =============================================================================
-- MIGRAÇÃO 0006 — OPEN SOURCE BURGER (opção vegana)
-- O cardápio não tinha nenhum item sem origem animal, então o G.P.T. não
-- tinha o que responder a quem perguntava por opção vegetariana.
--
-- O ON CONFLICT existe por segurança de inicialização, não por capricho:
-- produtos.slug é UNIQUE, e uma migração que levanta exceção interrompe o
-- inicializar_banco(), que roda no lifespan da API — ou seja, derrubaria a
-- subida do serviço inteiro. Se alguém já tiver cadastrado este item pelo
-- painel administrativo antes deste deploy, a migração não faz nada em vez
-- de impedir a API de subir.
-- =============================================================================

INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, tag, cor_badge)
SELECT id, 'Open Source Burger', 'open-source-burger',
  'Sem ingrediente de origem animal e sem segredo: hambúrguer de grão-de-bico e beterraba, queijo vegetal, cebola roxa e maionese de castanha no pão australiano. Código aberto, qualquer um pode comer.',
  30.90, 560, '100% VEGANO', 'bg-green-600'
FROM categorias WHERE slug = 'hamburguer'
ON CONFLICT (slug) DO NOTHING;
