import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, ShieldAlert, Users } from "lucide-react";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import {
  adminBanirUsuarioMesaVirtual,
  adminListarDenuncias,
  adminListarMesasVirtuais,
  adminMarcarDenuncia,
  ApiError,
} from "@/app/lib/api";
import { temaInfo } from "@/app/data/temasMesaVirtual";
import type { DenunciaAdminApi, MesaVirtualAdminApi } from "@/app/types";

export function AdminMesasVirtuaisPanel() {
  const { token } = useAdminAuth();
  const [mesas, setMesas] = useState<MesaVirtualAdminApi[]>([]);
  const [denuncias, setDenuncias] = useState<DenunciaAdminApi[]>([]);
  const [aba, setAba] = useState<"mesas" | "denuncias">("mesas");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const recarregar = useCallback(() => {
    if (!token) return;
    adminListarMesasVirtuais(token).then(setMesas).catch(() => {});
    adminListarDenuncias(token, "pendente").then(setDenuncias).catch(() => {});
  }, [token]);

  useEffect(() => {
    recarregar();
    const intervalo = setInterval(recarregar, 8000);
    return () => clearInterval(intervalo);
  }, [recarregar]);

  const banir = async (usuarioId: number, nome: string) => {
    if (!token) return;
    if (!confirm(`Banir "${nome}" do Network da Fome? A pessoa continua podendo pedir hambúrguer normalmente.`)) return;
    setOcupado(`ban-${usuarioId}`);
    try {
      await adminBanirUsuarioMesaVirtual(token, usuarioId);
      recarregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível banir este usuário.");
    } finally {
      setOcupado(null);
    }
  };

  const resolverDenuncia = async (denunciaId: number) => {
    if (!token) return;
    setOcupado(`denuncia-${denunciaId}`);
    try {
      await adminMarcarDenuncia(token, denunciaId, "analisada");
      recarregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível atualizar a denúncia.");
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setAba("mesas")}
          className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-colors ${
            aba === "mesas" ? "bg-primary text-white" : "bg-secondary border border-border text-muted-foreground"
          }`}
        >
          Mesas ao vivo
        </button>
        <button
          onClick={() => setAba("denuncias")}
          className={`relative px-3.5 py-1.5 rounded-xl text-sm font-bold transition-colors ${
            aba === "denuncias" ? "bg-primary text-white" : "bg-secondary border border-border text-muted-foreground"
          }`}
        >
          Denúncias
          {denuncias.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center font-bold">
              {denuncias.length}
            </span>
          )}
        </button>
      </div>

      {erro && <p className="mb-4 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">{erro}</p>}

      {aba === "mesas" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mesas.map((mesa) => {
            const info = temaInfo(mesa.tema);
            return (
              <div key={mesa.id} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                    {mesa.nome}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {info.emoji} {info.label} · {mesa.participantes.length}/{mesa.capacidade}
                  </span>
                </div>
                {mesa.participantes.length === 0 ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Users size={13} /> Vazia
                  </p>
                ) : (
                  <div className="space-y-2">
                    {mesa.participantes.map((p) => (
                      <div key={p.usuario_id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">
                            {p.nome} <span className="text-muted-foreground text-xs">· {p.email}</span>
                          </p>
                          {p.comendo && <p className="text-[11px] text-muted-foreground">🍔 {p.comendo}</p>}
                        </div>
                        <button
                          onClick={() => banir(p.usuario_id, p.nome)}
                          disabled={ocupado === `ban-${p.usuario_id}`}
                          className="flex items-center gap-1 text-[11px] font-bold text-destructive hover:underline disabled:opacity-50"
                        >
                          <Ban size={12} /> Banir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {aba === "denuncias" && (
        <div className="space-y-3">
          {denuncias.length === 0 && (
            <p className="text-sm text-muted-foreground flex items-center gap-2 py-8 justify-center">
              <CheckCircle2 size={16} className="text-accent" /> Nenhuma denúncia pendente.
            </p>
          )}
          {denuncias.map((d) => (
            <div key={d.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle size={15} className="text-yellow-500 mt-0.5 shrink-0" />
                <p className="text-sm">
                  <span className="font-bold">{d.denunciante_nome}</span> denunciou{" "}
                  <span className="font-bold">{d.denunciado_nome}</span> na {d.mesa_virtual_nome}
                </p>
              </div>
              <p className="text-sm text-muted-foreground mb-2">Motivo: {d.motivo}</p>
              {d.mensagem_texto && (
                <p className="text-xs bg-secondary rounded-lg px-3 py-2 mb-3 italic">"{d.mensagem_texto}"</p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => banir(d.denunciado_id, d.denunciado_nome)}
                  className="flex items-center gap-1 text-xs font-bold text-destructive hover:underline"
                >
                  <Ban size={12} /> Banir denunciado
                </button>
                <button
                  onClick={() => resolverDenuncia(d.id)}
                  disabled={ocupado === `denuncia-${d.id}`}
                  className="flex items-center gap-1 text-xs font-bold text-accent hover:underline disabled:opacity-50"
                >
                  <ShieldAlert size={12} /> Marcar como analisada
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
