// Normalização de transcrição por voz (Web Speech API).
// Ordem importa: primeiro colapsamos espaços, depois aplicamos as pontuações
// e por último as quebras de linha (que não podem ser colapsadas).

const VOICE_PUNCTUATION_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bponto e vírgula\b/giu, ";"],
  [/\bponto de interrogação\b/giu, "?"],
  [/\bponto de exclamação\b/giu, "!"],
  [/\bponto final\b/giu, "."],
  [/\binterrogação\b/giu, "?"],
  [/\bexclamação\b/giu, "!"],
  [/\bvírgula\b/giu, ","],
  [/\bquebra de linha\b/giu, "\n"],
  [/\bnova linha\b/giu, "\n"],
  [/\benter\b/giu, "\n"],
];

const VOICE_SEND_PHRASES: ReadonlyArray<RegExp> = [/\bpode enviar\b/iu, /\benviar mensagem\b/iu];
const VOICE_SEND_TRAILING = /\benviar\s*[.!?]*\s*$/iu;

export const normalizeVoiceTranscript = (text: string) => text
  .replace(/(^|[^\p{L}])descrição\b\s*:*\s*/giu, "$1Descrição: ")
  .replace(/(^|[^\p{L}])categoria\b\s*:*\s*/giu, "$1Categoria: ")
  .replace(/\s{2,}/g, " ")
  .trim();

export const applyVoiceCommands = (text: string) => {
  let result = text;
  for (const [pattern, replacement] of VOICE_PUNCTUATION_RULES) {
    result = result.replace(pattern, replacement);
  }
  return result
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/([.!?,;:])\1+/g, "$1")
    .replace(/^[ \t]+|[ \t]+$/g, "");
};

export const addAutomaticPeriod = (text: string) => {
  const trimmedEnd = text.replace(/[ \t]+$/u, "");
  if (!trimmedEnd.trim() || /[.!?,;:\n]$/u.test(trimmedEnd)) return trimmedEnd;
  return `${trimmedEnd}.`;
};

export const stripVoiceSendCommand = (text: string) => text
  .replace(/\bpode enviar\b/giu, "")
  .replace(/\benviar mensagem\b/giu, "")
  .replace(VOICE_SEND_TRAILING, "")
  .replace(/[ \t]{2,}/g, " ")
  .trim();

export const hasImmediateVoiceSendCommand = (text: string) =>
  VOICE_SEND_PHRASES.some((pattern) => pattern.test(text));

export const endsWithVoiceSendWord = (text: string) => VOICE_SEND_TRAILING.test(text);

export const buildVoiceText = (rawTranscript: string, punctuate: boolean) => {
  const normalized = applyVoiceCommands(normalizeVoiceTranscript(stripVoiceSendCommand(rawTranscript)));
  return punctuate ? addAutomaticPeriod(normalized) : normalized;
};
