CREATE OR REPLACE FUNCTION public.create_transaction(p_transaction jsonb, p_operation_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_operation_id text := COALESCE(NULLIF(p_operation_id, ''), NULLIF(p_transaction->>'operation_id', ''));
  v_existing jsonb;
  v_main public.transactions%ROWTYPE;
  v_account_type text := COALESCE(NULLIF(p_transaction->>'account_type', ''), 'main');
  v_is_transfer boolean := COALESCE(NULLIF(p_transaction->>'is_transfer', '')::boolean, false);
  v_transfer_group_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF jsonb_typeof(p_transaction) <> 'object' THEN RAISE EXCEPTION 'Lançamento inválido'; END IF;
  IF v_operation_id IS NULL THEN RAISE EXCEPTION 'Identificador da operação obrigatório'; END IF;
  SELECT to_jsonb(t) INTO v_existing FROM public.transactions t WHERE t.user_id = v_user_id AND t.operation_id = v_operation_id LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  IF v_account_type NOT IN ('main', 'reserve') THEN RAISE EXCEPTION 'Tipo de conta inválido'; END IF;
  IF v_is_transfer THEN v_transfer_group_id := gen_random_uuid(); END IF;
  INSERT INTO public.transactions (user_id, type, category, description, value, date, payment_method, notes, partner_id, is_automated, source_contract_id, account_type, is_transfer, pdf_external_id, import_batch_id, import_source, import_file_name, imported_at, raw_text, created_source, operation_id, transfer_group_id, contract_installment)
  VALUES (v_user_id, p_transaction->>'type', p_transaction->>'category', p_transaction->>'description', (p_transaction->>'value')::numeric, (p_transaction->>'date')::date, p_transaction->>'payment_method', NULLIF(p_transaction->>'notes', ''), NULLIF(p_transaction->>'partner_id', ''), COALESCE(NULLIF(p_transaction->>'is_automated', '')::boolean, false), NULLIF(p_transaction->>'source_contract_id', ''), v_account_type, v_is_transfer, NULLIF(p_transaction->>'pdf_external_id', ''), NULLIF(p_transaction->>'import_batch_id', '')::uuid, NULLIF(p_transaction->>'import_source', ''), NULLIF(p_transaction->>'import_file_name', ''), NULLIF(p_transaction->>'imported_at', '')::timestamptz, NULLIF(p_transaction->>'raw_text', ''), COALESCE(NULLIF(p_transaction->>'created_source', ''), 'manual'), v_operation_id, v_transfer_group_id, p_transaction->'contract_installment')
  ON CONFLICT (user_id, operation_id) WHERE operation_id IS NOT NULL DO NOTHING RETURNING * INTO v_main;
  IF NOT FOUND THEN
    SELECT * INTO v_main FROM public.transactions WHERE user_id = v_user_id AND operation_id = v_operation_id LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Não foi possível confirmar o lançamento'; END IF;
    RETURN to_jsonb(v_main);
  END IF;
  IF v_is_transfer AND v_account_type = 'main' AND v_main.type = 'Saída' AND v_main.category = 'Fundo de Caixa' THEN
    INSERT INTO public.transactions (user_id, type, category, description, value, date, payment_method, notes, partner_id, is_automated, source_contract_id, account_type, is_transfer, pdf_external_id, import_batch_id, import_source, import_file_name, imported_at, raw_text, created_source, operation_id, transfer_group_id) VALUES (v_user_id, 'Entrada', 'Aporte Fundo', 'Aporte vindo da Conta Principal: ' || v_main.description, v_main.value, v_main.date, 'Transferência', v_main.notes, v_main.partner_id, v_main.is_automated, v_main.source_contract_id, 'reserve', true, v_main.pdf_external_id, v_main.import_batch_id, v_main.import_source, v_main.import_file_name, v_main.imported_at, v_main.raw_text, v_main.created_source, NULL, v_transfer_group_id);
  ELSIF v_is_transfer AND v_account_type = 'reserve' AND v_main.type = 'Saída' AND v_main.category = 'Resgate Fundo' THEN
    INSERT INTO public.transactions (user_id, type, category, description, value, date, payment_method, notes, partner_id, is_automated, source_contract_id, account_type, is_transfer, pdf_external_id, import_batch_id, import_source, import_file_name, imported_at, raw_text, created_source, operation_id, transfer_group_id) VALUES (v_user_id, 'Entrada', 'Fundo de Caixa', 'Resgate vindo do Fundo de Caixa: ' || v_main.description, v_main.value, v_main.date, 'Transferência', v_main.notes, v_main.partner_id, v_main.is_automated, v_main.source_contract_id, 'main', true, v_main.pdf_external_id, v_main.import_batch_id, v_main.import_source, v_main.import_file_name, v_main.imported_at, v_main.raw_text, v_main.created_source, NULL, v_transfer_group_id);
  ELSIF v_is_transfer AND v_account_type = 'reserve' AND v_main.type = 'Entrada' AND v_main.category = 'Aporte Fundo' THEN
    INSERT INTO public.transactions (user_id, type, category, description, value, date, payment_method, notes, partner_id, is_automated, source_contract_id, account_type, is_transfer, pdf_external_id, import_batch_id, import_source, import_file_name, imported_at, raw_text, created_source, operation_id, transfer_group_id) VALUES (v_user_id, 'Saída', 'Fundo de Caixa', 'Aporte para Fundo de Caixa: ' || v_main.description, v_main.value, v_main.date, 'Transferência', v_main.notes, v_main.partner_id, v_main.is_automated, v_main.source_contract_id, 'main', true, v_main.pdf_external_id, v_main.import_batch_id, v_main.import_source, v_main.import_file_name, v_main.imported_at, v_main.raw_text, v_main.created_source, NULL, v_transfer_group_id);
  END IF;
  RETURN to_jsonb(v_main);
END;
$function$;