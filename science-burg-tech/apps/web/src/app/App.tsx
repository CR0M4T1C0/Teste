import { MotionConfig } from "motion/react";
import { BrowserRouter, Route, Routes } from "react-router";
import { RootLayout } from "@/app/layout/RootLayout";
import { AdminLayout } from "@/app/layout/AdminLayout";
import { HomePage } from "@/app/pages/HomePage";
import { CardapioPage } from "@/app/pages/CardapioPage";
import { SobrePage } from "@/app/pages/SobrePage";
import { LocalizacaoPage } from "@/app/pages/LocalizacaoPage";
import { MeusPedidosPage } from "@/app/pages/MeusPedidosPage";
import { LoginPage } from "@/app/pages/LoginPage";
import { RegistoPage } from "@/app/pages/RegistoPage";
import { MesaPage } from "@/app/pages/MesaPage";
import { NetworkDaFomePage } from "@/app/pages/NetworkDaFomePage";
import { MesaVirtualPage } from "@/app/pages/MesaVirtualPage";
import { AdminLoginPage } from "@/app/pages/admin/AdminLoginPage";
import { AdminDashboardPage } from "@/app/pages/admin/AdminDashboardPage";
import { AdminCozinhaPage } from "@/app/pages/admin/AdminCozinhaPage";
import { ClienteAuthProvider } from "@/app/hooks/useClienteAuth";
import { AdminAuthProvider } from "@/app/hooks/useAdminAuth";

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ClienteAuthProvider>
        <AdminAuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<RootLayout />}>
                <Route index element={<HomePage />} />
                <Route path="cardapio" element={<CardapioPage />} />
                <Route path="sobre" element={<SobrePage />} />
                <Route path="localizacao" element={<LocalizacaoPage />} />
                <Route path="pedidos" element={<MeusPedidosPage />} />
                <Route path="network-da-fome" element={<NetworkDaFomePage />} />
                <Route path="mesa-virtual/:mesaId" element={<MesaVirtualPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="registo" element={<RegistoPage />} />
              </Route>

              {/* Rota "escondida" do QR code da mesa — sem link em nenhum menu público */}
              <Route path="m/:qrToken" element={<MesaPage />} />

              {/* Painel administrativo — login e rotas próprias, também sem link público */}
              <Route path="admin/login" element={<AdminLoginPage />} />
              {/* Tela cheia, sem as abas do painel — pensada pra TV/tablet na cozinha */}
              <Route path="admin/cozinha" element={<AdminCozinhaPage />} />
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AdminAuthProvider>
      </ClienteAuthProvider>
    </MotionConfig>
  );
}
