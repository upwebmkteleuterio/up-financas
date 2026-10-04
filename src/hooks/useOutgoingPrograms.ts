import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addMonths, differenceInCalendarMonths, getDaysInMonth, parseISO, startOfMonth } from "date-fns";
import { supabase } from "@/lib/supabase";
import { keysToCamelCase, keysToSnakeCase } from "@/lib/utils";
import { showError } from "@/utils/toast";
import { useAuth } from "@/hooks/useAuth";
import { OutgoingOccurrence, OutgoingProgram, OutgoingStatus, PaymentMethod } from "@/types/finance";

const PROGRAMS_KEY = ["outgoing_programs"];
const OCCURRENCES_KEY = ["outgoing_occurrences"];

export function makeOutgoingOccurrence(program: OutgoingProgram, sequenceNumber: number): OutgoingOccurrence | null {
  if (!program.startDate || !program.dueDay || program.value == null) return null;
  const month = addMonths(startOfMonth(parseISO(program.startDate)), sequenceNumber);
  const day = Math.min(program.dueDay, getDaysInMonth(month));
  return {
    programId: program.id,
    sequenceNumber,
    dueDate: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    scheduledValue: Number(program.value),
    status: "pending",
    isResidual: false,
  };
}

export function useOutgoingPrograms() {
  const { user } = useAuth();
  const client = useQueryClient();
  const { data: programs = [], isLoading } = useQuery({
    queryKey: [...PROGRAMS_KEY, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("outgoing_programs").select("*").eq("user_id", user!.id).order("name");
      if (error) throw error;
      return (data || []).map(keysToCamelCase) as OutgoingProgram[];
    },
  });
  const save = useMutation({
    mutationFn: async (program: Partial<OutgoingProgram> & Pick<OutgoingProgram, "name" | "kind" | "frequency">) => {
      if (!user) throw new Error("Usuário não autenticado.");
      const row = { ...keysToSnakeCase(program), user_id: user.id };
      const request = program.id
        ? supabase.from("outgoing_programs").update(row).eq("id", program.id).eq("user_id", user.id)
        : supabase.from("outgoing_programs").insert(row);
      const { error } = await request;
      if (error) throw error;
    },
    onSuccess: async () => {
      if (!user) return;
      await Promise.all([
        client.invalidateQueries({ queryKey: [...PROGRAMS_KEY, user.id], refetchType: "all" }),
        client.invalidateQueries({ queryKey: [...OCCURRENCES_KEY, user.id], refetchType: "all" }),
      ]);
    },
    onError: error => showError(error.message),
  });
  const saveProgram = useCallback((program: Partial<OutgoingProgram> & Pick<OutgoingProgram, "name" | "kind" | "frequency">) => save.mutate(program), [save]);
  const activePrograms = useMemo(() => programs.filter(p => p.isActive), [programs]);
  return { programs, activePrograms, isLoading, saveProgram };
}

export function useOutgoingOccurrences(range?: { start: Date; end: Date }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const { programs } = useOutgoingPrograms();
  const { data: saved = [], isLoading } = useQuery({
    queryKey: [...OCCURRENCES_KEY, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("outgoing_occurrences").select("*").eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map(keysToCamelCase) as OutgoingOccurrence[];
    },
  });
  const occurrences = useMemo(() => {
    const generated: OutgoingOccurrence[] = [];
    const savedKeys = new Set(saved.filter(o => o.sequenceNumber !== null).map(o => `${o.programId}:${o.sequenceNumber}`));
    for (const program of programs) {
      if (!program.isActive || program.frequency === "none" || !program.startDate) continue;
      const startMonth = startOfMonth(parseISO(program.startDate));
      const defaultStart = startOfMonth(new Date());
      const firstSequence = Math.max(0, differenceInCalendarMonths(startOfMonth(range?.start || defaultStart), startMonth));
      const lastSequence = differenceInCalendarMonths(startOfMonth(range?.end || defaultStart), startMonth) + 1;
      const finalSequence = program.frequency === "once" ? 0 : program.frequency === "count"
        ? Math.min(lastSequence, (program.repeatCount || 0) - 1)
        : lastSequence;
      for (let sequence = firstSequence; sequence <= finalSequence; sequence++) {
        const occurrence = makeOutgoingOccurrence(program, sequence);
        if (occurrence && !savedKeys.has(`${program.id}:${sequence}`)) generated.push(occurrence);
      }
    }
    const byProgram = new Map(programs.map(p => [p.id, p]));
    return [...saved, ...generated].map(o => ({ ...o, program: byProgram.get(o.programId) })).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [programs, saved, range?.start.getTime(), range?.end.getTime()]);
  const confirm = useCallback(async (params: {
    occurrence: OutgoingOccurrence; actualValue: number; actualDate: string; paymentMethod: PaymentMethod;
    description: string; partialAction?: "new_date" | "add_to_next"; residualDueDate?: string; nextDueDate?: string;
  }) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const o = params.occurrence;
    const { error } = await supabase.rpc("confirm_outgoing_occurrence", {
      p_program_id: o.programId,
      p_sequence_number: o.sequenceNumber,
      p_due_date: o.dueDate,
      p_scheduled_value: o.scheduledValue,
      p_actual_value: params.actualValue,
      p_actual_date: params.actualDate,
      p_payment_method: params.paymentMethod,
      p_description: params.description,
      p_partial_action: params.partialAction || null,
      p_residual_due_date: params.residualDueDate || null,
      p_next_due_date: params.nextDueDate || null,
      p_occurrence_id: o.id || null,
    });
    if (error) throw error;
    await Promise.all([
      client.invalidateQueries({ queryKey: OCCURRENCES_KEY }),
      client.invalidateQueries({ queryKey: PROGRAMS_KEY }),
      client.invalidateQueries({ queryKey: ["transactions"] }),
      client.invalidateQueries({ queryKey: ["account_balances"] }),
    ]);
  }, [user, client]);
  const pending = useMemo(() => occurrences.filter(o => o.status === "pending"), [occurrences]);
  return { occurrences, pending, isLoading, confirm, programs };
}

export type OutgoingOccurrenceWithProgram = OutgoingOccurrence & { program?: OutgoingProgram; status: OutgoingStatus };
