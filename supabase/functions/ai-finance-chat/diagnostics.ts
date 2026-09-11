import type { DiagnosticStageName, DiagnosticStatus, DiagnosticsState } from "./types.ts";

export const createDiagnostics = (enabled: boolean): DiagnosticsState => ({ enabled, stages: [] });

const defaultCode = (stage: DiagnosticStageName, status: DiagnosticStatus) => {
  if (status === "ok") return `${stage.toUpperCase()}_OK`;
  if (status === "skipped") return `${stage.toUpperCase()}_SKIPPED`;
  return `${stage.toUpperCase()}_FAILED`;
};

export function recordStage(state: DiagnosticsState, stage: DiagnosticStageName, status: DiagnosticStatus, startedAt: number, code = defaultCode(stage, status)) {
  if (state.enabled) state.stages.push({ stage, status, code, durationMs: Math.max(0, Math.round(performance.now() - startedAt)) });
}

export const diagnosticsResponse = (state: DiagnosticsState) => state.enabled ? { diagnostics: { stages: state.stages } } : {};

export const logError = (requestId: string, message: string) => console.error(`[ai-finance-chat] [${requestId}] ${message}`);
