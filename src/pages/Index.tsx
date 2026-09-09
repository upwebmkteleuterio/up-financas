import { Navigate } from "react-router-dom";

const Index = () => {
  // Redireciona a página inicial para o painel Financeiro
  return <Navigate to="/financeiro" replace />;
};

export default Index;