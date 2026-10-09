import * as React from "react";

interface FinanceAiChatContextValue {
  isOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
}

const FinanceAiChatContext = React.createContext<FinanceAiChatContextValue | null>(null);

export const FinanceAiChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const value = React.useMemo<FinanceAiChatContextValue>(() => ({
    isOpen,
    openChat: () => setIsOpen(true),
    closeChat: () => setIsOpen(false),
    toggleChat: () => setIsOpen((open) => !open),
  }), [isOpen]);
  return <FinanceAiChatContext.Provider value={value}>{children}</FinanceAiChatContext.Provider>;
};

export function useFinanceAiChat() {
  const context = React.useContext(FinanceAiChatContext);
  if (!context) throw new Error("useFinanceAiChat deve ser usado dentro de FinanceAiChatProvider");
  return context;
}
