import React, { useState, useCallback } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFinance } from "@/hooks/use-finance";
import LoadingScreen from "./LoadingScreen";
import { useIsMobile } from "@/hooks/use-mobile"; // Importando useIsMobile

const ProtectedRoute: React.FC = () => {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const { isLoadingTransactions } = useFinance(); 
  const isMobile = useIsMobile();
  
  // Estado para controlar se o tempo mínimo de exibição passou
  const [isMinimumTimeElapsed, setIsMinimumTimeElapsed] = useState(false);
  
  const handleMinimumTimeElapsed = useCallback(() => {
    setIsMinimumTimeElapsed(true);
  }, []);

  // Condição 1: Carregamento obrigatório
  // Isso inclui:
  // a) Autenticação pendente
  // b) Carregamento de dados pendente
  // c) Se for mobile, forçamos o carregamento na montagem inicial (isMinimumTimeElapsed = false)
  const shouldShowLoading = 
    isLoadingAuth || 
    isLoadingTransactions || 
    (isMobile && !isMinimumTimeElapsed);

  // Condição 2: Se não estiver logado, redireciona imediatamente (prioridade máxima)
  if (!user && !isLoadingAuth) {
    return <Navigate to="/login" replace />;
  }
  
  // Condição 3: Exibe a tela de carregamento se a condição 1 for verdadeira
  if (shouldShowLoading) {
    return <LoadingScreen onMinimumTimeElapsed={handleMinimumTimeElapsed} />;
  }
  
  // Condição 4: Se estiver logado, tempo mínimo passou e dados carregados, renderiza o conteúdo
  return <Outlet />;
};

export default ProtectedRoute;