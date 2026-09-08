import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import {
  ApiError,
  adminAtualizarCombo,
  adminCriarCombo,
  adminListarProdutos,
  adminUploadImagem,
  type ComboApi,
  type ProdutoApi,
} from "@/app/lib/api";
import { slugify } from "@/app/lib/slugify";

type ItemForm = { produto_id: number; quantidade: number };

export function ComboFormModal({ combo, onClose, onSaved }: { combo: ComboApi | null; onClose: () => void; onSaved: (c: ComboApi) => void }) {
  const { token } = useAdminAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [produtos, setProdutos] = useState<ProdutoApi[]>([]);
  const [nome, setNome] = useState(combo?.nome ?? "");
  const [slug, setSlug] = useState(combo?.slug ?? "");
  const [slugEditadoManualmente, setSlugEditadoManualmente] = useState(!!combo);
  const [descricao, setDescricao] = useState(combo?.descricao ?? "");
  const [preco, setPreco] = useState(combo ? String(combo.preco) : "");
  const [imagemUrl, setImagemUrl] = useState(combo?.imagem_url ?? "");
  const [disponivel, setDisponivel] = useState(combo?.disponivel ?? true);
  const [itens, setItens] = useState<ItemForm[]>(combo?.itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })) ?? []);

  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (token) adminListarProdutos(token).then(setProdutos);
  }, [token]);

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

  const adicionarItem = () => {
    if (produtos.length === 0) return;
    setItens((p) => [...p, { produto_id: produtos[0].id, quantidade: 1 }]);
  };

  const atualizarItem = (indice: number, campo: keyof ItemForm, valor: number) => {
    setItens((p) => p.map((it, i) => (i === indice ? { ...it, [campo]: valor } : it)));
  };

  const removerItem = (indice: number) => {
    setItens((p) => p.filter((_, i) => i !== indice));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || itens.length === 0) return;
    setErro(null);
    setSalvando(true);
    try {
      if (combo) {
        const salvo = await adminAtualizarCombo(token, combo.id, {
          nome,
          descricao: descricao || null,
          preco: Number(preco.replace(",", ".")),
          imagem_url: imagemUrl || null,
          disponivel,
          itens,
        });
        onSaved(salvo);
      } else {
        const salvo = await adminCriarCombo(token, {
          nome,
          slug,
          descricao: descricao || null,
          preco: Number(preco.replace(",", ".")),
          imagem_url: imagemUrl || null,
          disponivel,
          itens,
        });
        onSaved(salvo);
      }
      onClose();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar o combo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={onSubmit} className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            {combo ? "Editar combo" : "Novo combo"}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {erro && <p className="mb-4 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">{erro}</p>}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold mb-1.5 block">Foto</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onSelecionarImagem} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={enviandoImagem}
              className="w-full h-32 rounded-2xl border border-dashed border-border bg-secondary flex items-center justify-center overflow-hidden relative"
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

          <div>
            <label className="text-xs font-bold mb-1.5 block">Nome</label>
            <input
              value={nome}
              onChange={(e) => onNomeChange(e.target.value)}
              required
              className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          {!combo && (
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
          )}

          <div>
            <label className="text-xs font-bold mb-1.5 block">Descrição (opcional)</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold mb-1.5 block">Preço do combo (R$)</label>
              <input
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                required
                inputMode="decimal"
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold block">Itens do combo</label>
              <button type="button" onClick={adicionarItem} className="text-xs font-bold text-primary hover:underline">
                + adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={item.produto_id}
                    onChange={(e) => atualizarItem(i, "produto_id", Number(e.target.value))}
                    className="flex-1 min-w-0 bg-secondary border border-border rounded-xl px-2.5 py-2 text-xs outline-none focus:border-primary"
                  >
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) => atualizarItem(i, "quantidade", Math.max(1, Number(e.target.value)))}
                    className="w-14 bg-secondary border border-border rounded-xl px-2 py-2 text-xs text-center outline-none focus:border-primary"
                  />
                  <button type="button" onClick={() => removerItem(i)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {itens.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum item ainda — adicione pelo menos um.</p>}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={salvando || enviandoImagem || itens.length === 0}
          className="w-full mt-6 py-3.5 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-colors disabled:opacity-60"
          style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
        >
          {salvando ? "Salvando…" : combo ? "Salvar alterações" : "Criar combo"}
        </button>
      </form>
    </div>
  );
}
