import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Financeiro from "./pages/Financeiro";
import FundoDeCaixa from "./pages/FundoDeCaixa";
import Vendas from "./pages/Vendas";
import GestaoDeSaques from "./pages/GestaoDeSaques";
import Configuracoes from "./pages/Configuracoes";
import Recebimentos from "./pages/Recebimentos";
import Contratos from "./pages/Contratos";
import Marketing from "./pages/Marketing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Relatorios from "./pages/Relatorios";
import GestaoDeServicos from "./pages/GestaoDeServicos"; // Importando a nova página
import GestaoDeProventos from "./pages/GestaoDeProventos";
import ProgramacaoSaidas from "./pages/ProgramacaoSaidas";
import Saidas from "./pages/Saidas";
import FluxoCaixa from "./pages/FluxoCaixa";
import ImportarPdf from "./pages/ImportarPdf";
import MetasAnuais from "./pages/MetasAnuais";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import { PageTitleProvider } from "./hooks/usePageTitle";
import { FinancialVisibilityProvider } from "./hooks/useFinancialVisibility";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PageTitleProvider>
            <FinancialVisibilityProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/financeiro" element={<Financeiro />} />
                  <Route path="/financeiro/importar-pdf" element={<ImportarPdf />} />
                  <Route path="/fundo-caixa" element={<FundoDeCaixa />} />
                  <Route path="/vendas" element={<Vendas />} />
                  <Route path="/contratos" element={<Contratos />} />
                  <Route path="/custos" element={<Navigate to="/programacao-saidas" replace />} />
                  <Route path="/gastos" element={<Navigate to="/programacao-saidas" replace />} />
                  <Route path="/programacao-saidas" element={<ProgramacaoSaidas />} />
                  <Route path="/saidas" element={<Saidas />} />
                  <Route path="/fluxo-caixa" element={<FluxoCaixa />} />
                  <Route path="/servicos" element={<GestaoDeServicos />} /> {/* NOVA ROTA */}
                  <Route path="/saques" element={<GestaoDeSaques />} />
                  <Route path="/proventos" element={<GestaoDeProventos />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                  <Route path="/recebimentos" element={<Recebimentos />} />
                  <Route path="/marketing" element={<Marketing />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/metas-anuais" element={<MetasAnuais />} />
                  <Route path="/relatorios" element={<Relatorios />} />
                </Route>
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </FinancialVisibilityProvider>
          </PageTitleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;