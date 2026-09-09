import React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Sidebar from "./Sidebar";
import { usePageTitle } from "@/hooks/usePageTitle"; // Importando o hook
import { VisibilityToggleButton } from "@/hooks/useFinancialVisibility"; // Importando o botão de toggle

const MobileHeader: React.FC = () => {
  const { title } = usePageTitle(); // Obtendo o título da página

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 lg:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[26rem] max-w-[90vw] p-0 border-r-sidebar-border bg-sidebar">
          {/* Pass isCollapsed={false} to ensure the mobile sidebar is fully expanded */}
          <Sidebar isCollapsed={false} toggleSidebar={() => {}} isMobileSheet={true} />
        </SheetContent>
      </Sheet>
      {/* Exibe o título da página */}
      <h1 className="text-xl font-bold text-sidebar-primary-foreground">{title}</h1>
      {/* Botão de Visibilidade no canto direito */}
      <VisibilityToggleButton />
    </header>
  );
};

export default MobileHeader;