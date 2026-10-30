import React from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  DollarSign,
  ShoppingBag,
  Megaphone,
  Wallet,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
  Users,
  LogOut,
  Calculator,
  Briefcase,
  Shield,
  MessageCircle,
  CalendarClock,
  CircleDollarSign,
  ChartNoAxesCombined,
  Target,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import FinanceAiChat from "./FinanceAiChat";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isUnderConstruction?: boolean;
  isCollapsed: boolean;
}

const NavItem: React.FC<NavItemProps> = ({
  to,
  icon,
  label,
  isUnderConstruction = false,
  isCollapsed,
}) => {
  const baseClasses =
    "flex items-center p-3 rounded-lg transition-colors relative";
  const activeClasses =
    "bg-sidebar-accent text-sidebar-accent-foreground font-semibold";
  const inactiveClasses =
    "text-sidebar-foreground hover:bg-sidebar-accent/50";

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          baseClasses, 
          isActive ? activeClasses : inactiveClasses,
          isCollapsed ? "justify-center" : "justify-start" 
        )
      }
    >
      <div className="flex-shrink-0 w-5 h-5">
        {icon}
      </div>
      
      {!isCollapsed && <span className="ml-3 whitespace-nowrap">{label}</span>}
      {!isCollapsed && isUnderConstruction && (
        <span className="ml-auto text-xs text-yellow-500 bg-yellow-900/50 px-2 py-0.5 rounded-full">
          Em Breve
        </span>
      )}
    </NavLink>
  );
};

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileSheet?: boolean;
  aiChatOpen?: boolean;
  onToggleAiChat?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  toggleSidebar,
  isMobileSheet = false,
  aiChatOpen = false,
  onToggleAiChat,
}) => {
  const { signOut } = useAuth();
  const [mobileAiChatOpen, setMobileAiChatOpen] = React.useState(false);
  const chatOpen = isMobileSheet ? mobileAiChatOpen : aiChatOpen;
  const toggleChat = isMobileSheet ? () => setMobileAiChatOpen((open) => !open) : onToggleAiChat;
  const isChatRail = !isMobileSheet && chatOpen;
  const isRail = isChatRail || isCollapsed;
  
  const sidebarWidth = isMobileSheet ? "w-full" : chatOpen ? "w-20" : isCollapsed ? "w-20" : "w-64";
  const toggleIcon = isCollapsed ? (
    <ChevronRight className="w-5 h-5" />
  ) : (
    <ChevronLeft className="w-5 h-5" />
  );
  
  const displaySubtitle = "Gestão estratégica";

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300",
        sidebarWidth,
        isMobileSheet && chatOpen ? "p-0" : isMobileSheet ? "p-4" : "p-4 flex-shrink-0",
      )}
    >
      {!(isMobileSheet && chatOpen) && (
        <div className="mb-8 p-2 flex items-center justify-between flex-shrink-0">
          {(!isRail || isMobileSheet) && (
            <div className="overflow-hidden">
              <h1 className="text-xl font-bold text-sidebar-primary-foreground text-white whitespace-nowrap">
                UpWeb
              </h1>
              <p className="text-sm text-gray-400 whitespace-nowrap truncate" title={displaySubtitle}>
                {displaySubtitle}
              </p>
            </div>
          )}
          
          {!isMobileSheet && !isChatRail && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className={cn(
                  "text-sidebar-foreground hover:bg-sidebar-accent/50",
                  isCollapsed ? "mx-auto" : "ml-auto",
                )}
              >
                {toggleIcon}
              </Button>
          )}
        </div>
      )}

      {toggleChat && !(isMobileSheet && chatOpen) && (
        <Button
          type="button"
          variant="outline"
          onClick={toggleChat}
          className={cn(
            "mb-4 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent/50",
            isRail && !isMobileSheet ? "px-0" : "justify-start",
            isChatRail && "bg-sidebar-accent text-sidebar-accent-foreground",
          )}
          aria-label="Abrir assistente financeiro"
        >
          <MessageCircle className="h-5 w-5" />
          {(!isRail || isMobileSheet) && <span className="ml-3">Assistente financeiro</span>}
        </Button>
      )}

      {isMobileSheet && chatOpen ? (
        <FinanceAiChat onClose={() => toggleChat?.()} />
      ) : (
      <div className="flex-grow overflow-y-auto pr-1">
        <nav className="space-y-1">
          <section>
            {!isRail && (
              <h2 className="text-xs font-semibold uppercase text-gray-500 mb-2 px-3">
                Menu Principal
              </h2>
            )}
            <NavItem to="/dashboard" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" isCollapsed={isRail} />
            <NavItem to="/metas-anuais" icon={<Target className="w-5 h-5" />} label="Metas anuais" isCollapsed={isRail} />
            <NavItem to="/financeiro" icon={<DollarSign className="w-5 h-5" />} label="Financeiro" isCollapsed={isRail} />
            <NavItem to="/fundo-caixa" icon={<Shield className="w-5 h-5" />} label="Fundo de Caixa" isCollapsed={isRail} />
          </section>

          <section className="mt-3 border-t border-sidebar-border pt-3">
            {!isRail && <h2 className="text-xs font-semibold uppercase text-gray-500 mb-2 px-3">Vendas e recebimentos</h2>}
            <NavItem to="/vendas" icon={<ShoppingBag className="w-5 h-5" />} label="Vendas" isCollapsed={isRail} />
            <NavItem to="/contratos" icon={<FileText className="w-5 h-5" />} label="Contratos" isCollapsed={isRail} />
            <NavItem to="/recebimentos" icon={<Wallet className="w-5 h-5" />} label="Recebimentos" isCollapsed={isRail} />
          </section>

          <section className="mt-3 border-t border-sidebar-border pt-3">
            {!isRail && <h2 className="text-xs font-semibold uppercase text-gray-500 mb-2 px-3">Despesas e fluxo</h2>}
            <NavItem to="/programacao-saidas" icon={<CalendarClock className="w-5 h-5" />} label="Programação de Despesas" isCollapsed={isRail} />
            <NavItem to="/saidas" icon={<CircleDollarSign className="w-5 h-5" />} label="Despesas" isCollapsed={isRail} />
            <NavItem to="/fluxo-caixa" icon={<ChartNoAxesCombined className="w-5 h-5" />} label="Fluxo de Caixa" isCollapsed={isRail} />
          </section>

          <section className="mt-3 border-t border-sidebar-border pt-3">
            {!isRail && <h2 className="text-xs font-semibold uppercase text-gray-500 mb-2 px-3">Proventos e marketing</h2>}
            <NavItem to="/proventos" icon={<Calculator className="w-5 h-5" />} label="Gestão de Proventos" isCollapsed={isRail} />
            <NavItem to="/marketing" icon={<Megaphone className="w-5 h-5" />} label="Marketing" isCollapsed={isRail} />
          </section>

          <section className="mt-3 border-t border-sidebar-border pt-3">
            {!isRail && <h2 className="text-xs font-semibold uppercase text-gray-500 mb-2 px-3">Gestão</h2>}
            <NavItem to="/servicos" icon={<Briefcase className="w-5 h-5" />} label="Gestão de Soluções" isCollapsed={isRail} />
            <NavItem to="/saques" icon={<Users className="w-5 h-5" />} label="Gestão de Saques" isCollapsed={isRail} />
            <NavItem to="/relatorios" icon={<FileText className="w-5 h-5" />} label="Relatórios" isCollapsed={isRail} />
          </section>
        </nav>

        <div className="mt-4 pt-4 border-t border-sidebar-border space-y-1">
          <NavItem to="/configuracoes" icon={<Settings className="w-5 h-5" />} label="Configurações" isCollapsed={isRail} />
          <Button
            variant="ghost"
            onClick={signOut}
            className={cn(
              "w-full flex items-center p-3 rounded-lg transition-colors justify-start text-red-400 hover:bg-red-900/20",
              isRail ? "justify-center" : "justify-start",
            )}
          >
            <LogOut className="w-5 h-5" />
            {!isRail && <span className="ml-3 whitespace-nowrap">Sair</span>}
          </Button>
        </div>
      </div>
      )}
    </div>
  );
};

export default Sidebar;