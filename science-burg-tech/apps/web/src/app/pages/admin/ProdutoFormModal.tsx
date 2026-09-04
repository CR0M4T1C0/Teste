import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import { ApiError, adminAtualizarProduto, adminCriarProduto, adminUploadImagem, type CategoriaApi, type ProdutoApi, type ProdutoCampos } from "@/app/lib/api";
import { slugify } from "@/app/lib/slugify";

const CORES_BADGE = [
  { valor: "bg-primary", label: "Laranja" },
  { valor: "bg-blue-500", label: "Azul" },
  { valor: "bg-red-600", label: "Vermelho" },
  { valor: "bg-green-600", label: "Verde" },
  { valor: "bg-purple-600", label: "Roxo" },
  { valor: "bg-zinc-600", label: "Cinza" },
];

export function ProdutoFormModal({
  produto,
  categorias,
  onClose,
  onSaved,
}: {
  produto: ProdutoApi | null;
  categorias: CategoriaApi[];
  onClose: () => void;
  onSaved: (produto: ProdutoApi) => void;
}) {
  const { token } = useAdminAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categoriaId, setCategoriaId] = useState(produto?.categoria_id ?? categorias[0]?.id ?? 0);
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [slug, setSlug] = useState(produto?.slug ?? "");
  const [slugEditadoManualmente, setSlugEditadoManualmente] = useState(!!produto);
  const [descricao, setDescricao] = useState(produto?.descricao ?? "");
  const [preco, setPreco] = useState(produto ? String(produto.preco) : "");
  const [calorias, setCalorias] = useState(produto?.calorias != null ? String(produto.calorias) : "");
  const [tag, setTag] = useState(produto?.tag ?? "");
  const [corBadge, setCorBadge] = useState(produto?.cor_badge ?? "bg-primary");
  const [imagemUrl, setImagemUrl] = useState(produto?.imagem_url ?? "");
  const [disponivel, setDisponivel] = useState(produto?.disponivel ?? true);

  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const onNomeChange = (valor: string) => {
    setNome(valor);
    if (!slugEditadoManualmente) setSlug(slugify(valor));
  };

  const onSelecionarImagem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo || !token) return;
    setEnviandoImagem(true);
    setErro(null);
    try {
      const resultado = await adminUploadImagem(token, arquivo);
      setImagemUrl(resultado.url);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setEnviandoImagem(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErro(null);
    setSalvando(true);

    const payload: ProdutoCampos = {
      categoria_id: categoriaId,
      nome,
      slug,
      descricao: descricao || null,
      preco: Number(preco.replace(",", ".")),
      calorias: calorias ? Number(calorias) : null,
      imagem_url: imagemUrl || null,
      tag: tag || null,
      cor_badge: corBadge,
      disponivel,
    };

    try {
      const salvo = produto ? await adminAtualizarProduto(token, produto.id, payload) : await adminCriarProduto(token, payload);
      onSaved(salvo);
      onClose();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar o produto.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={onSubmit}
        className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            {produto ? "Editar produto" : "Novo produto"}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {erro && <p className="mb-4 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">{erro}</p>}

        <div className="space-y-4">
          {/* Foto */}
          <div>
            <label className="text-xs font-bold mb-1.5 block">Foto</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onSelecionarImagem} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={enviandoImagem}
              className="w-full h-36 rounded-2xl border border-dashed border-border bg-secondary flex items-center justify-center overflow-hidden relative"
            >
              {imagemUrl ? (
                <img src={imagemUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1.5 text-muted-foreground text-xs">
                  <ImagePlus size={22} /> Clique para escolher uma foto
                </span>
              )}
              {enviandoImagem && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-primary" />
                </div>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold mb-1.5 block">Categoria</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(Number(e.target.value))}
                required
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold mb-1.5 block">Disponibilidade</label>
              <button
                type="button"
                onClick={() => setDisponivel((d) => !d)}
                className={`w-full py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                  disponivel ? "bg-accent/15 border-accent/30 text-accent" : "bg-secondary border-border text-muted-foreground"
                }`}
              >
                {disponivel ? "Disponível" : "Indisponível"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block">Nome</label>
            <input
              value={nome}
              onChange={(e) => onNomeChange(e.target.value)}
              required
              className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block">Identificador (slug)</label>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugEditadoManualmente(true);
              }}
              required
              className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary font-mono"
              style={{ fontFamily: "'JetBrains Mono',monospace" }}
            />
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block">Descrição / ingredientes</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold mb-1.5 block">Preço (R$)</label>
              <input
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                required
                inputMode="decimal"
                placeholder="0,00"
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold mb-1.5 block">Calorias (opcional)</label>
              <input
                value={calorias}
                onChange={(e) => setCalorias(e.target.value)}
                inputMode="numeric"
                placeholder="Ex: 720"
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold mb-1.5 block">Selo (opcional)</label>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Ex: NOVO"
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold mb-1.5 block">Cor do selo</label>
              <select
                value={corBadge}
                onChange={(e) => setCorBadge(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
              >
                {CORES_BADGE.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={salvando || enviandoImagem}
          className="w-full mt-6 py-3.5 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-colors disabled:opacity-60"
          style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
        >
          {salvando ? "Salvando…" : produto ? "Salvar alterações" : "Criar produto"}
        </button>
      </form>
    </div>
  );
}
