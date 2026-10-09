import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  CircleSlash2,
  Cpu,
  GitBranch,
  ListChecks,
  MessageSquareText,
  Mic,
  MicOff,
  Search,
  Settings,
  ShieldCheck,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { TextReveal } from "@/components/ui/text-reveal";
import { ThinkingOrb } from "@/components/ui/thinking-orbs";
import type { AiChatMessage, AiDiagnosticStage, AiDiagnostics, AiToolActivity } from "@/types/finance-ai";

interface AnimatedAiChatProps {
  messages: AiChatMessage[];
  input: string;
  isLoading: boolean;
  isRecording: boolean;
  error: string | null;
  speechMessage: string | null;
  retryMessage: string | null;
  onRetry: () => void | Promise<void>;
  draft?: React.ReactNode;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onVoice: () => void;
  onSettings: () => void;
  onClose: () => void;
}

const thinkingStatuses = [
  "Verificando pedido...",
  "Coletando informações...",
  "Analisando tudo...",
  "Revisando...",
  "Tudo pronto.",
] as const;

const thinkingOrbStates = ["searching", "connecting", "solving", "composing", "breathing"] as const;

const activityDetails: Record<AiToolActivity["tool"], { fallbackLabel: string; Icon: LucideIcon }> = {
  search_partners: { fallbackLabel: "Consultei sócios ativos", Icon: Search },
  list_categories: { fallbackLabel: "Consultei categorias ativas", Icon: ListChecks },
};

const getActivityDetails = (activity: AiToolActivity) => {
  const details = activityDetails[activity.tool];
  return {
    label: activity.label?.trim() || details.fallbackLabel,
    Icon: details.Icon,
  };
};

const diagnosticStageNames: readonly AiDiagnosticStage["stage"][] = [
  "context",
  "model_request",
  "follow_up",
  "tool_execution",
  "validation",
  "response",
];

const diagnosticStatuses: readonly AiDiagnosticStage["status"][] = ["ok", "skipped", "error"];

const diagnosticDetails: Record<AiDiagnosticStage["stage"], { label: string; Icon: LucideIcon }> = {
  context: { label: "Contexto", Icon: GitBranch },
  model_request: { label: "Solicitação ao modelo", Icon: Cpu },
  follow_up: { label: "Acompanhamento", Icon: MessageSquareText },
  tool_execution: { label: "Execução de ferramenta", Icon: Wrench },
  validation: { label: "Validação", Icon: ShieldCheck },
  response: { label: "Resposta", Icon: Activity },
};

const diagnosticStatusDetails: Record<AiDiagnosticStage["status"], { label: string; className: string; Icon: LucideIcon }> = {
  ok: { label: "Concluído", className: "text-emerald-300", Icon: CheckCircle2 },
  skipped: { label: "Ignorado", className: "text-slate-400", Icon: CircleSlash2 },
  error: { label: "Falhou", className: "text-red-300", Icon: AlertCircle },
};

const isDiagnosticStageName = (value: unknown): value is AiDiagnosticStage["stage"] =>
  typeof value === "string" && diagnosticStageNames.includes(value as AiDiagnosticStage["stage"]);

const isDiagnosticStatus = (value: unknown): value is AiDiagnosticStage["status"] =>
  typeof value === "string" && diagnosticStatuses.includes(value as AiDiagnosticStage["status"]);

const getSafeDiagnostics = (diagnostics?: AiDiagnostics): AiDiagnostics | undefined => {
  const rawStages: unknown[] = Array.isArray(diagnostics?.stages) ? diagnostics.stages : [];
  const stages = rawStages.flatMap((rawStage) => {
    if (!rawStage || typeof rawStage !== "object") return [];
    const stage = rawStage as Record<string, unknown>;
    if (!isDiagnosticStageName(stage.stage) || !isDiagnosticStatus(stage.status) || typeof stage.durationMs !== "number" || !Number.isFinite(stage.durationMs)) return [];
    const code = typeof stage.code === "string" && /^[A-Z0-9_]{1,64}$/.test(stage.code) ? stage.code : undefined;
    return [{
      stage: stage.stage,
      status: stage.status,
      code,
      durationMs: Math.max(0, Math.min(Math.round(stage.durationMs), 3_600_000)),
    }];
  });
  return stages.length > 0 ? { stages } : undefined;
};

const getSafeRequestId = (requestId?: string) => {
  if (typeof requestId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)) return null;
  return requestId;
};

const formatDiagnosticDuration = (durationMs: number) =>
  durationMs < 1000 ? `${durationMs} ms` : `${(durationMs / 1000).toFixed(1).replace(".", ",")} s`;

const formatMessageTime = (timestamp?: string) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
};

const DiagnosticPanel: React.FC<{ diagnostics?: AiDiagnostics; requestId?: string }> = ({ diagnostics, requestId }) => {
  const safeDiagnostics = getSafeDiagnostics(diagnostics);
  if (!safeDiagnostics) return null;
  const safeRequestId = getSafeRequestId(requestId);

  return (
    <details className="group overflow-hidden rounded-lg border border-sky-300/15 bg-sky-300/[0.04] text-xs" aria-label="Diagnóstico da execução">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 font-medium text-sky-100 outline-none transition-colors hover:bg-sky-300/[0.05] focus-visible:ring-2 focus-visible:ring-sky-300/50 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Activity className="h-3.5 w-3.5 shrink-0 text-sky-300" aria-hidden="true" />
          <span>Diagnóstico da execução</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-sky-300 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-1.5 border-t border-sky-300/10 px-3 py-2.5">
        {safeDiagnostics.stages.map((stage, stageIndex) => {
          const details = diagnosticDetails[stage.stage];
          const status = diagnosticStatusDetails[stage.status];
          return (
            <div key={`${stage.stage}-${stageIndex}`} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 overflow-hidden rounded-md border border-white/[0.06] bg-black/10 px-2 py-1.5">
              <details.Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="min-w-0 flex-1 basis-32 text-slate-300">{details.label}</span>
              {stage.code && <code className="max-w-full break-all text-[10px] text-slate-500">{stage.code}</code>}
              <span className="shrink-0 text-slate-500">{formatDiagnosticDuration(stage.durationMs)}</span>
              <span className={`flex shrink-0 items-center gap-1 ${status.className}`}>
                <status.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {status.label}
              </span>
            </div>
          );
        })}
        {safeRequestId && (
          <p className="border-t border-white/[0.06] pt-2 text-[11px] text-slate-500">
            ID de suporte: <code className="break-all font-mono text-slate-400">{safeRequestId}</code>
          </p>
        )}
      </div>
    </details>
  );
};

const AnimatedAiChat: React.FC<AnimatedAiChatProps> = ({
  messages,
  input,
  isLoading,
  isRecording,
  error,
  speechMessage,
  retryMessage,
  onRetry,
  draft,
  inputRef,
  onInputChange,
  onSubmit,
  onVoice,
  onSettings,
  onClose,
}) => {
  const fallbackInputRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = inputRef || fallbackInputRef;
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const hasDraft = Boolean(draft);
  const [thinkingIndex, setThinkingIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setThinkingIndex(0);
      return;
    }
    setThinkingIndex(0);
    const interval = window.setInterval(() => {
      setThinkingIndex((current) => {
        if (current >= thinkingStatuses.length - 1) {
          window.clearInterval(interval);
          return current;
        }
        return current + 1;
      });
    }, 3000);
    return () => window.clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const root = scrollAreaRef.current;
      if (!root) return;
      const viewport = root.matches("[data-radix-scroll-area-viewport]")
        ? root
        : root.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
      viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, isLoading, retryMessage, hasDraft]);

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
      <header className="relative z-10 flex items-center justify-between border-b border-white/[0.08] bg-black/10 px-5 py-3 backdrop-blur-xl">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white">Assistente financeiro</h2>
          <p className="mt-1 text-xs text-slate-400">Seu assistente pronto para lançamentos financeiros</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onSettings} aria-label="Configurar instrução personalizada" className="text-slate-400 hover:bg-white/[0.08] hover:text-white">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Voltar ao menu" className="text-slate-400 hover:bg-white/[0.08] hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <ScrollArea ref={scrollAreaRef} className="relative z-10 min-h-0 flex-1 overflow-x-hidden px-4 py-5">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
              const messageTime = formatMessageTime(message.timestamp);
              return (
              <motion.div
                key={message.id || `${message.role}-${message.content}-${index}`}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className={`rounded-2xl border px-4 py-3 text-sm leading-6 shadow-lg shadow-black/10 ${
                  message.role === "assistant"
                    ? "self-start border-white/[0.08] bg-white/[0.06] text-slate-200 backdrop-blur-md"
                    : "ml-auto max-w-[88%] border-emerald-300/10 bg-gradient-to-br from-emerald-500/25 to-teal-400/10 text-emerald-50"
                }`}
              >
                {message.role === "assistant" ? (
                  <div className="space-y-2">
                    {message.activities?.map((activity, activityIndex) => {
                      const { label, Icon } = getActivityDetails(activity);
                      return (
                        <div
                          key={`${message.id || index}-activity-${activityIndex}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300/15 bg-black/10 px-3 py-2 text-xs"
                          aria-label={`${label} concluído`}
                        >
                          <div className="flex min-w-0 items-center gap-2 text-slate-300">
                            <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
                            <span className="truncate">{label}</span>
                          </div>
                          <span className="flex shrink-0 items-center gap-1 text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Concluído
                          </span>
                        </div>
                      );
                    })}
                    <p>{message.content}</p>
                    <DiagnosticPanel diagnostics={message.diagnostics} requestId={message.requestId} />
                    {messageTime && <time dateTime={message.timestamp} className="block text-right text-[10px] leading-4 text-slate-500">{messageTime}</time>}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <p>{message.content}</p>
                    {messageTime && <time dateTime={message.timestamp} className="mt-1 self-end text-[10px] leading-4 text-emerald-100/60">{messageTime}</time>}
                  </div>
                )}
              </motion.div>
              );
            })}

            {isLoading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex items-center gap-3 self-start rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-slate-400"
              >
                <ThinkingOrb
                  state={thinkingOrbStates[thinkingIndex]}
                  size={20}
                  theme="dark"
                  aria-label={thinkingStatuses[thinkingIndex]}
                />
                <span>{thinkingStatuses[thinkingIndex]}</span>
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

          {retryMessage && (
            <motion.div
              key="retry-message"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-100"
            >
              <p>{retryMessage}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRetry}
                disabled={isLoading}
                className="mt-2 border-amber-200/30 bg-transparent text-amber-100 hover:bg-amber-200/10 hover:text-white"
              >
                Tentar novamente
              </Button>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      <div className="relative z-10 border-t border-white/[0.08] bg-black/10 p-4 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-4xl">
          {error && <p role="alert" className="mb-2 px-1 text-xs text-red-300">{error}</p>}
          {speechMessage && <p className="mb-2 px-1 text-xs text-slate-400">{speechMessage}</p>}
          <form onSubmit={onSubmit} className="rounded-2xl border border-white/[0.12] bg-white/[0.06] p-2 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="relative overflow-hidden">
              {isRecording && input.trim() && (
                <TextReveal
                  text={input}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-0 m-0 overflow-hidden whitespace-pre-wrap break-words px-2 py-2 text-sm text-white"
                />
              )}
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex.: lançar saída de R$ 120 de software hoje"
                rows={1}
                disabled={isLoading}
                className={`relative z-10 max-h-40 min-h-10 resize-none overflow-hidden border-0 bg-transparent px-2 py-2 text-sm shadow-none placeholder:text-slate-500 focus-visible:ring-0 ${
                  isRecording && input.trim() ? "text-transparent caret-white selection:bg-white/20 selection:text-transparent" : "text-white"
                }`}
                aria-label="Mensagem para o assistente"
              />
            </div>
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
