import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Mic, MicOff, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dispatchTransactionCreated } from "@/lib/transaction-events";
import { showSuccess } from "@/utils/toast";
import { DEFAULT_FINANCE_AI_PROMPT } from "@/lib/finance-ai-prompt";
import { buildVoiceText, endsWithVoiceSendWord, hasImmediateVoiceSendCommand } from "@/lib/voice-commands";
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

const CHAT_TIMEOUT_MS = 45_000;
const VOICE_SEND_DELAY_MS = 2_000;
const OFFLINE_MESSAGE = "Você está sem conexão. Verifique sua internet e tente novamente.";
const TIMEOUT_MESSAGE = "A resposta demorou demais. Tente novamente.";
const GENERIC_FAILURE_MESSAGE = "Não foi possível processar o pedido. Tente novamente.";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDraftField = (draft: AiTransactionDraft) => ({
  ...draft,
  value: Number(draft.value),
  notes: draft.notes || "",
});

const getDraftSubgroup = (draft: AiTransactionDraft) => {
  if (draft.type === "Saída" && draft.accountType === "main" && draft.category === "Saque de Lucro") return "Saque" as const;
  if (draft.subgroup) return draft.subgroup;
  if (draft.type === "Entrada") return "Entrada" as const;
  if (draft.accountType === "reserve") return "Fundo" as const;
  if (draft.category === "Fundo de Caixa") return "Fundo" as const;
  return "Gasto" as const;
};

const getDraftGroupLabel = (draft: AiTransactionDraft) => getDraftSubgroup(draft);

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
  const voiceSendTimerRef = useRef<number | null>(null);
  const speechResultsRef = useRef<Map<number, SpeechResult>>(new Map());
  const voiceBaseInputRef = useRef("");
  const messageIdRef = useRef(0);
  const lastSentMessageRef = useRef<string | null>(null);
  const executionOperationIdRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (pauseTimerRef.current !== null) window.clearTimeout(pauseTimerRef.current);
    if (voiceSendTimerRef.current !== null) window.clearTimeout(voiceSendTimerRef.current);
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
    operationId?: string,
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
          operationId,
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
        if (data.missingByItem?.length) {
          setMessages((current) => [...current, {
            id: `assistant-${messageIdRef.current++}`,
            role: "assistant",
            content: data.message,
            timestamp: new Date().toISOString(),
            diagnostics: data.diagnostics,
            requestId: data.requestId,
          }]);
          return;
        }
        if (mode === "execute") {
          setError(data.message);
          return;
        }
        setRetryMessage(data.message || GENERIC_FAILURE_MESSAGE);
        return;
      }
      if (mode === "execute") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["transactions"] }),
          queryClient.invalidateQueries({ queryKey: ["account_balances"] }),
        ]);
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
        executionOperationIdRef.current = null;
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
      setError(null);
      if (mode === "execute") {
        setError(caught instanceof Error ? caught.message : "Não foi possível concluir o lançamento.");
      } else if (typeof navigator !== "undefined" && !navigator.onLine) {
        setRetryMessage(OFFLINE_MESSAGE);
      } else if (caught instanceof Error && caught.name === "FinanceAiChatTimeout") {
        setRetryMessage(TIMEOUT_MESSAGE);
      } else {
        setRetryMessage(GENERIC_FAILURE_MESSAGE);
      }
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [messages, queryClient]);

  const stopVoiceRecognitionForSend = () => {
    clearPauseTimer();
    clearVoiceSendTimer();
    const finalInput = getVoiceInput(true);
    setInput(finalInput);
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognitionRef.current = null;
      recognition.stop();
    }
    speechResultsRef.current.clear();
    voiceBaseInputRef.current = "";
    setIsRecording(false);
    setSpeechMessage(null);
    return finalInput;
  };

  const submitText = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isLoadingRef.current) return;
    const userMessage: AiChatMessage = {
      id: `user-${messageIdRef.current++}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    const conversation = [...messages, userMessage];
    executionOperationIdRef.current = null;
    lastSentMessageRef.current = text;
    setInput("");
    setMessages(conversation);
    await invokeChat("chat", text, undefined, conversation);
  };

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const textSource = recognitionRef.current ? stopVoiceRecognitionForSend() : input;
    await submitText(textSource);
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

  const clearVoiceSendTimer = () => {
    if (voiceSendTimerRef.current !== null) {
      window.clearTimeout(voiceSendTimerRef.current);
      voiceSendTimerRef.current = null;
    }
  };

  const getRawVoiceTranscript = () => Array.from(speechResultsRef.current.entries())
    .sort(([left], [right]) => left - right)
    .map(([, result]) => result.transcript.trim())
    .filter(Boolean)
    .join(" ");

  const getVoiceInput = (punctuate: boolean) => {
    const finalTranscript = buildVoiceText(getRawVoiceTranscript(), punctuate);
    return [voiceBaseInputRef.current, finalTranscript].filter(Boolean).join(" ");
  };

  const sendVoiceTranscript = async () => {
    clearVoiceSendTimer();
    const text = buildVoiceText(getRawVoiceTranscript(), true);
    stopVoiceRecognitionForSend();
    await submitText(text);
  };

  const handleVoiceSendCommand = () => {
    const transcript = getRawVoiceTranscript();
    if (!transcript) {
      clearVoiceSendTimer();
      return;
    }
    if (hasImmediateVoiceSendCommand(transcript)) {
      void sendVoiceTranscript();
      return;
    }
    if (endsWithVoiceSendWord(transcript)) {
      clearVoiceSendTimer();
      voiceSendTimerRef.current = window.setTimeout(() => {
        voiceSendTimerRef.current = null;
        void sendVoiceTranscript();
      }, VOICE_SEND_DELAY_MS);
      return;
    }
    clearVoiceSendTimer();
  };

  const updateVoiceInput = (punctuate = false) => {
    setInput(getVoiceInput(punctuate));
  };

  const finalizeVoiceTranscript = (punctuate = true) => {
    updateVoiceInput(punctuate);
  };

  const scheduleSpeechPause = () => {
    clearPauseTimer();
    pauseTimerRef.current = window.setTimeout(() => {
      pauseTimerRef.current = null;
      updateVoiceInput();
    }, 1000);
  };

  const finishRecording = (recognition: SpeechRecognitionLike | null, finalize: boolean) => {
    if (recognition && recognitionRef.current !== recognition) return;
    clearPauseTimer();
    if (finalize) finalizeVoiceTranscript(true);
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
        finishRecording(recognition, true);
        setSpeechMessage("Transcrição pronta. Revise o texto antes de enviar.");
      } else {
        setIsRecording(false);
      }
      return;
    }

    speechResultsRef.current.clear();
    voiceBaseInputRef.current = input.trim();

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const snapshot = new Map<number, SpeechResult>();
      for (let index = 0; index < event.results.length; index += 1) {
        const item = event.results[index]?.[0];
        if (item) snapshot.set(index, { transcript: item.transcript, isFinal: item.isFinal });
      }
      speechResultsRef.current = snapshot;
      updateVoiceInput();
      setSpeechMessage("Ouvindo em português (Brasil)…");
      scheduleSpeechPause();
      handleVoiceSendCommand();
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
    if (!executionOperationIdRef.current) executionOperationIdRef.current = crypto.randomUUID();
    await invokeChat("execute", undefined, drafts, messages, executionOperationIdRef.current);
  };

  const requestChange = (itemIndex: number) => {
    executionOperationIdRef.current = null;
    setInput(`Quero alterar o lançamento ${itemIndex + 1}: `);
    inputRef.current?.focus();
  };

  const removeDraft = (itemIndex: number) => {
    if (isLoadingRef.current) return;
    executionOperationIdRef.current = null;
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
        {drafts.map((draftItem, itemIndex) => {
          const subgroup = getDraftSubgroup(draftItem);
          return (
            <Card key={`${draftItem.date}-${draftItem.description}-${itemIndex}`} className="border-white/10 bg-black/10 text-slate-100">
              <CardContent className="space-y-1 p-3">
                <p><strong>Tipo: {draftItem.type}</strong></p>
                <p>Grupo: <strong>{getDraftGroupLabel(draftItem)}</strong></p>
                {(subgroup === "Custo" || subgroup === "Gasto") && <p>Categoria: {draftItem.category}</p>}
                {subgroup === "Saque" && draftItem.partnerName && <p className="text-slate-400">Sócio: {draftItem.partnerName}</p>}
                <p>Descrição: {draftItem.description}</p>
                <p className="text-lg font-semibold text-emerald-300">Valor: {formatCurrency(draftItem.value)}</p>
                <p className="text-slate-400">Data: {draftItem.date} · Pagamento: {draftItem.paymentMethod}</p>
                {draftItem.notes && <p className="text-slate-400">Obs.: {draftItem.notes}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => requestChange(itemIndex)} disabled={isLoading} className="border-white/15 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white"><Pencil className="mr-1 h-4 w-4" />Alterar</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => removeDraft(itemIndex)} disabled={isLoading} className="border-red-300/20 bg-transparent text-red-200 hover:bg-red-300/10 hover:text-red-100"><Trash2 className="mr-1 h-4 w-4" />Remover</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
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
