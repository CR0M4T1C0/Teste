import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import {
  ApiError,
  adminAtualizarPromocao,
  adminCriarPromocao,
  adminListarCupons,
  adminUploadImagem,
  type CupomApi,
  type PromocaoAdminApi,
} from "@/app/lib/api";

export function PromocaoFormModal({
  promocao,
  onClose,
  onSaved,
}: {
  promocao: PromocaoAdminApi | null;
  onClose: () => void;
  onSaved: (p: PromocaoAdminApi) => void;
}) {
  const { token } = useAdminAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cupons, setCupons] = useState<CupomApi[]>([]);
  const [titulo, setTitulo] = useState(promocao?.titulo ?? "");
  const [subtitulo, setSubtitulo] = useState(promocao?.subtitulo ?? "");
  const [imagemUrl, setImagemUrl] = useState(promocao?.imagem_url ?? "");
  const [cupomId, setCupomId] = useState<number | "">(promocao?.cupom_id ?? "");
  const [ordem, setOrdem] = useState(String(promocao?.ordem ?? 0));
  const [ativo, setAtivo] = useState(promocao?.ativo ?? true);

  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (token) adminListarCupons(token).then(setCupons);
  }, [token]);

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
    const payload = {
      titulo,
      subtitulo: subtitulo || null,
      imagem_url: imagemUrl,
      cupom_id: cupomId === "" ? null : cupomId,
      ordem: Number(ordem) || 0,
      ativo,
    };
    try {
      const salvo = promocao ? await adminAtualizarPromocao(token, promocao.id, payload) : await adminCriarPromocao(token, payload);
      onSaved(salvo);
      onClose();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar a promoção.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={onSubmit} className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            {promocao ? "Editar promoção" : "Nova promoção"}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {erro && <p className="mb-4 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">{erro}</p>}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold mb-1.5 block">Imagem do banner</label>
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
                  <ImagePlus size={22} /> Clique para escolher uma imagem
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
            <label className="text-xs font-bold mb-1.5 block">Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block">Subtítulo (opcional)</label>
            <input
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block">Cupom anunciado (opcional)</label>
            <select
              value={cupomId}
              onChange={(e) => setCupomId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value="">Nenhum</option>
              {cupons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold mb-1.5 block">Ordem</label>
              <input
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
                inputMode="numeric"
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold mb-1.5 block">Status</label>
              <button
                type="button"
                onClick={() => setAtivo((a) => !a)}
                className={`w-full py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                  ativo ? "bg-accent/15 border-accent/30 text-accent" : "bg-secondary border-border text-muted-foreground"
                }`}
              >
                {ativo ? "Ativa" : "Inativa"}
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={salvando || enviandoImagem || !imagemUrl}
          className="w-full mt-6 py-3.5 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-colors disabled:opacity-60"
          style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
        >
          {salvando ? "Salvando…" : promocao ? "Salvar alterações" : "Criar promoção"}
        </button>
      </form>
    </div>
  );
}
