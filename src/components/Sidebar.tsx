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
  ClipboardList,
  Users,
  LogOut,
  Tag,
  Calculator,
  Briefcase,
  Shield,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";

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
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleSidebar, isMobileSheet = false }) => {
  const { signOut } = useAuth();
  
  const sidebarWidth = isMobileSheet ? "w-full" : isCollapsed ? "w-20" : "w-64";
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
        isMobileSheet ? "p-4" : "p-4 flex-shrink-0",
      )}
    >
      <div className="mb-8 p-2 flex items-center justify-between flex-shrink-0">
        {(!isCollapsed || isMobileSheet) && (
          <div className="overflow-hidden">
            <h1 className="text-xl font-bold text-sidebar-primary-foreground text-white whitespace-nowrap">
              UpWeb
            </h1>
            <p className="text-sm text-gray-400 whitespace-nowrap truncate" title={displaySubtitle}>
              {displaySubtitle}
            </p>
          </div>
        )}
        
        {!isMobileSheet && (
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

      <div className="flex-grow overflow-y-auto pr-1">
        <nav className="space-y-1">
          {!isCollapsed && (
            <h2 className="text-xs font-semibold uppercase text-gray-500 mb-2 px-3">
              Menu Principal
            </h2>
          )}
          <NavItem to="/dashboard" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" isCollapsed={isCollapsed} />
          <NavItem to="/financeiro" icon={<DollarSign className="w-5 h-5" />} label="Financeiro" isCollapsed={isCollapsed} />
          <NavItem to="/fundo-caixa" icon={<Shield className="w-5 h-5" />} label="Fundo de Caixa" isCollapsed={isCollapsed} />
          <NavItem to="/vendas" icon={<ShoppingBag className="w-5 h-5" />} label="Vendas" isCollapsed={isCollapsed} />
          <NavItem to="/contratos" icon={<FileText className="w-5 h-5" />} label="Contratos" isCollapsed={isCollapsed} />
          <NavItem to="/recebimentos" icon={<Wallet className="w-5 h-5" />} label="Recebimentos" isCollapsed={isCollapsed} />
          <NavItem to="/proventos" icon={<Calculator className="w-5 h-5" />} label="Gestão de Proventos" isCollapsed={isCollapsed} />
          <NavItem to="/marketing" icon={<Megaphone className="w-5 h-5" />} label="Marketing" isCollapsed={isCollapsed} />
          <NavItem to="/servicos" icon={<Briefcase className="w-5 h-5" />} label="Gestão de Soluções" isCollapsed={isCollapsed} />
          <NavItem to="/custos" icon={<ClipboardList className="w-5 h-5" />} label="Gestão de Custos" isCollapsed={isCollapsed} />
          <NavItem to="/gastos" icon={<Tag className="w-5 h-5" />} label="Gestão de Gastos" isCollapsed={isCollapsed} />
          <NavItem to="/saques" icon={<Users className="w-5 h-5" />} label="Gestão de Saques" isCollapsed={isCollapsed} />
          <NavItem to="/relatorios" icon={<FileText className="w-5 h-5" />} label="Relatórios" isCollapsed={isCollapsed} />
        </nav>

        <div className="mt-4 pt-4 border-t border-sidebar-border space-y-1">
          <NavItem to="/configuracoes" icon={<Settings className="w-5 h-5" />} label="Configurações" isCollapsed={isCollapsed} />
          <Button
            variant="ghost"
            onClick={signOut}
            className={cn(
              "w-full flex items-center p-3 rounded-lg transition-colors justify-start text-red-400 hover:bg-red-900/20",
              isCollapsed ? "justify-center" : "justify-start",
            )}
          >
            <LogOut className="w-5 h-5" />
            {!isCollapsed && <span className="ml-3 whitespace-nowrap">Sair</span>}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;