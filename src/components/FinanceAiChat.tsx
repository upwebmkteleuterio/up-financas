import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Mic, MicOff, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AnimatedAiChat from "@/components/ui/animated-ai-chat";
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
      setDraft(data.draft ? formatDraftField(data.draft) : mode === "execute" || Boolean(text) ? null : draft);
      if (mode === "execute") setDraft(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível falar com a IA.");
    } finally {
      setIsLoading(false);
    }
  }, [messages, draft]);

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  const draftCard = draft && (
    <Card className="border-emerald-300/20 bg-white/[0.07] text-slate-100 shadow-xl shadow-black/20 backdrop-blur-md">
      <CardHeader className="pb-2"><CardTitle className="text-base text-white">Confirme o lançamento</CardTitle></CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p><strong>{draft.type}</strong> · {draft.category}</p>
        <p className="text-lg font-semibold text-emerald-300">{formatCurrency(draft.value)}</p>
        <p>{draft.description}</p>
        <p className="text-slate-400">{draft.date} · {draft.paymentMethod}{draft.partnerName ? ` · ${draft.partnerName}` : ""}</p>
        {draft.notes && <p className="text-slate-400">Obs.: {draft.notes}</p>}
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" onClick={confirmDraft} disabled={isLoading} className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300"><Check className="mr-1 h-4 w-4" />Confirmar</Button>
          <Button type="button" size="sm" variant="outline" onClick={requestChange} disabled={isLoading} className="border-white/15 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white"><Pencil className="mr-1 h-4 w-4" />Alterar</Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AnimatedAiChat
      messages={messages}
      input={input}
      isLoading={isLoading}
      isRecording={isRecording}
      error={error}
      speechMessage={speechMessage}
      draft={draftCard}
      inputRef={inputRef}
      onInputChange={setInput}
      onSubmit={sendMessage}
      onVoice={startRecording}
      onClose={onClose}
    />
  );
};

export default FinanceAiChat;
