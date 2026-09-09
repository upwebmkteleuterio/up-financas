import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const MINIMUM_DISPLAY_TIME = 1500; // 1.5 segundos

const LoadingScreen: React.FC<{ onMinimumTimeElapsed: () => void }> = ({ onMinimumTimeElapsed }) => {
  
  // 1. Garante o tempo mínimo de exibição
  useEffect(() => {
    const timer = setTimeout(() => {
      onMinimumTimeElapsed();
    }, MINIMUM_DISPLAY_TIME);
    
    return () => clearTimeout(timer);
  }, [onMinimumTimeElapsed]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8 text-foreground">
      
      {/* Logo */}
      <img 
        src="/up-financas-logo.png" 
        alt="UpWeb Logo" 
        className="w-32 h-32 mb-8 animate-pulse"
      />

      {/* Main Text */}
      <h1 className="text-4xl font-extrabold text-sidebar-primary-foreground mb-2">
        Gestão de ponta
      </h1>
      
      {/* Sub Text */}
      <p className="text-lg text-gray-400 mb-10">
        Iniciando...
      </p>

      {/* Loading Bar Container (Indeterminate) */}
      {/* Reduzindo altura para h-1 e largura para max-w-xs */}
      <div className="w-full max-w-xs h-1 bg-secondary/50 rounded-full overflow-hidden relative">
        <div 
          className={cn(
            "indeterminate-bar", 
            "bg-red-600" // Cor cereja/vermelho
          )}
        />
      </div>
    </div>
  );
};

export default LoadingScreen;