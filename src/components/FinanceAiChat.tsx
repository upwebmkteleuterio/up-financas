import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, MicOff, Pencil, Send, Sparkles, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { AiChatMessage, AiChatResponse, AiTransactionDraft } from "@/types/finance-ai";

interface SpeechRecognitionResultItem {
  transcript: string;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultItem>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

interface FinanceAiChatProps {
  onClose: () => void;
}

const initialMessage: AiChatMessage = {
  role: "assistant",
  content: "Olá! Posso preparar um lançamento de entrada, saída ou fundo de caixa. O lançamento só será criado depois da sua confirmação.",
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDraftField = (draft: AiTransactionDraft) => ({
  ...draft,
  value: Number(draft.value),
  notes: draft.notes || "",
});

const FinanceAiChat: React.FC<FinanceAiChatProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<AiChatMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<AiTransactionDraft | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const invokeChat = useCallback(async (mode: "chat" | "execute", text?: string, draftToExecute?: AiTransactionDraft) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<AiChatResponse>("ai-finance-chat", {
        body: {
          mode,
          message: text,
          messages,
          draft: draftToExecute,
          confirmed: mode === "execute",
        },
      });
      if (invokeError) throw invokeError;
      if (!data) throw new Error("A IA não retornou uma resposta.");
      if (data.kind === "error") throw new Error(data.message);
      if (text) setMessages((current) => [...current, { role: "user", content: text }]);
      setMessages((current) => [...current, { role: "assistant", content: data.message }]);
      setCategoryOptions(data.categoryOptions || []);
      setDraft(data.draft ? formatDraftField(data.draft) : mode === "execute" || Boolean(text) ? null : draft);
      if (mode === "execute") setDraft(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível falar com a IA.");
    } finally {
      setIsLoading(false);
    }
  }, [messages, draft]);

  const sendMessage = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await invokeChat("chat", text);
  };

  const startRecording = () => {
    const SpeechRecognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechMessage("Seu navegador não oferece reconhecimento de voz. Digite a mensagem.");
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index][0].transcript).join(" ");
      setInput((current) => `${current} ${transcript}`.trim());
      setSpeechMessage("Transcrição pronta. Revise o texto antes de enviar.");
    };
    recognition.onerror = (event) => {
      setSpeechMessage(event.error === "not-allowed" ? "Permita o microfone para usar a voz." : "Não foi possível reconhecer a fala.");
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    setSpeechMessage("Ouvindo em português (Brasil)…");
    setIsRecording(true);
    recognition.start();
  };

  const confirmDraft = async () => {
    if (!draft || isLoading) return;
    await invokeChat("execute", undefined, draft);
  };

  const requestChange = () => {
    setInput("Quero alterar este lançamento: ");
    inputRef.current?.focus();
  };

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-sidebar text-sidebar-foreground" aria-label="Chat financeiro com IA">
      <header className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Assistente financeiro</h2>
            <p className="text-xs text-muted-foreground">Rascunhos seguros, confirmação explícita</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Voltar ao menu" className="text-sidebar-foreground">
          <X className="h-5 w-5" />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1 px-4 py-4">
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`rounded-lg px-3 py-2 text-sm ${message.role === "assistant" ? "bg-sidebar-accent" : "ml-5 bg-emerald-900/40"}`}>
              {message.content}
            </div>
          ))}
          {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Processando…</div>}
          {categoryOptions.length > 0 && !draft && (
            <div className="rounded-lg border border-sidebar-border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Categorias permitidas</p>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((option) => <button key={option} type="button" onClick={() => setInput((current) => `${current}${current ? " " : ""}${option}`)} className="rounded-full bg-sidebar-accent px-2 py-1 text-xs hover:bg-sidebar-accent/70">{option}</button>)}
              </div>
            </div>
          )}
          {draft && (
            <Card className="border-emerald-600/60 bg-card text-card-foreground">
              <CardHeader className="pb-2"><CardTitle className="text-base">Confirme o lançamento</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><strong>{draft.type}</strong> · {draft.category}</p>
                <p className="text-lg font-semibold">{formatCurrency(draft.value)}</p>
                <p>{draft.description}</p>
                <p className="text-muted-foreground">{draft.date} · {draft.paymentMethod}{draft.partnerName ? ` · ${draft.partnerName}` : ""}</p>
                {draft.notes && <p className="text-muted-foreground">Obs.: {draft.notes}</p>}
                <div className="mt-3 flex gap-2">
                  <Button type="button" size="sm" onClick={confirmDraft} disabled={isLoading} className="bg-emerald-600 text-white hover:bg-emerald-700"><Check className="mr-1 h-4 w-4" />Confirmar</Button>
                  <Button type="button" size="sm" variant="outline" onClick={requestChange} disabled={isLoading}><Pencil className="mr-1 h-4 w-4" />Alterar</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3">
        {error && <p role="alert" className="mb-2 text-xs text-red-300">{error}</p>}
        {speechMessage && <p className="mb-2 text-xs text-muted-foreground">{speechMessage}</p>}
        <form onSubmit={sendMessage} className="space-y-2">
          <Textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ex.: lançar saída de R$ 120 de software hoje" rows={3} disabled={isLoading} className="resize-none bg-input text-foreground" aria-label="Mensagem para o assistente" />
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={startRecording} disabled={isLoading} aria-label={isRecording ? "Parar gravação" : "Gravar mensagem"} className="border-sidebar-border bg-transparent text-sidebar-foreground">
              {isRecording ? <MicOff className="mr-1 h-4 w-4 text-red-400" /> : <Mic className="mr-1 h-4 w-4" />}{isRecording ? "Parar" : "Voz"}
            </Button>
            <Button type="submit" size="sm" disabled={isLoading || !input.trim()}><Send className="mr-1 h-4 w-4" />Enviar</Button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default FinanceAiChat;
