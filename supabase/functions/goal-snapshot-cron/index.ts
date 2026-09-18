import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTION_PREFIX = "[goal-snapshot-cron]";
const APP_TIME_ZONE = "America/Sao_Paulo";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const pad = (value: number) => String(value).padStart(2, "0");

const getLocalDateParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
};

const monthReference = (date: Date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-01`;

const monthEndReference = (date: Date) => {
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(lastDay)}`;
};

const dateReference = (year: number, month: number, day: number) =>
  `${year}-${pad(month)}-${pad(day)}`;

const addMonths = (date: Date, amount: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));

const daysInMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const checkpointsForMonth = (month: Date) => {
  const lastDay = daysInMonth(month);
  return [
    { checkpointType: "day_5", day: 5, ratio: 1 / 6 },
    { checkpointType: "day_10", day: 10, ratio: 1 / 3 },
    { checkpointType: "day_15", day: 15, ratio: 1 / 2 },
    { checkpointType: "day_20", day: 20, ratio: 2 / 3 },
    { checkpointType: "day_25", day: 25, ratio: 5 / 6 },
    { checkpointType: "final", day: lastDay, ratio: 1 },
  ] as const;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  const configuredSecret = Deno.env.get("GOAL_SNAPSHOT_CRON_SECRET");
  if (!configuredSecret || request.headers.get("x-cron-secret") !== configuredSecret) {
    console.warn(`${FUNCTION_PREFIX} segredo de cron inválido ou ausente`);
    return jsonResponse({ error: "Não autorizado." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(`${FUNCTION_PREFIX} configuração do Supabase indisponível`);
    return jsonResponse({ error: "Configuração do Supabase indisponível." }, 500);
  }

  const now = new Date();
  const localToday = getLocalDateParts(now);
  const currentMonth = new Date(Date.UTC(localToday.year, localToday.month - 1, 1));
  const monthsToProcess = [addMonths(currentMonth, -1), currentMonth];
  const monthReferences = monthsToProcess.map(monthReference);
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  let processed = 0;

  try {
    const { data: goals, error: goalsError } = await supabase
      .from("monthly_goals")
      .select("user_id, month_reference, target_value")
      .in("month_reference", monthReferences);
    if (goalsError) throw goalsError;

    for (const goal of goals ?? []) {
      const month = new Date(`${goal.month_reference}T00:00:00Z`);
      const reference = monthReference(month);
      const endReference = monthEndReference(month);
      const { data: contracts, error: contractsError } = await supabase
        .from("contracts")
        .select("total_contract_value, date_closed")
        .eq("user_id", goal.user_id)
        .gte("date_closed", reference)
        .lte("date_closed", endReference);
      if (contractsError) throw contractsError;

      for (const checkpoint of checkpointsForMonth(month)) {
        const checkpointDate = `${reference.slice(0, 8)}${pad(checkpoint.day)}`;
        const todayReference = dateReference(localToday.year, localToday.month, localToday.day);
        if (checkpointDate >= todayReference) continue;

        const salesValue = roundCurrency(
          (contracts ?? [])
            .filter((contract) => contract.date_closed <= checkpointDate)
            .reduce((sum, contract) => sum + Number(contract.total_contract_value || 0), 0),
        );
        const targetValue = roundCurrency(Number(goal.target_value || 0));
        const checkpointTargetValue = roundCurrency(targetValue * checkpoint.ratio);
        const salesPercentage = targetValue > 0 ? roundCurrency((salesValue / targetValue) * 100) : 0;

        const { error: snapshotError } = await supabase
          .from("monthly_goal_snapshots")
          .upsert(
            {
              user_id: goal.user_id,
              month_reference: reference,
              checkpoint_type: checkpoint.checkpointType,
              checkpoint_date: checkpointDate,
              captured_at: now.toISOString(),
              target_value: targetValue,
              checkpoint_target_value: checkpointTargetValue,
              sales_value: salesValue,
              sales_percentage: salesPercentage,
            },
            { onConflict: "user_id,month_reference,checkpoint_type", ignoreDuplicates: true },
          );
        if (snapshotError) throw snapshotError;
        processed += 1;
      }
    }

    console.info(`${FUNCTION_PREFIX} snapshots verificados: ${processed}`);
    return jsonResponse({ ok: true, processed });
  } catch (error) {
    console.error(`${FUNCTION_PREFIX} falha ao processar snapshots`, error);
    return jsonResponse({ error: "Não foi possível processar os snapshots." }, 500);
  }
});
