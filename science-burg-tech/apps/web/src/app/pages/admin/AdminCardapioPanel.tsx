import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import { adminAtualizarProduto, adminListarProdutos, getCategorias, type CategoriaApi, type ProdutoApi } from "@/app/lib/api";
import { ProdutoFormModal } from "@/app/pages/admin/ProdutoFormModal";

export function AdminCardapioPanel() {
  const { token } = useAdminAuth();
  const [produtos, setProdutos] = useState<ProdutoApi[]>([]);
  const [categorias, setCategorias] = useState<CategoriaApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<ProdutoApi | null>(null);

  const recarregar = () => {
    if (!token) return;
    Promise.all([adminListarProdutos(token), getCategorias()]).then(([p, c]) => {
      setProdutos(p);
      setCategorias(c);
      setCarregando(false);
    });
  };

  useEffect(recarregar, [token]);

  const abrirNovo = () => {
    setProdutoEditando(null);
    setModalAberto(true);
  };

  const abrirEdicao = (produto: ProdutoApi) => {
    setProdutoEditando(produto);
    setModalAberto(true);
  };

  const onSaved = (produto: ProdutoApi) => {
    setProdutos((prev) => {
      const existe = prev.some((p) => p.id === produto.id);
      return existe ? prev.map((p) => (p.id === produto.id ? produto : p)) : [...prev, produto];
    });
  };

  const alternarDisponibilidade = async (produto: ProdutoApi) => {
    if (!token) return;
    const atualizado = await adminAtualizarProduto(token, produto.id, { disponivel: !produto.disponivel });
    setProdutos((prev) => prev.map((p) => (p.id === produto.id ? atualizado : p)));
  };

  if (carregando) return <p className="text-sm text-muted-foreground text-center py-12">Carregando cardápio…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
          Cardápio
        </h2>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} /> Novo produto
        </button>
      </div>

      {categorias.map((categoria) => {
        const itens = produtos.filter((p) => p.categoria_slug === categoria.slug);
        if (itens.length === 0) return null;
        return (
          <div key={categoria.id} className="mb-8">
            <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">
              {categoria.emoji} {categoria.nome}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {itens.map((produto) => (
                <div key={produto.id} className="bg-card border border-border rounded-2xl overflow-hidden flex gap-3 p-3">
                  <div className="w-16 h-16 rounded-xl bg-secondary flex-shrink-0 overflow-hidden">
                    {produto.imagem_url && <img src={produto.imagem_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{produto.nome}</p>
                    <p className="text-xs text-primary font-bold mt-0.5">R$ {produto.preco.toFixed(2).replace(".", ",")}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => alternarDisponibilidade(produto)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          produto.disponivel ? "bg-accent/15 text-accent" : "bg-muted-foreground/10 text-muted-foreground"
                        }`}
                      >
                        {produto.disponivel ? "Disponível" : "Indisponível"}
                      </button>
                      <button onClick={() => abrirEdicao(produto)} className="text-muted-foreground hover:text-foreground">
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {modalAberto && (
        <ProdutoFormModal produto={produtoEditando} categorias={categorias} onClose={() => setModalAberto(false)} onSaved={onSaved} />
      )}
    </div>
  );
}
