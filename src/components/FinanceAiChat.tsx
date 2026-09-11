import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Mic, MicOff, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dispatchTransactionCreated } from "@/lib/transaction-events";
import { showSuccess } from "@/utils/toast";
import { DEFAULT_FINANCE_AI_PROMPT } from "@/lib/finance-ai-prompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import AnimatedAiChat from "@/components/ui/animated-ai-chat";
import type { AiChatMessage, AiChatResponse, AiTransactionDraft } from "@/types/finance-ai";

interface SpeechRecognitionResultItem {
  transcript: string;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
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

type SpeechResult = Pick<SpeechRecognitionResultItem, "transcript" | "isFinal">;

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

interface FinanceAiChatProps {
  onClose: () => void;
}

const initialMessage: AiChatMessage = {
  id: "finance-ai-initial",
  role: "assistant",
  content: "Olá! Posso preparar um lançamento de entrada, saída ou fundo de caixa. O lançamento só será criado depois da sua confirmação.",
  timestamp: new Date().toISOString(),
};

const CHAT_TIMEOUT_MESSAGE = "Desculpe, algo deu errado. Tente novamente.";
const CHAT_TIMEOUT_MS = 45_000;

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDraftField = (draft: AiTransactionDraft) => ({
  ...draft,
  value: Number(draft.value),
  notes: draft.notes || "",
});

const FinanceAiChat: React.FC<FinanceAiChatProps> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<AiChatMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [drafts, setDrafts] = useState<AiTransactionDraft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_FINANCE_AI_PROMPT);
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_FINANCE_AI_PROMPT);
  const [isPromptLoading, setIsPromptLoading] = useState(true);
  const [isPromptSaving, setIsPromptSaving] = useState(false);
  const [promptStatus, setPromptStatus] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const isLoadingRef = useRef(false);
  const pauseTimerRef = useRef<number | null>(null);
  const speechResultsRef = useRef<Map<number, SpeechResult>>(new Map());
  const forcedFinalIndexesRef = useRef(new Set<number>());
  const punctuatedIndexesRef = useRef(new Set<number>());
  const voiceBaseInputRef = useRef("");
  const messageIdRef = useRef(0);
  const lastSentMessageRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (pauseTimerRef.current !== null) window.clearTimeout(pauseTimerRef.current);
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadPrompt = async () => {
      const { data, error: loadError } = await supabase
        .from("finance_ai_settings")
        .select("system_prompt")
        .maybeSingle();
      if (!active) return;
      if (loadError) {
        setPromptError("Não foi possível carregar sua instrução personalizada.");
      } else {
        const loadedPrompt = typeof data?.system_prompt === "string" && data.system_prompt.trim()
          ? data.system_prompt
          : DEFAULT_FINANCE_AI_PROMPT;
        setPrompt(loadedPrompt);
        setSavedPrompt(loadedPrompt);
      }
      setIsPromptLoading(false);
    };
    void loadPrompt();
    return () => {
      active = false;
    };
  }, []);

  const invokeChat = useCallback(async (
    mode: "chat" | "execute",
    text?: string,
    draftsToExecute?: AiTransactionDraft[],
    conversation: AiChatMessage[] = messages,
  ) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setRetryMessage(null);
    try {
      const invokePromise = supabase.functions.invoke<AiChatResponse>("ai-finance-chat", {
        body: {
          mode,
          message: text,
          messages: conversation.map((message) => {
            const serverMessage = { ...message };
            delete serverMessage.timestamp;
            return serverMessage;
          }),
          drafts: draftsToExecute,
          confirmed: mode === "execute",
          diagnostics: true,
        },
      });
      let result;
      if (mode === "chat") {
        let timeoutId: number | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            const timeoutError = new Error("A chamada do chat excedeu o tempo limite.");
            timeoutError.name = "FinanceAiChatTimeout";
            reject(timeoutError);
          }, CHAT_TIMEOUT_MS);
        });
        try {
          result = await Promise.race([invokePromise, timeoutPromise]);
        } finally {
          if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        }
      } else {
        result = await invokePromise;
      }
      const { data, error: invokeError } = result;
      if (invokeError) throw invokeError;
      if (!data) throw new Error("A IA não retornou uma resposta.");
      if (data.kind === "error") {
        setMessages((current) => [...current, {
          id: `assistant-${messageIdRef.current++}`,
          role: "assistant",
          content: data.message,
          timestamp: new Date().toISOString(),
          diagnostics: data.diagnostics,
          requestId: data.requestId,
        }]);
        throw new Error(data.message);
      }
      if (mode === "execute") {
        await queryClient.invalidateQueries({ queryKey: ["transactions"] });
        const transactionIds = Array.isArray(data.transactionIds)
          ? data.transactionIds.filter((id): id is string => typeof id === "string" && id.length > 0)
          : typeof data.transactionId === "string"
            ? [data.transactionId]
            : [];
        if (transactionIds.length > 0) dispatchTransactionCreated(transactionIds);
        const createdCount = typeof data.createdCount === "number" && Number.isFinite(data.createdCount)
          ? Math.max(0, Math.floor(data.createdCount))
          : transactionIds.length;
        showSuccess(createdCount === 1
          ? "Lançamento realizado com sucesso!"
          : `${createdCount} lançamentos realizados com sucesso!`);
      }
      setMessages((current) => [...current, {
        id: `assistant-${messageIdRef.current++}`,
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
        activities: data.activities,
        diagnostics: data.diagnostics,
        requestId: data.requestId,
      }]);
      const responseDrafts = data.drafts ?? (data.draft ? [data.draft] : []);
      setDrafts(mode === "execute" ? [] : responseDrafts.map(formatDraftField));
    } catch (caught) {
      if (caught instanceof Error && caught.name === "FinanceAiChatTimeout" && mode === "chat") {
        setError(null);
        setRetryMessage(CHAT_TIMEOUT_MESSAGE);
      } else {
        setRetryMessage(null);
        setError(caught instanceof Error ? caught.message : "Não foi possível falar com a IA.");
      }
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [messages, queryClient]);

  const stopVoiceRecognitionForSend = () => {
    clearPauseTimer();
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognitionRef.current = null;
      recognition.stop();
    }
    speechResultsRef.current.clear();
    forcedFinalIndexesRef.current.clear();
    punctuatedIndexesRef.current.clear();
    voiceBaseInputRef.current = "";
    setIsRecording(false);
    setSpeechMessage(null);
  };

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (recognitionRef.current) stopVoiceRecognitionForSend();
    const text = input.trim();
    if (!text || isLoadingRef.current) return;
    const userMessage: AiChatMessage = {
      id: `user-${messageIdRef.current++}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    const conversation = [...messages, userMessage];
    lastSentMessageRef.current = text;
    setInput("");
    setMessages(conversation);
    await invokeChat("chat", text, undefined, conversation);
  };

  const retryLastMessage = async () => {
    const text = lastSentMessageRef.current;
    if (!text || isLoadingRef.current) return;
    await invokeChat("chat", text, undefined, messages);
  };

  const clearPauseTimer = () => {
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  const addAutomaticPeriod = (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText || /[.!?]$/.test(trimmedText)) return trimmedText;
    return `${trimmedText}.`;
  };

  const updateVoiceInput = () => {
    const entries = Array.from(speechResultsRef.current.entries()).sort(([left], [right]) => left - right);
    const confirmed = entries
      .filter(([index, result]) => result.isFinal || forcedFinalIndexesRef.current.has(index))
      .map(([index, result]) => punctuatedIndexesRef.current.has(index) ? addAutomaticPeriod(result.transcript) : result.transcript.trim())
      .filter(Boolean);
    const interim = entries
      .filter(([index, result]) => !result.isFinal && !forcedFinalIndexesRef.current.has(index))
      .map(([, result]) => result.transcript.trim())
      .filter(Boolean)
      .join(" ");
    const transcript = [...confirmed, interim].filter(Boolean).join(" ");
    const nextInput = [voiceBaseInputRef.current, transcript].filter(Boolean).join(" ");

    setInput(nextInput);
  };

  const finalizePendingSpeech = () => {
    const entries = Array.from(speechResultsRef.current.entries()).sort(([left], [right]) => left - right);
    const pending = [...entries].reverse().find(([index, result]) => !result.isFinal && !forcedFinalIndexesRef.current.has(index));
    const latest = entries.at(-1);
    if (pending) forcedFinalIndexesRef.current.add(pending[0]);
    if (latest) punctuatedIndexesRef.current.add(latest[0]);
    updateVoiceInput();
  };

  const scheduleSpeechPause = () => {
    clearPauseTimer();
    pauseTimerRef.current = window.setTimeout(() => {
      pauseTimerRef.current = null;
      finalizePendingSpeech();
    }, 1000);
  };

  const finishRecording = (recognition: SpeechRecognitionLike | null, finalize: boolean) => {
    if (recognition && recognitionRef.current !== recognition) return;
    clearPauseTimer();
    if (finalize) finalizePendingSpeech();
    const activeRecognition = recognitionRef.current;
    if (activeRecognition) {
      activeRecognition.onresult = null;
      activeRecognition.onerror = null;
      activeRecognition.onend = null;
      recognitionRef.current = null;
      activeRecognition.stop();
    }
    setIsRecording(false);
  };

  const startRecording = () => {
    const SpeechRecognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechMessage("Seu navegador não oferece reconhecimento de voz. Digite a mensagem.");
      return;
    }
    if (recognitionRef.current || isRecording) {
      const recognition = recognitionRef.current;
      if (recognition) {
        finalizePendingSpeech();
        finishRecording(recognition, false);
        setSpeechMessage("Transcrição pronta. Revise o texto antes de enviar.");
      } else {
        setIsRecording(false);
      }
      return;
    }

    speechResultsRef.current.clear();
    forcedFinalIndexesRef.current.clear();
    punctuatedIndexesRef.current.clear();
    voiceBaseInputRef.current = input.trim();

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const startIndex = Math.max(0, event.resultIndex);
      for (let index = startIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const item = result?.[0];
        if (!item) continue;
        const previous = speechResultsRef.current.get(index);
        if (previous && previous.transcript !== item.transcript && !item.isFinal) {
          forcedFinalIndexesRef.current.delete(index);
          punctuatedIndexesRef.current.delete(index);
        }
        speechResultsRef.current.set(index, { transcript: item.transcript, isFinal: item.isFinal });
      }
      updateVoiceInput();
      setSpeechMessage("Ouvindo em português (Brasil)…");
      scheduleSpeechPause();
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      setSpeechMessage(event.error === "not-allowed" ? "Permita o microfone para usar a voz." : "Não foi possível reconhecer a fala.");
      finishRecording(recognition, true);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      finishRecording(recognition, true);
      setSpeechMessage("Transcrição pronta. Revise o texto antes de enviar.");
    };
    recognitionRef.current = recognition;
    setSpeechMessage("Ouvindo em português (Brasil)…");
    setIsRecording(true);
    try {
      recognition.start();
    } catch {
      setSpeechMessage("Não foi possível iniciar o reconhecimento de voz.");
      finishRecording(recognition, true);
    }
  };

  const confirmDrafts = async () => {
    if (drafts.length === 0 || isLoadingRef.current) return;
    await invokeChat("execute", undefined, drafts);
  };

  const requestChange = (itemIndex: number) => {
    setInput(`Quero alterar o lançamento ${itemIndex + 1}: `);
    inputRef.current?.focus();
  };

  const removeDraft = (itemIndex: number) => {
    if (isLoadingRef.current) return;
    setDrafts((current) => current.filter((_, index) => index !== itemIndex));
  };

  const handleSettingsOpenChange = (open: boolean) => {
    setIsSettingsOpen(open);
    if (open) {
      setPrompt(savedPrompt);
      setPromptStatus(null);
    }
  };

  const savePrompt = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setPromptError("A instrução personalizada não pode ficar vazia.");
      setPromptStatus(null);
      return;
    }
    setIsPromptSaving(true);
    setPromptError(null);
    setPromptStatus(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sua sessão expirou. Entre novamente para salvar.");
      const { error: saveError } = await supabase.from("finance_ai_settings").upsert({
        user_id: userData.user.id,
        system_prompt: trimmedPrompt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (saveError) throw saveError;
      setPrompt(trimmedPrompt);
      setSavedPrompt(trimmedPrompt);
      setPromptStatus("Instrução salva.");
    } catch (caught) {
      setPromptError(caught instanceof Error ? caught.message : "Não foi possível salvar a instrução.");
    } finally {
      setIsPromptSaving(false);
    }
  };

  const draftCard = drafts.length > 0 && (
    <Card className="border-emerald-300/20 bg-white/[0.07] text-slate-100 shadow-xl shadow-black/20 backdrop-blur-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-white">
          {drafts.length === 1 ? "Confirme o lançamento" : "Confirme os lançamentos"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {drafts.map((draftItem, itemIndex) => (
          <Card key={`${draftItem.date}-${draftItem.description}-${itemIndex}`} className="border-white/10 bg-black/10 text-slate-100">
            <CardContent className="space-y-1 p-3">
              <p><strong>{draftItem.type}</strong> · {draftItem.category}</p>
              <p className="text-lg font-semibold text-emerald-300">{formatCurrency(draftItem.value)}</p>
              <p>{draftItem.description}</p>
              <p className="text-slate-400">Data: {draftItem.date} · Pagamento: {draftItem.paymentMethod}</p>
              <p className="text-slate-400">Parceiro: {draftItem.partnerName || "Não informado"}</p>
              {draftItem.notes && <p className="text-slate-400">Obs.: {draftItem.notes}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => requestChange(itemIndex)} disabled={isLoading} className="border-white/15 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white"><Pencil className="mr-1 h-4 w-4" />Alterar</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => removeDraft(itemIndex)} disabled={isLoading} className="border-red-300/20 bg-transparent text-red-200 hover:bg-red-300/10 hover:text-red-100"><Trash2 className="mr-1 h-4 w-4" />Remover</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        <Button type="button" onClick={confirmDrafts} disabled={isLoading} className="w-full bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
          <Check className="mr-1 h-4 w-4" />
          {drafts.length === 1 ? "Confirmar lançamento" : `Confirmar ${drafts.length} lançamentos`}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <>
      <AnimatedAiChat
        messages={messages}
        input={input}
        isLoading={isLoading}
        isRecording={isRecording}
        error={error}
        speechMessage={speechMessage}
        retryMessage={retryMessage}
        onRetry={retryLastMessage}
        draft={draftCard}
        inputRef={inputRef}
        onInputChange={setInput}
        onSubmit={sendMessage}
        onVoice={startRecording}
        onSettings={() => handleSettingsOpenChange(true)}
        onClose={onClose}
      />

      <Dialog open={isSettingsOpen} onOpenChange={handleSettingsOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instrução personalizada</DialogTitle>
            <DialogDescription>
              Oriente o assistente com preferências suas. As regras de segurança, validação e confirmação do sistema continuam obrigatórias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={isPromptLoading || isPromptSaving}
              rows={8}
              aria-label="Instrução personalizada do assistente financeiro"
              placeholder={DEFAULT_FINANCE_AI_PROMPT}
            />
            {isPromptLoading && <p className="text-sm text-muted-foreground">Carregando instrução…</p>}
            {promptStatus && <p className="text-sm text-emerald-600">{promptStatus}</p>}
            {promptError && <p role="alert" className="text-sm text-destructive">{promptError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsSettingsOpen(false)} disabled={isPromptSaving}>Cancelar</Button>
            <Button type="button" onClick={savePrompt} disabled={isPromptLoading || isPromptSaving}>
              {isPromptSaving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FinanceAiChat;
