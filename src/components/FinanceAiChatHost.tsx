import React from "react";
import FinanceAiChat from "@/components/FinanceAiChat";
import { useFinanceAiChat } from "@/hooks/useFinanceAiChat";
import { useIsMobile } from "@/hooks/use-mobile";

const FinanceAiChatHost: React.FC = () => {
  const { isOpen, closeChat } = useFinanceAiChat();
  const isMobile = useIsMobile();
  if (!isOpen || isMobile) return null;
  return (
    <div className="fixed left-20 top-0 z-20 h-screen w-[26rem]">
      <FinanceAiChat onClose={closeChat} />
    </div>
  );
};

export default FinanceAiChatHost;
