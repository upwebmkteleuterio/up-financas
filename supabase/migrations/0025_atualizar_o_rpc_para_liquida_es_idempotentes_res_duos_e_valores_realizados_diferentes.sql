CREATE OR REPLACE FUNCTION public.confirm_outgoing_occurrence(
  p_program_id uuid,
  p_sequence_number integer,
  p_due_date date,
  p_scheduled_value numeric,
  p_actual_value numeric,
  p_actual_date date,
  p_payment_method text,
  p_description text DEFAULT NULL,
  p_partial_action text DEFAULT NULL,
  p_residual_due_date date DEFAULT NULL,
  p_next_due_date date DEFAULT NULL,
  p_occurrence_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_program public.outgoing_programs%ROWTYPE;
  v_occurrence public.outgoing_occurrences%ROWTYPE;
  v_next_occurrence public.outgoing_occurrences%ROWTYPE;
  v_has_occurrence boolean := false;
  v_month_start date;
  v_expected_due_date date;
  v_last_day date;
  v_expected_value numeric(12,2);
  v_remainder numeric(12,2);
  v_category text;
  v_description text;
  v_partner_name text;
  v_operation_id text;
  v_transaction jsonb;
  v_occurrence_id uuid;
  v_next_month_start date;
  v_expected_next_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  IF (p_sequence_number IS NULL AND p_occurrence_id IS NULL)
     OR p_sequence_number < 0
     OR p_actual_value IS NULL OR p_actual_value <= 0 OR p_actual_date IS NULL THEN
    RAISE EXCEPTION 'Dados de confirmação inválidos';
  END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('Pix', 'Parcelado', 'Dinheiro', 'Cartão', 'Transferência') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
  END IF;

  SELECT * INTO v_program
  FROM public.outgoing_programs
  WHERE id = p_program_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Programação não encontrada';
  END IF;

  IF p_occurrence_id IS NOT NULL THEN
    SELECT * INTO v_occurrence
    FROM public.outgoing_occurrences
    WHERE id = p_occurrence_id AND program_id = p_program_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ocorrência não encontrada';
    END IF;
    IF v_occurrence.status <> 'pending' THEN
      RETURN jsonb_build_object('already_confirmed', true, 'transaction_id', v_occurrence.transaction_id, 'status', v_occurrence.status);
    END IF;
    IF v_occurrence.sequence_number IS DISTINCT FROM p_sequence_number THEN
      RAISE EXCEPTION 'Sequência da ocorrência inválida';
    END IF;
    v_has_occurrence := true;
    v_occurrence_id := v_occurrence.id;
    v_expected_due_date := v_occurrence.due_date;
    v_expected_value := v_occurrence.scheduled_value;
  ELSIF p_sequence_number IS NOT NULL THEN
    SELECT * INTO v_occurrence
    FROM public.outgoing_occurrences
    WHERE program_id = p_program_id AND sequence_number = p_sequence_number AND user_id = v_user_id
    FOR UPDATE;
    IF FOUND THEN
      IF v_occurrence.status <> 'pending' THEN
        RETURN jsonb_build_object('already_confirmed', true, 'transaction_id', v_occurrence.transaction_id, 'status', v_occurrence.status);
      END IF;
      v_has_occurrence := true;
      v_occurrence_id := v_occurrence.id;
      v_expected_due_date := v_occurrence.due_date;
      v_expected_value := v_occurrence.scheduled_value;
    END IF;
  END IF;

  IF NOT v_program.is_active AND NOT v_has_occurrence THEN
    RAISE EXCEPTION 'Programação inativa não gera novas ocorrências';
  END IF;
  IF v_program.frequency = 'none' AND NOT COALESCE(v_occurrence.is_residual, false) THEN
    RAISE EXCEPTION 'Esta programação não possui ocorrências';
  END IF;

  IF p_sequence_number IS NOT NULL AND NOT v_has_occurrence THEN
    IF v_program.frequency = 'once' AND p_sequence_number <> 0 THEN
      RAISE EXCEPTION 'Ocorrência não pertence à programação';
    END IF;
    IF v_program.frequency = 'count' AND p_sequence_number >= v_program.repeat_count THEN
      RAISE EXCEPTION 'Ocorrência excede a quantidade programada';
    END IF;
    v_month_start := (date_trunc('month', v_program.start_date)::date + make_interval(months => p_sequence_number))::date;
    v_last_day := (v_month_start + interval '1 month - 1 day')::date;
    v_expected_due_date := make_date(
      extract(year from v_month_start)::integer,
      extract(month from v_month_start)::integer,
      least(v_program.due_day, extract(day from v_last_day)::integer)
    );
    v_expected_value := v_program.value;
  END IF;

  IF p_due_date IS DISTINCT FROM v_expected_due_date THEN
    RAISE EXCEPTION 'Data da ocorrência não corresponde à programação';
  END IF;
  IF v_expected_value IS NULL OR p_scheduled_value IS DISTINCT FROM v_expected_value THEN
    RAISE EXCEPTION 'Valor programado inválido';
  END IF;

  IF NOT v_has_occurrence THEN
    INSERT INTO public.outgoing_occurrences (user_id, program_id, sequence_number, due_date, scheduled_value, status)
    VALUES (v_user_id, p_program_id, p_sequence_number, p_due_date, v_expected_value, 'pending')
    RETURNING id INTO v_occurrence_id;
  END IF;

  v_remainder := v_expected_value - p_actual_value;
  IF v_remainder > 0 AND COALESCE(p_partial_action, '') NOT IN ('new_date', 'add_to_next') THEN
    RAISE EXCEPTION 'Selecione como tratar o saldo restante';
  END IF;
  IF v_remainder > 0 AND p_partial_action = 'new_date' AND (p_residual_due_date IS NULL OR p_residual_due_date <= p_actual_date) THEN
    RAISE EXCEPTION 'Informe uma nova data posterior ao pagamento';
  END IF;
  IF v_remainder > 0 AND p_partial_action = 'add_to_next' THEN
    IF p_sequence_number IS NULL OR NOT v_program.is_active
       OR v_program.frequency NOT IN ('count', 'monthly')
       OR (v_program.frequency = 'count' AND p_sequence_number + 1 >= v_program.repeat_count) THEN
      RAISE EXCEPTION 'Não existe próxima ocorrência para receber o saldo';
    END IF;
    v_next_month_start := (date_trunc('month', v_program.start_date)::date + make_interval(months => p_sequence_number + 1))::date;
    v_last_day := (v_next_month_start + interval '1 month - 1 day')::date;
    v_expected_next_date := make_date(
      extract(year from v_next_month_start)::integer,
      extract(month from v_next_month_start)::integer,
      least(v_program.due_day, extract(day from v_last_day)::integer)
    );
    IF p_next_due_date IS DISTINCT FROM v_expected_next_date THEN
      RAISE EXCEPTION 'Data da próxima ocorrência inválida';
    END IF;
  END IF;

  v_category := CASE v_program.kind
    WHEN 'cost' THEN v_program.name
    WHEN 'expense' THEN v_program.name
    WHEN 'profit' THEN 'Saque de Lucro'
    ELSE 'Fundo de Caixa'
  END;
  v_description := COALESCE(NULLIF(btrim(p_description), ''), NULLIF(btrim(v_program.description), ''), v_program.name);
  IF v_program.kind = 'profit' THEN
    SELECT name INTO v_partner_name FROM public.partners WHERE id = v_program.partner_id AND user_id = v_user_id;
    IF v_partner_name IS NULL THEN
      RAISE EXCEPTION 'Sócio da programação não encontrado';
    END IF;
    v_description := v_partner_name || ' - ' || v_description;
  END IF;

  v_operation_id := CASE WHEN v_occurrence.is_residual
    THEN 'outgoing:residual:' || v_occurrence_id::text
    ELSE 'outgoing:' || p_program_id::text || ':' || p_sequence_number::text
  END;
  v_transaction := public.create_transaction(
    jsonb_build_object(
      'type', 'Saída',
      'category', v_category,
      'description', v_description,
      'value', p_actual_value,
      'date', p_actual_date,
      'payment_method', p_payment_method,
      'notes', 'Saída programada. Valor previsto: ' || v_expected_value::text,
      'partner_id', CASE WHEN v_program.kind = 'profit' THEN v_program.partner_id::text ELSE NULL END,
      'account_type', 'main',
      'is_transfer', v_program.kind = 'cash_reserve',
      'created_source', 'system',
      'operation_id', v_operation_id
    ),
    v_operation_id
  );

  UPDATE public.outgoing_occurrences
  SET status = CASE WHEN v_remainder > 0 THEN 'partial' ELSE 'paid' END,
      actual_value = p_actual_value,
      actual_date = p_actual_date,
      transaction_id = (v_transaction->>'id')::uuid
  WHERE id = v_occurrence_id;

  IF v_remainder > 0 AND p_partial_action = 'new_date' THEN
    INSERT INTO public.outgoing_occurrences (
      user_id, program_id, due_date, scheduled_value, status, is_residual, parent_occurrence_id
    ) VALUES (
      v_user_id, p_program_id, p_residual_due_date, v_remainder, 'pending', true, v_occurrence_id
    );
  ELSIF v_remainder > 0 AND p_partial_action = 'add_to_next' THEN
    SELECT * INTO v_next_occurrence
    FROM public.outgoing_occurrences
    WHERE program_id = p_program_id AND sequence_number = p_sequence_number + 1
    FOR UPDATE;
    IF FOUND THEN
      IF v_next_occurrence.status <> 'pending' OR v_next_occurrence.due_date <> v_expected_next_date THEN
        RAISE EXCEPTION 'A próxima ocorrência já foi confirmada ou alterada';
      END IF;
      UPDATE public.outgoing_occurrences
      SET scheduled_value = scheduled_value + v_remainder
      WHERE id = v_next_occurrence.id;
    ELSE
      INSERT INTO public.outgoing_occurrences (
        user_id, program_id, sequence_number, due_date, scheduled_value, status
      ) VALUES (
        v_user_id, p_program_id, p_sequence_number + 1, v_expected_next_date,
        v_program.value + v_remainder, 'pending'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'already_confirmed', false,
    'transaction', v_transaction,
    'occurrence_id', v_occurrence_id,
    'status', CASE WHEN v_remainder > 0 THEN 'partial' ELSE 'paid' END
  );
END;
$$;