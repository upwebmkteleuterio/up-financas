import React, { useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Loader2, Mic, MicOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { AiChatMessage } from "@/types/finance-ai";

interface AnimatedAiChatProps {
  messages: AiChatMessage[];
  input: string;
  isLoading: boolean;
  isRecording: boolean;
  error: string | null;
  speechMessage: string | null;
  draft?: React.ReactNode;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onVoice: () => void;
  onClose: () => void;
}

const AnimatedAiChat: React.FC<AnimatedAiChatProps> = ({
  messages,
  input,
  isLoading,
  isRecording,
  error,
  speechMessage,
  draft,
  inputRef,
  onInputChange,
  onSubmit,
  onVoice,
  onClose,
}) => {
  const fallbackInputRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = inputRef || fallbackInputRef;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 160 ? "auto" : "hidden";
  }, [input, textareaRef]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!isLoading) event.currentTarget.form?.requestSubmit();
  };

  return (
    <section className="lab-bg relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#07110f] text-slate-100" aria-label="Chat financeiro com IA">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(53,211,153,0.14),transparent_34%),radial-gradient(circle_at_100%_85%,rgba(59,130,246,0.12),transparent_38%)]" aria-hidden="true" />
      <header className="relative z-10 flex items-center justify-between border-b border-white/[0.08] bg-black/10 px-5 py-4 backdrop-blur-xl">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white">Assistente financeiro</h2>
          <p className="mt-1 text-xs text-slate-400">Rascunhos seguros, confirmação explícita</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Voltar ao menu" className="text-slate-400 hover:bg-white/[0.08] hover:text-white">
          <X className="h-5 w-5" />
        </Button>
      </header>

      <ScrollArea className="relative z-10 min-h-0 flex-1 px-4 py-5">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={`${message.role}-${index}`}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className={`rounded-2xl border px-4 py-3 text-sm leading-6 shadow-lg shadow-black/10 ${
                  message.role === "assistant"
                    ? "self-start border-white/[0.08] bg-white/[0.06] text-slate-200 backdrop-blur-md"
                    : "ml-auto max-w-[88%] border-emerald-300/10 bg-gradient-to-br from-emerald-500/25 to-teal-400/10 text-emerald-50"
                }`}
              >
                {message.content}
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="self-start rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-slate-400"
              >
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-emerald-300" />Processando…</span>
              </motion.div>
            )}

            {draft && (
              <motion.div
                key="draft"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                {draft}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <div className="relative z-10 border-t border-white/[0.08] bg-black/10 p-4 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-2xl">
          {error && <p role="alert" className="mb-2 px-1 text-xs text-red-300">{error}</p>}
          {speechMessage && <p className="mb-2 px-1 text-xs text-slate-400">{speechMessage}</p>}
          <form onSubmit={onSubmit} className="rounded-2xl border border-white/[0.12] bg-white/[0.06] p-2 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex.: lançar saída de R$ 120 de software hoje"
              rows={1}
              disabled={isLoading}
              className="max-h-40 min-h-10 resize-none overflow-hidden border-0 bg-transparent px-2 py-2 text-sm text-white shadow-none placeholder:text-slate-500 focus-visible:ring-0"
              aria-label="Mensagem para o assistente"
            />
            <div className="flex items-center justify-between gap-2 px-1 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onVoice}
                disabled={isLoading}
                aria-label={isRecording ? "Parar gravação" : "Gravar mensagem"}
                className="h-9 w-9 text-slate-400 hover:bg-white/[0.08] hover:text-white"
              >
                {isRecording ? <MicOff className="h-4 w-4 text-red-300" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()} aria-label="Enviar mensagem" className="h-9 w-9 rounded-xl bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default AnimatedAiChat;
