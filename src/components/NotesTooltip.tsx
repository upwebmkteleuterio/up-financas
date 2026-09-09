import React, { useState, useCallback, useEffect } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface NotesTooltipProps {
    notes: string;
    children: React.ReactNode;
}

const NotesTooltip: React.FC<NotesTooltipProps> = ({ 
    notes, 
    children, 
}) => {
    const isMobile = useIsMobile();
    const [isOpen, setIsOpen] = useState(false);
    
    if (!notes) return <>{children}</>;

    const toggleTooltip = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const closeTooltip = () => setIsOpen(false);

    // Fecha o tooltip ao clicar fora no mobile
    useEffect(() => {
        if (!isOpen) return;
        
        document.addEventListener('click', closeTooltip);
        document.addEventListener('touchstart', closeTooltip);
        
        return () => {
            document.removeEventListener('click', closeTooltip);
            document.removeEventListener('touchstart', closeTooltip);
        };
    }, [isOpen]);

    return (
        <div className="relative inline-block w-full">
            {/* O conteúdo principal (TransactionItem) */}
            {children}
            
            {/* Ícone de Informação - O GATILHO AGORA É APENAS AQUI */}
            <div 
                className={cn(
                    "absolute top-1 right-1 p-2 rounded-full cursor-pointer z-20 transition-colors",
                    "bg-sidebar-accent/30 hover:bg-sidebar-accent/80 text-blue-400",
                    isOpen && "bg-sidebar-accent/80"
                )}
                // Eventos Desktop
                onMouseEnter={() => !isMobile && setIsOpen(true)}
                onMouseLeave={() => !isMobile && setIsOpen(false)}
                // Eventos Mobile
                onClick={toggleTooltip}
            >
                <Info className="w-4 h-4" />

                {/* Tooltip Content - Agora posicionado em relação ao ícone */}
                <div className={cn(
                    "absolute opacity-0 pointer-events-none",
                    "bottom-full right-0 mb-2 w-64 transition-all duration-200 ease-out transform translate-y-2",
                    "z-50",
                    isOpen && "opacity-100 translate-y-0 pointer-events-auto"
                )}>
                    <div className="relative p-3 bg-card rounded-xl border border-border shadow-2xl">
                        <div className="flex items-center gap-2 mb-1">
                            <Info className="w-3.5 h-3.5 text-blue-400" />
                            <h3 className="text-xs font-bold text-foreground uppercase">Observações:</h3>
                        </div>

                        <p className="text-sm text-gray-400 break-words leading-tight">
                            {notes}
                        </p>

                        {/* Triângulo (Tail) */}
                        <div className="absolute -bottom-1.5 right-3 w-3 h-3 bg-card rotate-45 border-r border-b border-border"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotesTooltip;