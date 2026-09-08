import type { TemaMesaVirtual } from "@/app/types";

export const TEMAS_MESA_VIRTUAL: { valor: TemaMesaVirtual; emoji: string; label: string }[] = [
  { valor: "games", emoji: "🎮", label: "Games" },
  { valor: "tecnologia", emoji: "💻", label: "Tecnologia" },
  { valor: "programacao", emoji: "🧑‍💻", label: "Programação" },
  { valor: "ciencia", emoji: "🔬", label: "Ciência" },
  { valor: "filmes_series", emoji: "🎬", label: "Filmes e séries" },
  { valor: "musica", emoji: "🎵", label: "Música" },
  { valor: "livros", emoji: "📚", label: "Livros" },
  { valor: "papo_livre", emoji: "💬", label: "Papo livre" },
];

export function temaInfo(tema: TemaMesaVirtual | null) {
  if (!tema) return { emoji: "💬", label: "Papo livre" };
  return TEMAS_MESA_VIRTUAL.find((t) => t.valor === tema) ?? { emoji: "💬", label: "Papo livre" };
}

/** Iniciais para o "avatar" de alguém sentado numa mesa — o projeto não tem
 * upload de foto de perfil, então usamos as iniciais do nome sobre uma cor
 * estável (derivada do id), do mesmo jeito que várias redes fazem. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "?";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

const CORES_AVATAR = ["#ff5e1a", "#00e5a0", "#7b6cff", "#ffb340", "#ff4fa3", "#3ac1ff"];

export function corAvatar(usuarioId: number): string {
  return CORES_AVATAR[usuarioId % CORES_AVATAR.length];
}
