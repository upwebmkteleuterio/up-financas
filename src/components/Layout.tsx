import React from "react";
import Sidebar from "./Sidebar";
import { useSidebar } from "@/hooks/useSidebar";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileHeader from "./MobileHeader";
import { usePageTitle } from "@/hooks/usePageTitle"; // Importando o hook

interface LayoutProps {
  children: React.ReactNode;
  pageTitle: string; // Novo prop obrigatório
  pageSubtitle?: string; // Novo prop opcional
}

const Layout: React.FC<LayoutProps> = ({ children, pageTitle, pageSubtitle = "" }) => {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [aiChatOpen, setAiChatOpen] = React.useState(false);
  const isMobile = useIsMobile(); // Check if it's mobile
  const { setTitle } = usePageTitle(); // Hook para definir o título

  // Define o título e subtítulo no contexto sempre que o layout é renderizado
  React.useEffect(() => {
    setTitle(pageTitle, pageSubtitle);
  }, [pageTitle, pageSubtitle, setTitle]);
  
  // Largura da sidebar: 64 (256px) expandida, 20 (80px) recolhida.
  // O chat ocupa uma largura maior, sem criar uma rota extra.
  const contentMargin = isMobile ? "ml-0" : (aiChatOpen ? "ml-[26rem]" : (isCollapsed ? "ml-20" : "ml-64"));

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      
      {/* 1. Sidebar Desktop (Fixo) - Visível apenas em telas >= lg */}
      {!isMobile && (
        <div className="fixed top-0 left-0 z-10 h-screen">
          <Sidebar
            isCollapsed={isCollapsed}
            toggleSidebar={toggleSidebar}
            aiChatOpen={aiChatOpen}
            onToggleAiChat={() => setAiChatOpen((open) => !open)}
          />
        </div>
      )}
      
      {/* 2. Header Mobile (Aparece apenas no mobile/tablet) */}
      {isMobile && <MobileHeader />}
      
      {/* Conteúdo principal com margem dinâmica para a sidebar */}
      <div className={cn(
        "flex flex-col flex-1 transition-all duration-300", 
        contentMargin,
        // CRÍTICO: Usar overflow-x-hidden para garantir que o conteúdo não cause rolagem horizontal
        "overflow-x-hidden" 
      )}>
        <main className="flex-1 p-4 lg:p-6 pb-24"> {/* Adicionado pb-24 para espaço do FAB no mobile */}
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;