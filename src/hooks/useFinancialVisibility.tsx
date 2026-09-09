import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FinancialVisibilityContextType {
  isVisible: boolean;
  toggleVisibility: () => void;
}

const FinancialVisibilityContext = createContext<FinancialVisibilityContextType | undefined>(undefined);

export function useFinancialVisibility() {
  const context = useContext(FinancialVisibilityContext);
  if (context === undefined) {
    throw new Error("useFinancialVisibility must be used within a FinancialVisibilityProvider");
  }
  return context;
}

export function FinancialVisibilityProvider({ children }: { children: React.ReactNode }) {
  // Default state is FALSE (hidden) as requested by the user
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  const value = useMemo(() => ({
    isVisible,
    toggleVisibility,
  }), [isVisible, toggleVisibility]);

  return <FinancialVisibilityContext.Provider value={value}>{children}</FinancialVisibilityContext.Provider>;
}

interface VisibilityToggleButtonProps {
    className?: string;
}

export const VisibilityToggleButton: React.FC<VisibilityToggleButtonProps> = ({ className }) => {
    const { isVisible, toggleVisibility } = useFinancialVisibility();
    
    const Icon = isVisible ? EyeOff : Eye;
    const title = isVisible ? "Ocultar Valores" : "Mostrar Valores";

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleVisibility}
            className={cn("text-sidebar-foreground hover:bg-sidebar-accent/50", className)}
            title={title}
        >
            <Icon className="w-5 h-5" />
        </Button>
    );
};